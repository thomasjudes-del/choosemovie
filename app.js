const DATA=(window.CHOOSE_DATA||[]).map(x=>({
  title:x.t,year:x.y||null,kind:x.k||'movie',copies:x.c||1,enriched:!!x.e,
  r:x.r??null,d:x.d??null,g:x.g||[],a:x.a||[],k:x.w||[],s:x.s||'',
  poster:x.p||'',director:x.dir||'',imdb:x.id||'',loc:x.loc||[],
  key:((x.t||'')+'|'+(x.y||''))
}));

let seed=1;
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
  ['climat',/climate|environment|pollution/],['île',/island/],['huis clos',/bunker|trapped|locked|confined/]
];

function kindLabel(k){return k==='tv'?'SÉRIE':k==='collection'?'COLLECTION':k==='unknown'?'À IDENTIFIER':'FILM'}
function fmtDur(m){if(!m)return'';let h=Math.floor(m/60),n=m%60;return h?(h+'h'+String(n).padStart(2,'0')):(m+' min')}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function genreLabel(g){return GENRE_FR[g]||g}

function microKeywords(x){
  const out=[...(x.k||[])];
  const text=norm([x.s,(x.g||[]).join(' '),x.title].join(' '));
  for(const [label,re] of TOPICS){
    if(out.length>=4)break;
    if(re.test(text) && !out.some(v=>norm(v)===norm(label))) out.push(label);
  }
  return out.slice(0,4);
}

function posterUrl(x){
  if(x.imdb) return 'https://images.metahub.space/poster/medium/'+encodeURIComponent(x.imdb)+'/img';
  return x.poster||'';
}

function getGenres(){
  return [...new Set(DATA.flatMap(x=>x.g||[]))].sort((a,b)=>genreLabel(a).localeCompare(genreLabel(b),'fr'));
}
for(const g of getGenres()) $('genre').insertAdjacentHTML('beforeend',`<option value="${esc(g)}">${esc(genreLabel(g))}</option>`);

function filtered(){
  let q=norm($('q').value),type=$('type').value,genre=$('genre').value,r=+$('rating').value,d=+$('dur').value;
  let a=DATA.filter(x=>{
    if(type!=='all'&&x.kind!==type)return false;
    if(genre!=='all'&&!(x.g||[]).includes(genre))return false;
    if(r&&(!x.r||x.r<r))return false;
    if(d&&(!x.d||x.d>d))return false;
    if(q){
      let hay=norm([x.title,x.year,(x.g||[]).join(' '),(x.a||[]).join(' '),microKeywords(x).join(' '),x.s,x.director,(x.loc||[]).map(l=>l.p).join(' ')].join(' '));
      if(!hay.includes(q))return false;
    }
    return true;
  });
  let s=$('sort').value;
  if(s==='rating')a.sort((x,y)=>(y.r||-1)-(x.r||-1));
  else if(s==='year')a.sort((x,y)=>(y.year||0)-(x.year||0));
  else if(s==='random')a.sort((x,y)=>rand(x.key+seed)-rand(y.key+seed));
  else a.sort((x,y)=>x.title.localeCompare(y.title,'fr'));
  return a;
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
    const fileUrl='file:///'+folder.replace(/\\/g,'/');
    return `<div class="location-row">
      <div class="location-text">
        <strong>${esc(l.s||'Source')}</strong>
        <code title="${esc(l.p)}">${esc(l.p)}</code>
      </div>
      <div class="location-actions">
        <a class="mini-btn open-local" href="${esc(fileUrl)}" target="_blank" rel="noreferrer">📁 Ouvrir</a>
        <button class="mini-btn copy-path" type="button" data-path="${esc(l.p)}">Copier</button>
      </div>
    </div>`;
  }).join('');
}

function row(x){
  const genres=(x.g||[]).slice(0,2).map(genreLabel);
  const actors=(x.a||[]).slice(0,2);
  const words=microKeywords(x).slice(0,3);
  return `<article class="row">
    <div class="mainrow">
      <div class="scanline">
        <span class="title" title="${esc(x.title)}">${esc(x.title)}</span>
        <span class="year">${x.year?'('+x.year+')':''}</span>
        <span class="badge ${x.kind}">${kindLabel(x.kind)}</span>
        ${genres.length?`<span class="genres">${esc(genres.join(' / '))}</span>`:''}
        <span class="rating-inline">${x.r?'★ '+x.r.toFixed(1):'★ —'}</span>
        <span class="duration-inline">${fmtDur(x.d)||'—'}</span>
        ${actors.length?`<span class="actors">${esc(actors.join(', '))}</span>`:''}
        ${words.length?`<span class="keywords">${esc(words.join(' · '))}</span>`:''}
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
              <div class="detailtitle">${esc(x.title)} ${x.year?'<span>('+x.year+')</span>':''}</div>
              <div class="detailmeta">
                <span class="badge ${x.kind}">${kindLabel(x.kind)}</span>
                ${x.r?`<span class="detailrating">★ ${x.r.toFixed(1)} IMDb</span>`:''}
                ${x.d?`<span>${fmtDur(x.d)}</span>`:''}
                ${(x.g||[]).length?`<span>${esc((x.g||[]).map(genreLabel).join(' / '))}</span>`:''}
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

['q','type','genre','rating','dur','sort'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',render));
$('random').onclick=()=>{$('sort').value='random';seed++;render();window.scrollTo({top:0,behavior:'smooth'})};

render();