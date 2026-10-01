const RAW_DATA=(window.CHOOSE_DATA||[]).map(x=>({
  title:x.t,year:x.y||null,kind:x.k||'movie',copies:x.c||1,enriched:!!x.e,
  r:x.r??null,d:x.d??null,g:x.g||[],a:x.a||[],k:x.w||[],s:x.s||'',q:x.q||'',long:x.l||'',
  poster:x.p||'',director:x.dir||'',imdb:x.id||'',loc:x.loc||[],orig:x.orig||x.t,
  key:((x.t||'')+'|'+(x.y||''))
}));

function canonicalTitle(s=''){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\b(vf|vo|vostfr|french|english|eng|fr|extended|remastered|edition|directors? cut)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function locationRank(l){
  const p=(l?.p||'').toUpperCase();
  if(p.startsWith('C:\\')) return 0;
  if(p.startsWith('E:\\')) return 2;
  return 1;
}
function itemPriority(x){
  const locs=x.loc||[];
  const internal=locs.some(l=>locationRank(l)===0)?1000:0;
  const metadata=(x.imdb?120:0)+(x.s?80:0)+(x.r!=null?30:0)+(x.d?20:0)+(x.a?.length||0)*4+(x.g?.length||0)*3;
  return internal+metadata;
}
function dedupeCatalog(items){
  const groups=new Map();
  for(const x of items){
    const base=x.imdb
      ? 'imdb:'+x.imdb
      : 'title:'+canonicalTitle(x.title)+'|'+(x.year||'')+'|'+x.kind;
    if(!groups.has(base)) groups.set(base,[]);
    groups.get(base).push(x);
  }
  const out=[];
  for(const group of groups.values()){
    group.sort((a,b)=>itemPriority(b)-itemPriority(a));
    const best={...group[0]};
    const locMap=new Map();
    for(const x of group){
      for(const l of (x.loc||[])){
        if(l?.p && !locMap.has(l.p)) locMap.set(l.p,l);
      }
      if(!best.s && x.s) best.s=x.s;
      if(!best.poster && x.poster) best.poster=x.poster;
      if(!best.director && x.director) best.director=x.director;
      if(!best.imdb && x.imdb) best.imdb=x.imdb;
      if(best.r==null && x.r!=null) best.r=x.r;
      if(!best.d && x.d) best.d=x.d;
      if((!best.a||!best.a.length) && x.a?.length) best.a=x.a;
      if((!best.g||!best.g.length) && x.g?.length) best.g=x.g;
      if((!best.k||!best.k.length) && x.k?.length) best.k=x.k;
    }
    best.loc=[...locMap.values()].sort((a,b)=>locationRank(a)-locationRank(b));
    best.copies=Math.max(group.length,best.loc.length,best.copies||1);
    best.key=best.imdb?'imdb:'+best.imdb:canonicalTitle(best.title)+'|'+(best.year||'');
    out.push(best);
  }
  return out;
}
const DATA=dedupeCatalog(RAW_DATA);

const ACTOR_COUNTS=new Map();
for(const item of DATA){
  for(const actor of (item.a||[])){
    if(!actor) continue;
    ACTOR_COUNTS.set(actor,(ACTOR_COUNTS.get(actor)||0)+1);
  }
}

function actorHtml(name){
  const count=ACTOR_COUNTS.get(name)||0;
  return count>1
    ? `<button class="actor-link" type="button" data-actor="${esc(name)}" title="Voir les ${count} titres avec ${esc(name)}">${esc(name)}</button>`
    : `<span class="actor-name">${esc(name)}</span>`;
}

let seed=1;
let randomFive=null;
let previousRandomKeys=new Set();
let storageMode='C';
const $=id=>document.getElementById(id);
const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

const GENRE_FR={
  'Action':'Action','Adventure':'Aventure','Animation':'Animation','Biography':'Biopic',
  'Comedy':'Comédie','Crime':'Crime','Documentary':'Documentaire','Drama':'Drame',
  'Family':'Famille','Fantasy':'Fantastique','History':'Historique','Horror':'Horreur',
  'Music':'Musique','Musical':'Musical','Mystery':'Mystère','Romance':'Romance',
  'Sci-Fi':'SF','Sport':'Sport','Thriller':'Thriller','War':'Guerre','Western':'Western',
  'Nature':'Nature','Rugby':'Rugby','Music Video':'Clip musical'
};

const TOPICS=[
  ['zombies',/zombie|undead/],['pandémie',/pandemic|epidemic|virus|outbreak|infect/],
  ['apocalypse',/apocalyp|end of the world|collapse/],['extraterrestres',/alien|extraterrestrial|ufo/],
  ['espace',/space|astronaut|mars|galaxy|planet|moon mission/],['voyage temporel',/time travel|time loop|travels? through time/],
  ['guerre',/war|soldier|army|battle|military|battalion/],['espionnage',/spy|espionage|secret agent|cia|intelligence agency/],
  ['FBI',/\bfbi\b/],['enquête',/detective|investigat|murder|mystery|police officer/],
  ['meurtre',/murder|serial killer|killing/],['mafia',/mafia|gangster|organized crime/],
  ['cartel',/cartel|drug war/],['braquage',/heist|robbery|bank rob/],['prison',/prison|jail|convict/],
  ['vengeance',/revenge|vengeance/],['famille',/family|father|mother|daughter|son|sister|brother/],
  ['père-fils',/father.{0,20}son|son.{0,20}father/],['mère-fille',/mother.{0,20}daughter|daughter.{0,20}mother/],
  ['amour',/love|romance|lover|relationship|couple/],['adolescence',/teenager|adolescent|coming of age|high school/],
  ['amitié',/friendship|friends|unlikely companion/],['école',/school|student|teacher|college/],
  ['musique',/music|musician|singer|pianist|drummer|band/],['jazz',/jazz/],
  ['sport',/sport|football|soccer|baseball|boxing|athlete|racing/],['justice',/court|lawyer|trial|judge|attorney/],
  ['politique',/politic|government|president|election|parliament/],['corruption',/corrupt|scandal/],
  ['IA / robots',/robot|android|artificial intelligence|\bai\b/],['survie',/surviv|stranded|escape/],
  ['montagne',/mountain|climb|everest/],['océan',/ocean|sea|whale|dolphin|shark|submarine/],
  ['animaux',/dog|cat|animal|horse/],['samouraï',/samurai/],['Japon',/japan|tokyo/],
  ['Chine',/china|chinese|beijing/],['western',/cowboy|western|sheriff|frontier/],
  ['religion',/church|priest|religion|faith|monk|pope/],['art',/artist|painter|painting|art world/],
  ['cinéma',/film director|filmmaker|cinema|projectionist/],['road trip',/road trip|journey across|travels across/],
  ['esclavage',/slavery|slave/],['droits civiques',/civil rights|segregat|racism/],
  ['finance',/wall street|banker|financial|stock market/],['médias',/journalist|media|newspaper/],
  ['kidnapping',/kidnap|abduct|disappear/],['nature',/wildlife|forest|jungle|ecosystem/],
  ['climat',/climate|environment|pollution/],['île',/island/],['huis clos',/bunker|trapped|locked|confined/],
  ['orques',/orca|killer whale/],['captivité',/captive|captivity/],['parc marin',/seaworld|marine park/],
  ['réplicants',/replicant/],['dystopie',/dystopia|dystopian/],['super-héros',/superhero/],
  ['quête',/quest|searches for|sets out to find/],['disparition',/disappear|missing person/],['île isolée',/isolated island/]
];

function kindLabel(k){return k==='tv'?'SÉRIE':k==='collection'?'COLLECTION':k==='unknown'?'À IDENTIFIER':'FILM'}
function fmtDur(m){if(!m)return'';let h=Math.floor(m/60),n=m%60;return h?(h+'h'+String(n).padStart(2,'0')):(m+' min')}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function genreLabel(g){return GENRE_FR[g]||g}

function sourceRaw(l){
  return (l?.r || l?.p?.split('\\').pop() || '').trim();
}

function isEnglishMarked(raw=''){
  return /\b(VOSTFR|VOST|VO|ENG|ENGLISH|ORIGINAL)\b/i.test(raw);
}

function isFrenchMarked(raw=''){
  if(/\bVOSTFR\b/i.test(raw)) return false;
  return /\b(VF|TRUEFRENCH|FRENCH|FRANCAIS|FRANÇAIS|FRA)\b/i.test(raw);
}

function looksFrenchTitle(raw=''){
  if(isEnglishMarked(raw)) return false;
  const t=norm(raw);
  return /\b(le|la|les|un|une|des|du|de|au|aux|et|dans|mon|ma|mes|notre|nos|ce|cette|ces|avec|sans|pour|sur)\b/.test(t);
}

function cleanLocalTitle(raw='',year=null){
  let t=raw
    .replace(/\.(avi|mkv|mp4|m4v|mov|webm|mpg|mpeg|ts|zip|rar)$/i,'')
    .replace(/[._]+/g,' ')
    .replace(/\[[^\]]*\]/g,' ')
    .replace(/\([^)]*(?:rip|encod|torrent|tested|testé|www|divx|dvd|bluray|webrip|web.?dl|hdtv|x26[45]|720p|1080p|2160p)[^)]*\)/gi,' ');
  if(year){
    const y=String(year);
    const idx=t.indexOf(y);
    if(idx>1) t=t.slice(0,idx);
  }
  t=t
    .replace(/\b(VOSTFR|VOST|VO|VF|TRUEFRENCH|FRENCH|FRANCAIS|FRANÇAIS|FRA|ENG|ENGLISH)\b.*$/i,' ')
    .replace(/\b(720p|1080p|2160p|4k|bluray|brrip|webrip|web.?dl|dvdrip|hdtv|x264|x265|hevc|divx)\b.*$/i,' ')
    .replace(/\s+-\s+$/,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/^[0-9]+\s+(?=[A-Za-zÀ-ÿ])/,'');
  return t;
}

