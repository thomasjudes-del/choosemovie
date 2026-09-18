const ENRICH=window.CHOOSE_ENRICH||{};
const DATA=(window.CHOOSE_DATA||[]).map(x=>{
  const key=((x.t||'')+'|'+(x.y||''));
  const e=ENRICH[key]||{};
  return {
    title:x.t,
    year:x.y||e.y||null,
    kind:x.k||e.kind||'movie',
    copies:x.c||1,
    enriched:!!x.e||!!e.matched,
    r:x.r||e.r||null,
    d:x.d||e.d||null,
    g:(x.g&&x.g.length)?x.g:(e.g||[]),
    a:(x.a&&x.a.length)?x.a:(e.a||[]),
    k:(x.w&&x.w.length)?x.w:(e.w||[]),
    s:x.s||e.s||'',
    poster:x.p2||e.p||x.p||'',
    director:x.dir||e.dir||'',
    imdb:x.id||e.id||'',
    key
  };
});
let onlyReady=false,seed=1;
const $=id=>document.getElementById(id);
const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function kindLabel(k){return k==='tv'?'SÉRIE':k==='collection'?'COLLECTION':'FILM'}
function fmtDur(m){if(!m)return'';let h=Math.floor(m/60),n=m%60;return h?(h+'h'+String(n).padStart(2,'0')):(m+' min')}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function getGenres(){return [...new Set(DATA.flatMap(x=>x.g||[]))].sort((a,b)=>a.localeCompare(b,'fr'))}
for(const g of getGenres()) $('genre').insertAdjacentHTML('beforeend',`<option>${esc(g)}</option>`);

function filtered(){
  let q=norm($('q').value),type=$('type').value,genre=$('genre').value,r=+$('rating').value,d=+$('dur').value;
  let a=DATA.filter(x=>{
    if(onlyReady&&!x.enriched)return false;
    if(type!=='all'&&x.kind!==type)return false;
    if(genre!=='all'&&!(x.g||[]).includes(genre))return false;
    if(r&&(!x.r||x.r<r))return false;
    if(d&&(!x.d||x.d>d))return false;
    if(q){
      let hay=norm([x.title,x.year,(x.g||[]).join(' '),(x.a||[]).join(' '),(x.k||[]).join(' '),x.s,x.director].join(' '));
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
  const a=filtered(),en=DATA.filter(x=>x.enriched).length,tv=DATA.filter(x=>x.kind==='tv').length,coll=DATA.filter(x=>x.kind==='collection').length;
  $('stats').innerHTML=`<span class=pill><b>${DATA.length}</b> titres</span><span class=pill><b>${en}</b> enrichis</span><span class=pill><b>${tv}</b> séries</span><span class=pill><b>${coll}</b> collections</span><span class=pill><b>${a.length}</b> affichés</span>`;
  $('list').innerHTML=a.map(row).join('');
  $('empty').hidden=a.length>0;
  document.querySelectorAll('.mainrow').forEach(el=>el.onclick=()=>{
    const row=el.parentElement;
    const opening=!row.classList.contains('open');
    document.querySelectorAll('.row.open').forEach(r=>r.classList.remove('open'));
    if(opening) row.classList.add('open');
  });
}

function row(x){
  const genres=(x.g||[]).slice(0,3).join(' · ');
  const actors=(x.a||[]).slice(0,2).join(', ');
  const words=(x.k||[]).slice(0,4).join(' · ');
  const summary=x.s||(!x.enriched?'métadonnées à compléter':'');
  return `<article class=row>
    <div class=mainrow>
      <div class=scanline>
        <span class=title>${esc(x.title)}</span>
        <span class=year>${x.year?'('+x.year+')':''}</span>
        <span class="badge ${x.kind}">${kindLabel(x.kind)}</span>
        ${genres?`<span class=genres>${esc(genres)}</span>`:''}
        ${actors?`<span class=actors>${esc(actors)}</span>`:''}
        ${words?`<span class=keywords>${esc(words)}</span>`:''}
        ${summary?`<span class=summary>${esc(summary)}</span>`:''}
      </div>
      <div class=right>
        <span class=rating>${x.r?'★ '+x.r.toFixed(1):'—'}</span>
        <span class=dur>${fmtDur(x.d)||'—'}</span>
        <span class=arrow>⌄</span>
      </div>
    </div>
    <div class=details>
      <div class=detailgrid>
        <div class=posterwrap>${x.poster?`<img class=poster src="${esc(x.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="posterplaceholder posterfallback" style="display:none">Pas de visuel</div>`:`<div class=posterplaceholder>Pas de visuel</div>`}</div>
        <div>
          <div class=detailtitle>${esc(x.title)} ${x.year?'('+x.year+')':''}</div>
          <p class=syn>${esc(x.s||'Pas de synopsis disponible pour ce titre.')}</p>
          <div class=chips>${[...(x.g||[]),...(x.k||[])].map(c=>`<span class=chip>${esc(c)}</span>`).join('')}</div>
          <div class=facts>
            ${x.r?`<span><b>IMDb</b> ${x.r.toFixed(1)}/10</span>`:''}
            ${x.d?`<span><b>Durée</b> ${fmtDur(x.d)}</span>`:''}
            ${x.director?`<span><b>Réalisation</b> ${esc(x.director)}</span>`:''}
            ${(x.a||[]).length?`<span><b>Avec</b> ${esc(x.a.slice(0,8).join(', '))}</span>`:''}
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

['q','type','genre','rating','dur','sort'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',render));
$('random').onclick=()=>{$('sort').value='random';seed++;render();window.scrollTo({top:0,behavior:'smooth'})};

render();