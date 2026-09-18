const STORAGE = {
  library: 'choosemovie.library.v1',
  enrichments: 'choosemovie.enrichments.v1',
  token: 'choosemovie.tmdbToken.v1'
};

const state = {
  library: loadJSON(STORAGE.library, []),
  enrichments: loadJSON(STORAGE.enrichments, {}),
  stopEnrich: false,
  randomSeed: 0
};

const $ = (id) => document.getElementById(id);
const els = {
  onboarding: $('onboarding'), app: $('app'), stats: $('stats'), movieList: $('movieList'),
  emptyState: $('emptyState'), resultCount: $('resultCount'), enrichHint: $('enrichHint'),
  searchInput: $('searchInput'), clearSearchBtn: $('clearSearchBtn'), kindFilter: $('kindFilter'),
  genreFilter: $('genreFilter'), ratingFilter: $('ratingFilter'), runtimeFilter: $('runtimeFilter'),
  sortSelect: $('sortSelect'), randomBtn: $('randomBtn'), importBtn: $('importBtn'),
  onboardingImportBtn: $('onboardingImportBtn'), fileInput: $('fileInput'), settingsBtn: $('settingsBtn'),
  settingsDialog: $('settingsDialog'), tokenInput: $('tokenInput'), saveTokenBtn: $('saveTokenBtn'),
  enrichBtn: $('enrichBtn'), stopEnrichBtn: $('stopEnrichBtn'), enrichProgressWrap: $('enrichProgressWrap'),
  enrichProgressBar: $('enrichProgressBar'), enrichProgressText: $('enrichProgressText'),
  exportBtn: $('exportBtn'), resetBtn: $('resetBtn'), rowTemplate: $('rowTemplate')
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function uid(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function norm(s='') { return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }

const RELEASE_WORDS = /\b(?:1080p|720p|2160p|4k|webrip|web[- .]?dl|bluray|brrip|dvdrip|hdrip|hdtv|xvid|x264|x265|hevc|h264|aac|ac3|ddp5|dts|10bit|5\.1|6ch|2ch|repack|remux|yify|rarbg|galaxyrg|eztv|yts|vppv|french|truefrench|vostfr|subfrench|multi|dual|limited|unrated|extended|directors? cut|alternate ending|imax edition|remastered|complete)\b/gi;
const VIDEO_EXT = /\.(avi|mkv|mp4|m4v|mov|webm|divx|mpg|mpeg|ts)$/i;
const AUX_EXT = /\.(srt|sub|idx|zip|rar|txt|nfo|jpg|jpeg|png|gif|mp3|flac|wav)$/i;
const SERIES_PATTERNS = /\b(s\d{1,2}(?:e\d{1,2})?|season\s*\d*|saison\s*\d*|series|serie|complete season|mini[- ]?series)\b/i;
const COLLECTION_PATTERNS = /\b(serie|trilogie|integrale|duology|collection)\b/i;

function cleanCandidate(raw, entryType) {
  let name = raw.trim();
  const original = name;
  name = name.replace(VIDEO_EXT, '').replace(/_/g, ' ').replace(/\.+/g, ' ');
  const years = [...name.matchAll(/\b(19\d{2}|20\d{2})\b/g)];
  const year = years.length ? Number(years[0][1]) : null;
  if (year) {
    const idx = name.indexOf(String(year));
    const after = name.slice(idx + 4);
    name = name.slice(0, idx) + ' ' + year;
    if (/\b(part|chapter|volume)\s+[ivx0-9]+\b/i.test(after)) name += ' ' + (after.match(/\b(part|chapter|volume)\s+[ivx0-9]+\b/i)?.[0] || '');
  }
  name = name.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*(?:yts|bluray|webrip|720p|1080p|x264|x265)[^)]*\)/gi, ' ');
  name = name.replace(RELEASE_WORDS, ' ').replace(/\bwww\.[^ ]+/gi,' ').replace(/\s+/g,' ').trim();
  if (year) name = name.replace(new RegExp('\\b'+year+'\\b.*$'),'').trim();
  name = name.replace(/[-–]+$/,'').trim();
  name = name.replace(/\b(?:eng|fr|vf|vo)\b$/i,'').trim();
  let kindHint = 'movie';
  if (SERIES_PATTERNS.test(original) || /S\d{2}E\d{2}/i.test(original)) kindHint = 'tv';
  if (entryType === 'DIR' && COLLECTION_PATTERNS.test(original) && !SERIES_PATTERNS.test(original)) kindHint = 'collection';
  if (entryType === 'DIR' && /^[A-Z0-9 &'._-]{4,}$/.test(original) && !year && !SERIES_PATTERNS.test(original)) kindHint = 'collection';
  return { title: name || original, year, kindHint };
}

function parseContextBasket(text) {
  const lines = text.split(/\r?\n/);
  let source = 'Source';
  const items = [];
  for (const line of lines) {
    const sourceMatch = line.match(/^name:\s*(.+)$/i);
    if (sourceMatch) { source = sourceMatch[1].trim(); continue; }
    const m = line.match(/^\[(DIR|FILE)\]\s+(.+)$/);
    if (!m) continue;
    const entryType = m[1], raw = m[2].trim();
    if (entryType === 'FILE' && AUX_EXT.test(raw)) continue;
    if (entryType === 'FILE' && !VIDEO_EXT.test(raw)) continue;
    if (/\btrailer\b/i.test(raw)) continue;
    const c = cleanCandidate(raw, entryType);
    if (!c.title || c.title.length < 2) continue;
    const key = norm(c.title).replace(/\b(?:alternate ending|extended|remastered|director s cut|directors cut)\b/g,'').trim() + '|' + (c.year || '');
    items.push({ id: uid(key), key, raw, title: c.title, year: c.year, kindHint: c.kindHint, entryType, source });
  }

  const merged = new Map();
  for (const item of items) {
    if (!merged.has(item.key)) merged.set(item.key, { ...item, sources: [{source:item.source, raw:item.raw}], copies:1 });
    else {
      const x = merged.get(item.key); x.copies++; x.sources.push({source:item.source, raw:item.raw});
      if (x.kindHint === 'movie' && item.kindHint !== 'movie') x.kindHint = item.kindHint;
    }
  }
  return [...merged.values()].sort((a,b)=>a.title.localeCompare(b.title,'fr'));
}

function getViewItem(item) {
  const e = state.enrichments[item.id];
  return e ? { ...item, ...e, enriched:true } : { ...item, media_type:item.kindHint === 'tv' ? 'tv' : item.kindHint === 'collection' ? 'collection' : 'unknown', enriched:false };
}

function formatRuntime(item) {
  if (item.media_type === 'tv') {
    const r = item.episode_run_time?.find(Boolean);
    return r ? `~${r} min/ép.` : item.number_of_seasons ? `${item.number_of_seasons} saison${item.number_of_seasons>1?'s':''}` : '';
  }
  const m = item.runtime;
  if (!m) return '';
  const h = Math.floor(m/60), min = m%60;
  return h ? `${h}h${String(min).padStart(2,'0')}` : `${min} min`;
}
function kindLabel(item) { return item.media_type === 'tv' ? 'SÉRIE' : item.media_type === 'movie' ? 'FILM' : item.media_type === 'collection' ? 'COLLECTION' : 'À IDENTIFIER'; }
function scoreClass(v) { return v >= 7.3 ? 'good' : v >= 6 ? 'mid' : ''; }
function posterUrl(path, size='w185') { return path ? `https://image.tmdb.org/t/p/${size}${path}` : ''; }

function render() {
  const hasLibrary = state.library.length > 0;
  els.onboarding.classList.toggle('hidden', hasLibrary);
  els.app.classList.toggle('hidden', !hasLibrary);
  if (!hasLibrary) return;

  const enrichedCount = state.library.filter(x=>state.enrichments[x.id]).length;
  const items = state.library.map(getViewItem);
  const movies = items.filter(x=>x.media_type==='movie').length;
  const tv = items.filter(x=>x.media_type==='tv').length;
  const collections = items.filter(x=>x.media_type==='collection').length;
  els.stats.innerHTML = [
    `<span class="stat"><strong>${state.library.length}</strong> titres</span>`,
    `<span class="stat"><strong>${movies}</strong> films identifiés</span>`,
    `<span class="stat"><strong>${tv}</strong> séries identifiées</span>`,
    collections ? `<span class="stat"><strong>${collections}</strong> collections</span>` : '',
    `<span class="stat"><strong>${enrichedCount}</strong> enrichis</span>`
  ].join('');
  els.enrichHint.textContent = enrichedCount < state.library.length ? `${state.library.length-enrichedCount} titre(s) restent à enrichir` : 'Bibliothèque enrichie';

  const genres = [...new Set(items.flatMap(x=>(x.genres||[]).map(g=>g.name)))].sort((a,b)=>a.localeCompare(b,'fr'));
  const currentGenre = els.genreFilter.value;
  els.genreFilter.innerHTML = '<option value="all">Tous les genres</option>' + genres.map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
  if (genres.includes(currentGenre)) els.genreFilter.value = currentGenre;

  const filtered = applyFilters(items);
  els.resultCount.textContent = `${filtered.length} résultat${filtered.length>1?'s':''}`;
  els.movieList.innerHTML = '';
  els.emptyState.classList.toggle('hidden', filtered.length !== 0);
  const frag = document.createDocumentFragment();
  for (const item of filtered) frag.appendChild(renderRow(item));
  els.movieList.appendChild(frag);
}

function applyFilters(items) {
  const q = norm(els.searchInput.value);
  const kind = els.kindFilter.value;
  const genre = els.genreFilter.value;
  const rating = Number(els.ratingFilter.value);
  const maxRuntime = Number(els.runtimeFilter.value);
  let out = items.filter(item => {
    if (kind !== 'all' && item.media_type !== kind) return false;
    if (genre !== 'all' && !(item.genres||[]).some(g=>g.name===genre)) return false;
    if (rating && (item.vote_average||0) < rating) return false;
    if (maxRuntime && item.media_type==='movie' && (!item.runtime || item.runtime > maxRuntime)) return false;
    if (q) {
      const hay = norm([item.title,item.display_title,item.original_title,item.cast?.join(' '),item.keywords?.join(' '),(item.genres||[]).map(g=>g.name).join(' '),item.overview].filter(Boolean).join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sort = els.sortSelect.value;
  if (sort === 'rating') out.sort((a,b)=>(b.vote_average||0)-(a.vote_average||0));
  else if (sort === 'year') out.sort((a,b)=>(b.release_year||b.year||0)-(a.release_year||a.year||0));
  else if (sort === 'random') out.sort((a,b)=>pseudoRandom(a.id+state.randomSeed)-pseudoRandom(b.id+state.randomSeed));
  else out.sort((a,b)=>(a.display_title||a.title).localeCompare(b.display_title||b.title,'fr'));
  return out;
}
function pseudoRandom(s){ let h=0; for(const c of s) h=Math.imul(31,h)+c.charCodeAt(0)|0; return ((h>>>0)%100000)/100000; }

function renderRow(item) {
  const node = els.rowTemplate.content.firstElementChild.cloneNode(true);
  const main = node.querySelector('.row-main');
  const title = item.display_title || item.title;
  node.querySelector('.row-title').textContent = title;
  node.querySelector('.row-year').textContent = item.release_year || item.year || '';
  const kind = node.querySelector('.row-kind'); kind.textContent = kindLabel(item); kind.classList.add(item.media_type || 'unknown');
  const poster = node.querySelector('.poster-mini');
  const p = posterUrl(item.poster_path,'w92');
  if (p) { poster.src=p; poster.onload=()=>poster.classList.add('loaded'); }
  const genreText = (item.genres||[]).slice(0,3).map(g=>g.name).join(' · ');
  const castText = (item.cast||[]).slice(0,2).join(', ');
  node.querySelector('.row-meta').textContent = [genreText, castText].filter(Boolean).join('  •  ') || (item.enriched ? '' : 'Métadonnées à enrichir');
  node.querySelector('.row-tags').textContent = (item.keywords||[]).slice(0,5).join(' · ') || (item.copies>1 ? `${item.copies} copies détectées` : '');
  const rating = node.querySelector('.rating');
  if (item.vote_average) { rating.textContent = `★ ${item.vote_average.toFixed(1)}`; rating.classList.add(scoreClass(item.vote_average)); }
  else rating.textContent = '—';
  node.querySelector('.runtime').textContent = formatRuntime(item);
  const details = node.querySelector('.details');
  main.addEventListener('click', () => {
    const opening = details.classList.contains('hidden');
    if (opening && !details.dataset.rendered) { details.innerHTML = detailHTML(item); details.dataset.rendered='1'; }
    details.classList.toggle('hidden'); node.classList.toggle('open');
  });
  return node;
}

function detailHTML(item) {
  const img = posterUrl(item.poster_path,'w342');
  const facts = [];
  if (item.director) facts.push(['Réalisation',item.director]);
  if (item.media_type==='tv' && item.creators?.length) facts.push(['Création',item.creators.join(', ')]);
  if (item.release_year || item.year) facts.push(['Année',item.release_year || item.year]);
  const rt = formatRuntime(item); if (rt) facts.push(['Durée',rt]);
  if (item.vote_average) facts.push(['TMDB',`${item.vote_average.toFixed(1)}/10 · ${item.vote_count||0} votes`]);
  if (item.media_type==='tv' && item.number_of_episodes) facts.push(['Épisodes',item.number_of_episodes]);
  return `<div class="detail-grid">
    <div>${img?`<img class="detail-poster" src="${img}" alt="">`:'<div class="detail-poster"></div>'}</div>
    <div>
      <div class="detail-title">${escapeHtml(item.display_title||item.title)}</div>
      <div class="detail-overview">${escapeHtml(item.overview || 'Pas de synopsis disponible pour ce titre.')}</div>
      <div class="detail-facts">${facts.map(([k,v])=>`<div class="fact"><strong>${escapeHtml(k)}</strong>${escapeHtml(String(v))}</div>`).join('')}</div>
      <div class="detail-chips">${[...(item.genres||[]).map(g=>g.name), ...(item.keywords||[]).slice(0,10)].map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join('')}</div>
      ${(item.cast||[]).length?`<p><strong>Distribution :</strong> ${escapeHtml(item.cast.slice(0,8).join(', '))}</p>`:''}
      <div class="source-list"><strong>Dans ta bibliothèque</strong>${(item.sources||[]).map(s=>`<div>${escapeHtml(s.source)} · ${escapeHtml(s.raw)}</div>`).join('')}</div>
    </div>
  </div>`;
}

function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function importFile(file) {
  const text = await file.text();
  const parsed = parseContextBasket(text);
  if (!parsed.length) return alert('Je ne trouve aucune ligne [DIR] ou [FILE] exploitable dans ce fichier.');
  state.library = parsed;
  saveJSON(STORAGE.library, state.library);
  render();
}

async function tmdbFetch(path, token) {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, { headers:{Authorization:`Bearer ${token}`,Accept:'application/json'} });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

function pickBestResult(results, item) {
  const candidates = results.filter(r=>r.media_type==='movie' || r.media_type==='tv');
  if (!candidates.length) return null;
  const target = norm(item.title);
  const targetYear = item.year;
  const score = r => {
    const t = norm(r.title || r.name || '');
    const original = norm(r.original_title || r.original_name || '');
    let s = 0;
    if (t === target || original === target) s += 100;
    else if (t.includes(target) || target.includes(t) || original.includes(target) || target.includes(original)) s += 55;
    else {
      const aw = new Set(target.split(' ')), bw = new Set(t.split(' '));
      const overlap = [...aw].filter(x=>bw.has(x)).length / Math.max(aw.size,bw.size,1);
      s += overlap*50;
    }
    const y = Number((r.release_date || r.first_air_date || '').slice(0,4)) || null;
    if (targetYear && y) s += Math.max(0, 28 - Math.abs(targetYear-y)*14);
    if (item.kindHint==='tv' && r.media_type==='tv') s += 18;
    if (item.kindHint==='movie' && r.media_type==='movie') s += 8;
    s += Math.min(10, Math.log10((r.vote_count||0)+1)*2);
    return s;
  };
  return candidates.map(r=>({r,s:score(r)})).sort((a,b)=>b.s-a.s)[0];
}

async function enrichOne(item, token) {
  if (item.kindHint === 'collection') return { media_type:'collection', display_title:item.title, release_year:item.year || null, match_status:'collection' };
  const params = new URLSearchParams({query:item.title,language:'fr-FR',include_adult:'false'});
  const search = await tmdbFetch(`/search/multi?${params}`, token);
  let picked = pickBestResult(search.results||[], item);
  if (!picked || picked.s < 32) {
    const fallbackTitle = item.raw.replace(/[._]/g,' ').replace(RELEASE_WORDS,' ').replace(/\[[^\]]*\]/g,' ').replace(VIDEO_EXT,'').replace(/\s+/g,' ').trim();
    const p2 = new URLSearchParams({query:fallbackTitle,language:'fr-FR',include_adult:'false'});
    const search2 = await tmdbFetch(`/search/multi?${p2}`, token);
    picked = pickBestResult(search2.results||[], item);
  }
  if (!picked || picked.s < 28) return { media_type:'unknown', display_title:item.title, release_year:item.year || null, match_status:'not_found' };
  const r = picked.r, type = r.media_type;
  const append = type==='movie' ? 'credits,keywords' : 'aggregate_credits,keywords';
  const d = await tmdbFetch(`/${type}/${r.id}?language=fr-FR&append_to_response=${encodeURIComponent(append)}`, token);
  const credits = type==='movie' ? d.credits : d.aggregate_credits;
  const cast = (credits?.cast||[]).sort((a,b)=>(a.order??999)-(b.order??999)).slice(0,10).map(x=>x.name);
  const crew = type==='movie' ? (d.credits?.crew||[]) : [];
  const director = crew.find(x=>x.job==='Director')?.name || null;
  const kw = type==='movie' ? (d.keywords?.keywords||[]) : (d.keywords?.results||[]);
  return {
    tmdb_id:d.id, media_type:type, display_title:d.title || d.name || item.title,
    original_title:d.original_title || d.original_name || null,
    release_year:Number((d.release_date || d.first_air_date || '').slice(0,4)) || item.year || null,
    genres:d.genres||[], runtime:d.runtime||null, episode_run_time:d.episode_run_time||[],
    vote_average:d.vote_average||null, vote_count:d.vote_count||null, overview:d.overview||'',
    poster_path:d.poster_path||null, backdrop_path:d.backdrop_path||null, cast, director,
    creators:(d.created_by||[]).map(x=>x.name), keywords:kw.slice(0,14).map(x=>x.name),
    number_of_seasons:d.number_of_seasons||null, number_of_episodes:d.number_of_episodes||null,
    match_status:'matched', match_score:Math.round(picked.s)
  };
}

async function enrichLibrary() {
  const token = localStorage.getItem(STORAGE.token);
  if (!token) return alert('Ajoute d’abord ton API Read Access Token TMDB.');
  state.stopEnrich = false;
  els.stopEnrichBtn.classList.remove('hidden'); els.enrichProgressWrap.classList.remove('hidden');
  const todo = state.library.filter(x=>!state.enrichments[x.id] || state.enrichments[x.id].match_status==='not_found');
  if (!todo.length) { els.enrichProgressText.textContent='Tout est déjà enrichi.'; return; }
  let done = 0;
  for (const item of todo) {
    if (state.stopEnrich) break;
    try { state.enrichments[item.id] = await enrichOne(item, token); }
    catch (e) {
      if (String(e.message).includes('401')) { alert('Token TMDB refusé. Vérifie le token.'); break; }
      state.enrichments[item.id] = { media_type:'unknown', display_title:item.title, release_year:item.year || null, match_status:'error', error:String(e.message) };
    }
    done++; saveJSON(STORAGE.enrichments, state.enrichments);
    const pct = Math.round(done/todo.length*100);
    els.enrichProgressBar.style.width = pct+'%';
    els.enrichProgressText.textContent = `${done}/${todo.length} · ${item.title}`;
    if (done % 10 === 0) render();
    await new Promise(r=>setTimeout(r,120));
  }
  render();
  els.stopEnrichBtn.classList.add('hidden');
  els.enrichProgressText.textContent = state.stopEnrich ? `Arrêté après ${done} titre(s).` : `Terminé : ${done} titre(s) traités.`;
}

function exportCatalog() {
  const blob = new Blob([JSON.stringify(state.library.map(getViewItem),null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='choosemovie-catalog.json'; a.click(); URL.revokeObjectURL(a.href);
}

els.importBtn.addEventListener('click',()=>els.fileInput.click());
els.onboardingImportBtn.addEventListener('click',()=>els.fileInput.click());
els.fileInput.addEventListener('change',()=>{ const f=els.fileInput.files?.[0]; if(f) importFile(f); els.fileInput.value=''; });
els.settingsBtn.addEventListener('click',()=>{ els.tokenInput.value=localStorage.getItem(STORAGE.token)||''; els.settingsDialog.showModal(); });
els.saveTokenBtn.addEventListener('click',()=>{ const t=els.tokenInput.value.trim(); if(!t) return alert('Colle ton token TMDB.'); localStorage.setItem(STORAGE.token,t); alert('Token enregistré localement.'); });
els.enrichBtn.addEventListener('click', enrichLibrary);
els.stopEnrichBtn.addEventListener('click',()=>{ state.stopEnrich=true; });
els.exportBtn.addEventListener('click',exportCatalog);
els.resetBtn.addEventListener('click',()=>{ if(!confirm('Effacer la bibliothèque locale et les métadonnées enrichies ?')) return; localStorage.removeItem(STORAGE.library); localStorage.removeItem(STORAGE.enrichments); state.library=[]; state.enrichments={}; els.settingsDialog.close(); render(); });
els.randomBtn.addEventListener('click',()=>{ state.randomSeed++; els.sortSelect.value='random'; render(); });
els.clearSearchBtn.addEventListener('click',()=>{els.searchInput.value='';render();});
['input','change'].forEach(evt=>els.searchInput.addEventListener(evt,render));
[els.kindFilter,els.genreFilter,els.ratingFilter,els.runtimeFilter,els.sortSelect].forEach(el=>el.addEventListener('change',render));

render();