function locDrive(l){
  const p=(l?.p||'').toUpperCase();
  if(p.startsWith('C:\\')) return 'C';
  if(p.startsWith('E:\\')) return 'E';
  return '?';
}

function relevantLocations(x){
  const locs=[...(x.loc||[])];
  if(storageMode==='C') return locs.filter(l=>locDrive(l)==='C');
  if(storageMode==='E') return locs.filter(l=>locDrive(l)==='E');
  return locs.sort((a,b)=>locationRank(a)-locationRank(b));
}

function hasStorage(x){
  if(storageMode==='BOTH') return true;
  return (x.loc||[]).some(l=>locDrive(l)===storageMode);
}

function displayTitle(x){
  const locs=relevantLocations(x);
  const vf=locs.find(l=>isFrenchMarked(sourceRaw(l)));
  if(vf){
    const rawTitle=cleanLocalTitle(sourceRaw(vf),x.year);
    if(rawTitle.length>1) return rawTitle;
  }
  const frenchish=locs.find(l=>looksFrenchTitle(sourceRaw(l)));
  if(frenchish){
    const rawTitle=cleanLocalTitle(sourceRaw(frenchish),x.year);
    if(rawTitle.length>1 && looksFrenchTitle(rawTitle)) return rawTitle;
  }
  if(x.orig && x.orig!==x.title){
    const rawOrig=cleanLocalTitle(x.orig,x.year);
    if(rawOrig.length>1 && looksFrenchTitle(rawOrig)) return rawOrig;
  }
  return x.title;
}

