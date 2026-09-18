const RAW_DATA=(window.CHOOSE_DATA||[]).map(x=>({
  title:x.t,year:x.y||null,kind:x.k||'movie',copies:x.c||1,enriched:!!x.e,
  r:x.r??null,d:x.d??null,g:x.g||[],a:x.a||[],k:x.w||[],s:x.s||'',
  poster:x.p||'',director:x.dir||'',imdb:x.id||'',loc:x.loc||[],
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

let seed=1;
let randomFive=null;
let previousRandomKeys=new Set();
const $=id=>document.getElementById(id);
const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

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

function displayTitle(x){
  const locs=[...(x.loc||[])].sort((a,b)=>locationRank(a)-locationRank(b));
  const vf=locs.find(l=>isFrenchMarked(sourceRaw(l)));
  if(vf){
    const t=cleanLocalTitle(sourceRaw(vf),x.year);
    if(t.length>1) return t;
  }
  const frenchish=locs.find(l=>looksFrenchTitle(sourceRaw(l)));
  if(frenchish){
    const t=cleanLocalTitle(sourceRaw(frenchish),x.year);
    if(t.length>1 && looksFrenchTitle(t)) return t;
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

function microPitch(x){
  let t=(x.s||'').replace(/\s+/g,' ').trim();
  if(!t) return x.kind==='collection' ? 'Collection à explorer' : '';
  const max=145;
  if(t.length<=max) return t;
  const cut=t.slice(0,max);
  const safe=cut.slice(0,Math.max(cut.lastIndexOf(' '),105));
  return safe.replace(/[,:;\s]+$/,'')+'…';
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
  $('stats').innerHTML=`
    <span class=pill><b>${DATA.length}</b> titres</span>
    <span class=pill><b>${en}</b> enrichis</span>
    <span class=pill><b>${tv}</b> séries</span>
    <span class=pill><b>${DATA.filter(x=>x.loc?.length).length}</b> localisés</span>
    <span class=pill><b>${a.length}</b> affichés</span>`;
  $('list').innerHTML=a.map(row).join('');
  $('empty').hidden=a.length>0;

  document.querySelectorAll('.mainrow').forEach(el=>el.onclick=()=>{
    const rowEl=el.closest('.row');
    const opening=!rowEl.classList.contains('open');
    document.querySelectorAll('.row.open').forEach(r=>r.classList.remove('open'));
    if(opening) rowEl.classList.add('open');
  });
}

function locationHtml(x){
  if(!x.loc?.length) return `<div class="location-empty">Emplacement local non retrouvé automatiquement.</div>`;
  return x.loc.map((l,i)=>{
    const isFile=l.t==='FILE';
    const folder=isFile?l.p.replace(/\\[^\\]+$/,''):l.p;
    const filename=isFile?l.p.split('\\').pop():'';
    const explorerUrl='search-ms:'+(filename?'query='+encodeURIComponent(filename)+'&':'')+'crumb=location:'+encodeURIComponent(folder);
    return `<div class="location-row">
      <div class="location-text">
        <strong>${esc(l.s||'Source')}</strong>
        <code title="${esc(l.p)}">${esc(l.p)}</code>
      </div>
      <div class="location-actions">
        <a class="mini-btn open-local" href="${esc(explorerUrl)}" title="Ouvrir cet emplacement dans l’Explorateur Windows">📁 Explorer</a>
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
            <div class="section-label">Synopsis</div>
            <p class="syn">${esc(x.s||'Pas de synopsis fiable disponible pour ce titre.')}</p>
          </div>

          <div class="detail-facts">
            ${x.director?`<div><strong>Réalisation</strong><span>${esc(x.director)}</span></div>`:''}
            ${(x.a||[]).length?`<div><strong>Distribution</strong><span>${esc(x.a.join(', '))}</span></div>`:''}
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

['q','type','genre','rating','dur','sort'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',()=>{
  randomFive=null;
  previousRandomKeys=new Set();
  render();
}));
$('random').onclick=pickRandomFive;

render();