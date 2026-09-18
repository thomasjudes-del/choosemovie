#!/usr/bin/env python3
import concurrent.futures, html, json, os, re, time, unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data-enriched.js"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36 ChooseMovie/1.0"

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(vf|vo|vostfr|eng|english|french|fr|hd|divx|bluray|webrip|dvdrip|dvd|x264|x265|hdtv|web dl|webdl|truefrench)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def key_for(x):
    return f"{x.get('t','')}|{x.get('y') or ''}"

def load_source():
    rows = []
    for p in sorted(ROOT.glob("data-0*.js")):
        txt = p.read_text(encoding="utf-8")
        a = txt.find("[")
        b = txt.rfind("]")
        if a >= 0 and b > a:
            rows.extend(json.loads(txt[a:b+1]))
    return rows

def get_json(url, retries=2):
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json,text/plain,*/*"})
            with urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception:
            if attempt == retries: return None
            time.sleep(.7 * (attempt + 1))

def get_text(url, retries=2):
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8"})
            with urlopen(req, timeout=20) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            if attempt == retries: return ""
            time.sleep(.7 * (attempt + 1))

def score(item, c):
    a = norm(item.get("t"))
    b = norm(c.get("l") or c.get("name") or "")
    if not a or not b: return -999
    s = SequenceMatcher(None, a, b).ratio() * 100
    if a == b: s += 35
    elif a in b or b in a: s += 12
    iy, cy = item.get("y"), c.get("y")
    if iy and cy:
        try:
            d = abs(int(iy) - int(cy))
            s += 35 if d == 0 else 16 if d == 1 else -min(35, d * 6)
        except Exception: pass
    q = str(c.get("q") or "").lower()
    k = item.get("k") or "movie"
    if k == "tv":
        s += 20 if ("series" in q or "tv" in q) else -8
    elif k == "movie":
        s += 10 if ("movie" in q or "feature" in q or not q) else -5
    return s

def find_candidate(item):
    title = item.get("t","").strip()
    queries = [title]
    cleaned = re.sub(r"\([^)]*\)|\[[^]]*\]", " ", title)
    cleaned = re.sub(r"\b(VF|VO|VOSTFR|FR|ENG|DivX|HD|DVD|BluRay|WEBRip).*?$", "", cleaned, flags=re.I).strip(" -._")
    if cleaned and cleaned != title: queries.append(cleaned)
    best = None
    for q in queries:
        for host in ("https://v3.sg.media-imdb.com/suggestion/x/", "https://v2.sg.media-imdb.com/suggestion/x/"):
            data = get_json(host + quote(q) + ".json", retries=1)
            if not data: continue
            for c in data.get("d", []):
                if not str(c.get("id","")).startswith("tt"): continue
                sc = score(item,c)
                if best is None or sc > best[0]: best = (sc,c)
            if best and best[0] >= 100: break
        if best and best[0] >= 100: break
    return best if best and best[0] >= 66 else None

def parse_duration(v):
    if not v: return None
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?", str(v))
    if not m: return None
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0)

TOPICS = [
    ("zombie", r"zombie|undead"), ("pandémie", r"pandemic|epidemic|virus|outbreak"),
    ("espace", r"space|astronaut|planet|mars|moon|galaxy"), ("guerre", r"war|soldier|battle|army"),
    ("enquête", r"detective|investigat|murder|mystery"), ("crime", r"crime|criminal|mafia|gangster"),
    ("famille", r"family|father|mother|son|daughter|sister|brother"), ("amour", r"love|romance|lover|relationship"),
    ("survie", r"surviv|stranded|escape"), ("vengeance", r"revenge|vengeance"),
    ("politique", r"politic|government|president|election"), ("espionnage", r"spy|agent|intelligence|cia|fbi"),
    ("robot", r"robot|android|artificial intelligence|\bai\b"), ("temps", r"time travel|time loop|future|past"),
    ("musique", r"music|musician|singer|pianist|drummer|band"), ("sport", r"sport|football|baseball|boxing|race|athlete"),
    ("prison", r"prison|jail|convict"), ("western", r"cowboy|western|frontier"),
    ("Japon", r"japan|samurai|tokyo"), ("Chine", r"china|chinese|beijing"),
    ("mer", r"ocean|sea|ship|submarine|whale|shark"), ("montagne", r"mountain|climb|everest"),
]

def keywords(desc):
    t = norm(desc)
    out = []
    for label, pat in TOPICS:
        if re.search(pat, t):
            out.append(label)
        if len(out) >= 4: break
    return out

def jsonld_from_page(imdb_id):
    text = get_text(f"https://www.imdb.com/title/{imdb_id}/")
    if not text: return {}
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', text, re.I | re.S):
        raw = html.unescape(m.group(1)).strip()
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict) and obj.get("name"): return obj
        except Exception:
            pass
    return {}

def enrich(item):
    if item.get("k") == "collection":
        return key_for(item), {"kind":"collection","matched":False}
    found = find_candidate(item)
    if not found:
        return key_for(item), {"matched":False}
    sc, c = found
    iid = c.get("id")
    ld = jsonld_from_page(iid)
    q = str(c.get("q") or "").lower()
    typ = str(ld.get("@type") or "").lower()
    kind = "tv" if ("tvseries" in typ or "series" in q or "tv" in q) else "movie"
    img = ""
    ci = c.get("i")
    if isinstance(ci, dict): img = ci.get("imageUrl") or ci.get("url") or ""
    img = ld.get("image") or img
    if isinstance(img, dict): img = img.get("url","")
    actors = []
    for a in ld.get("actor",[]) if isinstance(ld.get("actor"), list) else []:
        if isinstance(a,dict) and a.get("name"): actors.append(a["name"])
    if not actors and c.get("s"):
        actors = [x.strip() for x in str(c["s"]).split(",") if x.strip()][:6]
    directors = []
    d = ld.get("director",[])
    if isinstance(d,dict): d=[d]
    if isinstance(d,list):
        directors=[x.get("name") for x in d if isinstance(x,dict) and x.get("name")]
    ar = ld.get("aggregateRating") or {}
    try: rating = float(ar.get("ratingValue")) if ar.get("ratingValue") is not None else None
    except Exception: rating = None
    genres = ld.get("genre") or []
    if isinstance(genres,str): genres=[genres]
    desc = html.unescape(ld.get("description") or "").strip()
    y = item.get("y")
    if not y:
        dp = str(ld.get("datePublished") or "")
        if re.match(r"^\d{4}", dp): y = int(dp[:4])
        elif c.get("y"):
            try: y=int(c["y"])
            except Exception: pass
    return key_for(item), {
        "matched": True, "id": iid, "match": round(sc,1), "kind": kind, "y": y,
        "r": rating, "d": parse_duration(ld.get("duration")), "g": genres[:5],
        "a": actors[:6], "w": keywords(desc), "s": desc, "p": img,
        "dir": ", ".join(directors[:3])
    }

def main():
    items = load_source()
    print(f"Enriching {len(items)} entries...")
    out = {}
    workers = int(os.environ.get("WORKERS","5"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(enrich,item): item for item in items}
        done = 0
        for fut in concurrent.futures.as_completed(futs):
            try:
                k,v = fut.result()
            except Exception as e:
                item=futs[fut]; k=key_for(item); v={"matched":False,"error":str(e)[:120]}
            out[k]=v
            done += 1
            if done % 25 == 0: print(f"{done}/{len(items)}")
    matched=sum(1 for v in out.values() if v.get("matched"))
    OUT.write_text("window.CHOOSE_ENRICH="+json.dumps(out,ensure_ascii=False,separators=(',',':'))+";\n",encoding="utf-8")
    print(f"Matched {matched}/{len(items)}; wrote {OUT.name}")

if __name__ == "__main__":
    main()