function microKeywords(x){
  const out=[...(x.k||[])];
  const text=norm([x.s,(x.g||[]).join(' '),x.title].join(' '));
  for(const [label,re] of TOPICS){
    if(out.length>=5)break;
    if(re.test(text) && !out.some(v=>norm(v)===norm(label))) out.push(label);
  }
  return out.slice(0,5);
}

function likelyTruncatedSynopsis(s=''){
  return /(?:\.{3}|…)\s*$/.test((s||'').trim());
}

function firstCompleteSentence(s=''){
  const t=(s||'').replace(/\s+/g,' ').trim();
  if(!t) return '';
  const clean=t.replace(/(?:\.{3}|…)\s*$/,'').trim();
  const match=clean.match(/^.*?[.!?](?=\s|$)/);
  if(match) return match[0].trim();
  return clean;
}

function compactSentence(s=''){
  let t=(s||'').replace(/\s+/g,' ').trim();
  if(!t) return '';
  t=firstCompleteSentence(t);

  // Remove a long introductory clause when the useful subject comes after the first comma.
  if(t.length>92 && /^(when|while|after|before|as|in|during|following)\b/i.test(t)){
    const comma=t.indexOf(',');
    if(comma>12 && comma<t.length-24){
      let rest=t.slice(comma+1).trim();
      if(rest){
        rest=rest.charAt(0).toUpperCase()+rest.slice(1);
        if(!/[.!?]$/.test(rest)) rest+='.';
        t=rest;
      }
    }
  }

  if(t.length<=112) return t;
  const cut=t.slice(0,108);
  const stop=Math.max(cut.lastIndexOf(' '),78);
  return cut.slice(0,stop).replace(/[,:;\s]+$/,'')+'…';
}

function microPitch(x){
  const custom=(x.q||'').replace(/\s+/g,' ').trim();
  if(custom) return compactSentence(custom);
  const t=(x.s||'').replace(/\s+/g,' ').trim();
  if(!t) return x.kind==='collection' ? 'Collection à explorer.' : '';
  return compactSentence(t);
}

function localDetailSynopsis(x){
  const preferred=(x.long||x.s||'').replace(/\s+/g,' ').trim();
  if(!preferred) return 'Pas de synopsis fiable disponible pour ce titre.';
  if(!likelyTruncatedSynopsis(preferred)) return preferred;
  const clean=preferred.replace(/(?:\.{3}|…)\s*$/,'').trim();
  const complete=[...clean.matchAll(/.*?[.!?](?=\s|$)/g)].map(m=>m[0].trim()).filter(Boolean);
  if(complete.length) return complete.join(' ');
  return clean ? clean.replace(/[,:;\s]+$/,'')+'.' : 'Pas de synopsis fiable disponible pour ce titre.';
}

function sentenceParts(text=''){
  const t=(text||'').replace(/\s+/g,' ').trim();
  if(!t) return [];
  const matches=t.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) || [];
  return matches.map(s=>s.trim()).filter(Boolean);
}

function storyExcerpt(text,maxSentences=4,maxChars=680){
  const parts=sentenceParts(text);
  if(!parts.length) return '';
  const out=[];
  let chars=0;
  for(const part of parts){
    if(out.length>=maxSentences) break;
    if(out.length>=2 && chars+part.length>maxChars) break;
    out.push(part);
    chars+=part.length+1;
  }
  return out.join(' ').trim();
}

function synopsisHighlightRanges(text='',keywords=[]){
  const t=(text||'').trim();
  if(!t) return [];

  const candidates=[];
  const add=(start,end,score)=>{
    if(start<0 || end<=start) return;
    const value=t.slice(start,end);
    if(value.length<3 || value.length>48) return;
    candidates.push({start,end,score,value});
  };

  // Named story entities: people, places and named objects.
  // At least two capitalised tokens are required so a sentence-opening word is never highlighted alone.
  const entityRx=/\b(?:[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ'’-]{1,}|[IVXLCM]{2,})(?:\s+(?:of|the|de|del|la|le|du|des|and|[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ'’-]{1,}|[IVXLCM]{2,})){1,3}\b/g;
  for(const m of t.matchAll(entityRx)){
    const val=m[0].trim();
    if(/^(The|A|An)\s/i.test(val) && val.split(/\s+/).length<3) continue;
    add(m.index,m.index+m[0].length,100);
  }

  // Story concepts useful for scanning. Every expression is token-bounded.
  const storyTerms=[
    /\bWorld War (?:I|II)\b/gi,
    /\bCold War\b/gi,
    /\bCivil War\b/gi,
    /\btime travel\b/gi,
    /\bserial killer\b/gi,
    /\bspace station\b/gi,
    /\bartificial intelligence\b/gi,
    /\bprison camp\b/gi,
    /\bconcentration camp\b/gi,
    /\borganized crime\b/gi,
    /\bdrug cartel\b/gi,
    /\bNazi(?:s)?\b/gi,
    /\baliens?\b/gi,
    /\brobots?\b/gi,
    /\bandroids?\b/gi,
    /\bzombies?\b/gi,
    /\bprison\b/gi,
    /\bheist\b/gi,
    /\bkidnapp(?:ing|ed)?\b/gi,
    /\bmurder\b/gi,
    /\brevenge\b/gi,
    /\bsurvival\b/gi
  ];
  for(const rx of storyTerms){
    const m=rx.exec(t);
    if(m) add(m.index,m.index+m[0].length,88);
  }

  // Movie-specific keywords, but only when the exact whole phrase occurs in the synopsis.
  for(const raw of (keywords||[])){
    const kw=(raw||'').trim();
    if(kw.length<3) continue;
    const escaped=kw.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&').replace(/\s+/g,'\\s+');
    const rx=new RegExp('(?:^|\\b)('+escaped+')(?:\\b|$)','i');
    const m=rx.exec(t);
    if(m){
      const offset=m[0].length-m[1].length;
      add(m.index+offset,m.index+offset+m[1].length,82);
    }
  }

  candidates.sort((a,b)=>b.score-a.score || a.start-b.start);

  const picked=[];
  for(const cand of candidates){
    if(picked.length>=4) break;
    if(picked.some(p=>cand.start<p.end && cand.end>p.start)) continue;
    if(picked.some(p=>Math.abs(cand.start-p.start)<24)) continue;
    picked.push(cand);
  }

  return picked.sort((a,b)=>a.start-b.start);
}

function renderSynopsisContent(el,text){
  const t=(text||'').trim();
  el.replaceChildren();
  if(!t) return;

  const ranges=synopsisHighlightRanges(t,(el.dataset.keywords||'').split('|').filter(Boolean));
  if(!ranges.length){
    el.textContent=t;
    return;
  }

  let cursor=0;
  for(const range of ranges){
    if(range.start>cursor) el.appendChild(document.createTextNode(t.slice(cursor,range.start)));
    const strong=document.createElement('strong');
    strong.className='syn-key';
    strong.textContent=t.slice(range.start,range.end);
    el.appendChild(strong);
    cursor=range.end;
  }
  if(cursor<t.length) el.appendChild(document.createTextNode(t.slice(cursor)));
}

function stripWikiHtml(html=''){
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('sup,table,style,script,h1,h2,h3,h4,h5,h6,.mw-editsection,.navbox,.infobox').forEach(n=>n.remove());
  return (doc.body.textContent||'')
    .replace(/\[[^\]]{1,24}\]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function wikiSectionScore(line=''){
  const n=norm(line);
  if(n==='plot') return 100;
  if(n==='synopsis') return 95;
  if(n==='premise') return 90;
  if(n==='story') return 85;
  if(n.startsWith('plot ')) return 80;
  return 0;
}

async function fetchWikipediaPlot(title,year,director,kind){
  if(!title) return '';

  const directorName=(director||'').split(',')[0].trim();
  const query=[
    '"'+title+'"',
    year||'',
    directorName ? '"'+directorName+'"' : '',
    kind==='tv' ? 'television series' : 'film'
  ].filter(Boolean).join(' ');

  const searchUrl='https://en.wikipedia.org/w/api.php?origin=*&format=json&action=query&list=search'
    +'&srsearch='+encodeURIComponent(query)
    +'&srlimit=5&srnamespace=0';

  const searchRes=await fetch(searchUrl,{cache:'force-cache'});
  if(!searchRes.ok) return '';
  const searchBody=await searchRes.json();
  const results=searchBody?.query?.search||[];
  if(!results.length) return '';

  const targetTitle=norm(title);
  const directorSurname=norm(directorName.split(/\s+/).pop()||'');
  results.sort((a,b)=>{
    const score=r=>{
      const page=norm(r.title||'');
      const snippet=norm((r.snippet||'').replace(/<[^>]+>/g,' '));
      let s=0;
      if(page===targetTitle) s+=8;
      if(page.includes(targetTitle)) s+=6;
      if(year && (page.includes(String(year))||snippet.includes(String(year)))) s+=4;
      if(directorSurname && (page.includes(directorSurname)||snippet.includes(directorSurname))) s+=6;
      if(kind==='tv' ? /series|television/.test(page) : /film/.test(page)) s+=2;
      return s;
    };
    return score(b)-score(a);
  });

  for(const result of results){
    const pageid=result.pageid;
    if(!pageid) continue;

    const sectionsUrl='https://en.wikipedia.org/w/api.php?origin=*&format=json&action=parse'
      +'&pageid='+encodeURIComponent(pageid)
      +'&prop=sections';
    const sectionsRes=await fetch(sectionsUrl,{cache:'force-cache'});
    if(!sectionsRes.ok) continue;
    const sectionsBody=await sectionsRes.json();
    const sections=sectionsBody?.parse?.sections||[];

    const storySection=sections
      .map(sec=>({sec,score:wikiSectionScore(sec.line||'')}))
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score)[0]?.sec;

    if(!storySection) continue;

    const plotUrl='https://en.wikipedia.org/w/api.php?origin=*&format=json&action=parse'
      +'&pageid='+encodeURIComponent(pageid)
      +'&section='+encodeURIComponent(storySection.index)
      +'&prop=text';
    const plotRes=await fetch(plotUrl,{cache:'force-cache'});
    if(!plotRes.ok) continue;
    const plotBody=await plotRes.json();
    const html=plotBody?.parse?.text?.['*']||'';
    const plot=storyExcerpt(stripWikiHtml(html));

    if(plot.length>=140) return plot;
  }

  return '';
}

async function hydrateSynopsis(rowEl){
  const syn=rowEl.querySelector('.syn[data-imdb]');
  if(!syn || syn.dataset.loading==='1' || syn.dataset.hydrated==='1') return;

  const title=syn.dataset.title||'';
  const year=syn.dataset.year||'';
  const director=syn.dataset.director||'';
  const kind=syn.dataset.kind||'movie';
  let current=syn.textContent.trim();

  renderSynopsisContent(syn,current);

  // A hand-curated multi-sentence plot already has the desired level of detail.
  if(sentenceParts(current).length>=2 && current.length>=190){
    syn.dataset.hydrated='1';
    return;
  }

  syn.dataset.loading='1';
  try{
    // Only use an actual Plot/Synopsis/Premise/Story section.
    // Never use a Wikipedia article introduction, production history or title definition.
    const plot=await fetchWikipediaPlot(title,year,director,kind);
    if(plot && plot.length>current.length+45){
      current=plot;
      renderSynopsisContent(syn,current);
    }
    syn.dataset.hydrated='1';
  }catch(_err){
    // Keep the local movie synopsis if no verified story section is available.
  }finally{
    delete syn.dataset.loading;
  }
}
function posterUrl(x){
  if(x.imdb) return 'https://images.metahub.space/poster/medium/'+encodeURIComponent(x.imdb)+'/img';
  return x.poster||'';
}

function trailerUrl(x){
  const q=[x.title,x.year||'',x.kind==='tv'?'official series trailer':'official trailer','English'].filter(Boolean).join(' ');
  return 'https://www.youtube.com/results?search_query='+encodeURIComponent(q);
}

function getGenres(){
  return [...new Set(DATA.flatMap(x=>x.g||[]))].sort((a,b)=>genreLabel(a).localeCompare(genreLabel(b),'fr'));
}
for(const g of getGenres()) $('genre').insertAdjacentHTML('beforeend',`<option value="${esc(g)}">${esc(genreLabel(g))}</option>`);

function baseFiltered(){
  let q=norm($('q').value),type=$('type').value,genre=$('genre').value,r=+$('rating').value,d=+$('dur').value;
  return DATA.filter(x=>{
    if(!hasStorage(x)) return false;
    if(type!=='all'&&x.kind!==type)return false;
    if(genre!=='all'&&!(x.g||[]).includes(genre))return false;
    if(r&&(!x.r||x.r<r))return false;
    if(d&&(!x.d||x.d>d))return false;
    if(q){
      let hay=norm([displayTitle(x),x.title,x.year,(x.g||[]).join(' '),(x.a||[]).join(' '),microKeywords(x).join(' '),x.s,x.director,(x.loc||[]).map(l=>l.p).join(' ')].join(' '));
      if(!hay.includes(q))return false;
    }
    return true;
  });
}

function filtered(){
  let a=baseFiltered();
  if(randomFive){
    const chosen=new Set(randomFive);
    return a.filter(x=>chosen.has(x.key)).sort((x,y)=>randomFive.indexOf(x.key)-randomFive.indexOf(y.key));
  }
  let s=$('sort').value;
  if(s==='rating')a.sort((x,y)=>(y.r||-1)-(x.r||-1));
  else if(s==='year')a.sort((x,y)=>(y.year||0)-(x.year||0));
  else if(s==='random')a.sort((x,y)=>rand(x.key+seed)-rand(y.key+seed));
  else a.sort((x,y)=>displayTitle(x).localeCompare(displayTitle(y),'fr'));
  return a;
}

function pickRandomFive(){
  const pool=baseFiltered();
  if(!pool.length){ randomFive=[]; render(); return; }
  let candidates=pool.filter(x=>!previousRandomKeys.has(x.key));
  if(candidates.length<Math.min(5,pool.length)) candidates=[...pool];
  for(let i=candidates.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
  }
  const chosen=candidates.slice(0,Math.min(5,candidates.length));
  randomFive=chosen.map(x=>x.key);
  previousRandomKeys=new Set(randomFive);
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

function rand(s){let h=0;for(const c of s)h=(Math.imul(h,31)+c.charCodeAt(0))|0;return (h>>>0)/4294967295}

function render(){
  const a=filtered(),en=DATA.filter(x=>x.enriched).length,tv=DATA.filter(x=>x.kind==='tv').length;
  const cCount=DATA.filter(x=>(x.loc||[]).some(l=>locDrive(l)==='C')).length;
  const eCount=DATA.filter(x=>(x.loc||[]).some(l=>locDrive(l)==='E')).length;
  const unknownCount=DATA.filter(x=>!(x.loc||[]).length).length;
  $('stats').innerHTML=`
    <span class=pill><b>${a.length}</b> affichés</span>
    <span class=pill><b>${cCount}</b> sur C</span>
    <span class=pill><b>${eCount}</b> sur E</span>
    ${storageMode==='BOTH'&&unknownCount?`<span class="pill warning"><b>${unknownCount}</b> emplacement à confirmer</span>`:''}`;
  $('list').innerHTML=a.map(row).join('');
  $('empty').hidden=a.length>0;

  document.querySelectorAll('.mainrow').forEach(el=>el.onclick=()=>{
    const rowEl=el.closest('.row');
    const opening=!rowEl.classList.contains('open');
    document.querySelectorAll('.row.open').forEach(r=>r.classList.remove('open'));
    if(opening){
      rowEl.classList.add('open');
      hydrateSynopsis(rowEl);
    }
  });
}

function locationHtml(x){
  const locs=relevantLocations(x);
  if(!locs.length){
    return `<div class="location-empty">${storageMode==='BOTH'
      ? 'Emplacement exact non retrouvé avec assez de certitude dans l’export actuel.'
      : 'Pas de copie fiable identifiée sur '+storageMode+': dans l’export actuel.'}</div>`;
  }
  return locs.map(l=>{
    const raw=sourceRaw(l);
    let root=l.b||l.p;
    if(!l.b){
      if(raw && root.toLowerCase().endsWith(('\\'+raw).toLowerCase())){
        root=root.slice(0,root.length-raw.length-1);
      }else{
        root=root.replace(/\\[^\\]+$/,'');
      }
    }
    const explorerUrl='search-ms:query='+encodeURIComponent(raw||displayTitle(x))+'&crumb=location:'+encodeURIComponent(root);
    return `<div class="location-row">
      <div class="location-text">
        <strong class="drive-tag drive-${locDrive(l).toLowerCase()}">${locDrive(l)}:</strong>
        <strong>${esc(l.s||'Source')}</strong>
        <a class="path-link open-local" href="${esc(explorerUrl)}" title="Rechercher cet emplacement dans l’Explorateur Windows">${esc(l.p)}</a>
      </div>
      <div class="location-actions">
        <a class="mini-btn open-local" href="${esc(explorerUrl)}" title="Trouver cet emplacement dans l’Explorateur Windows">🔎 Trouver dans l’explorateur</a>
        <button class="mini-btn copy-path" type="button" data-path="${esc(l.p)}">Copier</button>
      </div>
    </div>`;
  }).join('');
}

function row(x){
  const shownTitle=displayTitle(x);
  const genres=(x.g||[]).slice(0,2).map(genreLabel);
  const actors=(x.a||[]).slice(0,2);
  const words=microKeywords(x).slice(0,4);
  const pitch=microPitch(x);
  return `<article class="row">
    <div class="mainrow">
      <div class="scanline">
        <span class="title" title="${esc(shownTitle)}">${esc(shownTitle)}</span>
        <span class="year">${x.year?'('+x.year+')':''}</span>
        <span class="badge ${x.kind}">${kindLabel(x.kind)}</span>
        ${genres.length?`<span class="genres">${esc(genres.join(' / '))}</span>`:''}
        <span class="rating-inline">${x.r?'★ '+x.r.toFixed(1):'★ -'}</span>
        <span class="duration-inline">${fmtDur(x.d)||'—'}</span>
        ${actors.length?`<span class="actors">${esc(actors.join(', '))}</span>`:''}
        ${words.length?`<span class="keywords">${esc(words.join(' · '))}</span>`:''}
        ${pitch?`<span class="pitch-inline">${esc(pitch)}</span>`:''}
      </div>
      <span class="arrow">⌄</span>
    </div>

    <div class="details">
      <div class="detailgrid">
        <div class="posterwrap">
          ${posterUrl(x)?`<img class="poster" src="${esc(posterUrl(x))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="posterplaceholder" style="display:none">Visuel indisponible</div>`:`<div class="posterplaceholder">Visuel indisponible</div>`}
        </div>
        <div class="detailbody">
          <div class="detailhead">
            <div>
              <div class="detailtitle">${esc(shownTitle)} ${x.year?'<span>('+x.year+')</span>':''}</div>
              <div class="detailmeta">
                <span class="badge ${x.kind}">${kindLabel(x.kind)}</span>
                ${x.r?`<span class="detailrating">★ ${x.r.toFixed(1)} IMDb</span>`:''}
                ${x.d?`<span>${fmtDur(x.d)}</span>`:''}
                ${(x.g||[]).length?`<span>${esc((x.g||[]).map(genreLabel).join(' / '))}</span>`:''}
                ${x.kind!=='collection'&&x.kind!=='unknown'?`<a class="trailer-btn" href="${esc(trailerUrl(x))}" target="_blank" rel="noopener noreferrer">▶ Trailer EN · YouTube</a>`:''}
              </div>
            </div>
          </div>

          ${microKeywords(x).length?`<div class="hook">${microKeywords(x).map(w=>`<span>${esc(w)}</span>`).join('')}</div>`:''}

          <div class="synopsis-block">
            <div class="section-label">Synopsis détaillé</div>
            <p class="syn" data-imdb="${esc(x.imdb)}" data-title="${esc(x.title)}" data-year="${esc(x.year||'')}" data-director="${esc(x.director||'')}" data-kind="${esc(x.kind)}" data-keywords="${esc(microKeywords(x).join('|'))}">${esc(localDetailSynopsis(x))}</p>
          </div>

          <div class="detail-facts">
            ${x.director?`<div><strong>Réalisation</strong><span>${esc(x.director)}</span></div>`:''}
            ${(x.a||[]).length?`<div><strong>Distribution</strong><span class="cast-list">${x.a.map(actorHtml).join('<span class="cast-sep">, </span>')}</span></div>`:''}
          </div>

          <div class="locations">
            <div class="section-label">Emplacement dans ta bibliothèque</div>
            ${locationHtml(x)}
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

document.addEventListener('click',async e=>{
  const actor=e.target.closest('[data-actor]');
  if(actor){
    e.stopPropagation();
    $('q').value=actor.dataset.actor||'';
    randomFive=null;
    previousRandomKeys=new Set();
    document.querySelectorAll('.row.open').forEach(r=>r.classList.remove('open'));
    render();
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }

  const btn=e.target.closest('.copy-path');
  if(!btn)return;
  e.stopPropagation();
  try{
    await navigator.clipboard.writeText(btn.dataset.path||'');
    const old=btn.textContent; btn.textContent='Copié ✓';
    setTimeout(()=>btn.textContent=old,1200);
  }catch{
    window.prompt('Copie le chemin :',btn.dataset.path||'');
  }
});

document.querySelectorAll('[data-storage]').forEach(btn=>btn.addEventListener('click',()=>{
  storageMode=btn.dataset.storage;
  document.querySelectorAll('[data-storage]').forEach(b=>b.classList.toggle('active',b===btn));
  randomFive=null;
  previousRandomKeys=new Set();
  document.querySelectorAll('.row.open').forEach(r=>r.classList.remove('open'));
  render();
}));

['q','type','genre','rating','dur','sort'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',()=>{
  randomFive=null;
  previousRandomKeys=new Set();
  render();
}));
$('random').onclick=pickRandomFive;

render();