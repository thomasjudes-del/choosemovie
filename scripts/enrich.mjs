import fs from 'node:fs';
import vm from 'node:vm';

const ctx={window:{}};
vm.createContext(ctx);
for(const file of ['data-01.js','data-02.js','data-03.js','data-04.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
}
const source=ctx.window.CHOOSE_DATA||[];

function cleanTitle(s=''){
  return s
    .replace(/https?:\/\/\S+/gi,' ')
    .replace(/\b(?:1080p|720p|2160p|4k|bluray|brrip|webrip|web[- .]?dl|dvdrip|hdtv|x264|x265|hevc|divx|vostfr|truefrench|french|multi|vf|vo|fr|eng|yts|mx|rarbg|galaxyrg|eztv|www|complete|remastered|extended|unrated)\b/gi,' ')
    .replace(/\[[^\]]*\]/g,' ')
    .replace(/\([^)]*(?:rip|encod|torrent|tested|testé|www|divx|dvd|hd)[^)]*\)/gi,' ')
    .replace(/[._]+/g,' ')
    .replace(/\s+/g,' ')
    .replace(/\s+-\s+.*$/,'')
    .trim();
}
function norm(s=''){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function tokens(s=''){return new Set(norm(s).split(' ').filter(x=>x.length>1))}
function yearOf(x){
  const m=String(x?.releaseInfo||x?.year||x?.released||'').match(/\b(19\d{2}|20\d{2})\b/);
  return m?Number(m[1]):null;
}
function sim(a,b){
  a=norm(a);b=norm(b);
  if(!a||!b)return 0;
  if(a===b)return 100;
  if(a.includes(b)||b.includes(a))return 82;
  const A=tokens(a),B=tokens(b),inter=[...A].filter(x=>B.has(x)).length;
  const union=new Set([...A,...B]).size||1;
  return (inter/union)*75;
}
function scoreCandidate(item,c){
  const base=sim(cleanTitle(item.t),c.name||'');
  let s=base;
  const iy=item.y||null, cy=yearOf(c);
  if(iy&&cy){
    const diff=Math.abs(iy-cy);
    s += diff===0?24:diff===1?12:diff===2?4:-Math.min(36,diff*6);
  }
  const want=item.k==='tv'?'series':'movie';
  if(c.type===want)s+=8;
  return s;
}
function parseRuntime(v){
  if(!v)return null;
  if(typeof v==='number')return v;
  const s=String(v).toLowerCase();
  const h=s.match(/(\d+)\s*h/), m=s.match(/(\d+)\s*(?:m|min)/);
  if(h)return Number(h[1])*60+(m?Number(m[1]):0);
  const n=s.match(/\b(\d{2,3})\b/);
  return n?Number(n[1]):null;
}
function peopleFromLinks(meta,category){
  return (meta.links||[]).filter(x=>x.category===category).map(x=>x.name).filter(Boolean);
}
async function getJson(url,retries=2){
  for(let i=0;i<=retries;i++){
    try{
      const r=await fetch(url,{headers:{'user-agent':'ChooseMovie/1.0'},signal:AbortSignal.timeout(8000)});
      if(r.ok)return await r.json();
      if(i===retries)throw new Error(String(r.status));
    }catch(e){
      if(i===retries)throw e;
    }
    await new Promise(r=>setTimeout(r,500*(i+1)));
  }
}
async function search(type,title){
  const url='https://v3-cinemeta.strem.io/catalog/'+type+'/top/search='+encodeURIComponent(title)+'.json';
  const j=await getJson(url);
  return j.metas||j.metasDetailed||[];
}
async function detail(type,id){
  const j=await getJson('https://v3-cinemeta.strem.io/meta/'+type+'/'+id+'.json');
  return j.meta||null;
}
async function enrichOne(item,index){
  if(item.k==='collection')return {...item,e:item.e||0};
  const q=cleanTitle(item.t);
  if(q.length<2)return {...item,e:item.e||0};
  const preferred=item.k==='tv'?'series':'movie';
  let candidates=[];
  try{candidates=await search(preferred,q)}catch{}
  if(!candidates.length){
    try{candidates=await search(preferred==='movie'?'series':'movie',q)}catch{}
  }
  const ranked=candidates.map(c=>({c,s:scoreCandidate(item,c)})).sort((a,b)=>b.s-a.s);
  const best=ranked[0];
  if(!best||best.s<68)return {...item,e:item.e||0};
  let meta=best.c;
  try{meta=await detail(best.c.type,best.c.id)||best.c}catch{}
  const cast=(Array.isArray(meta.cast)?meta.cast:peopleFromLinks(meta,'actor')).filter(Boolean);
  const directors=(Array.isArray(meta.director)?meta.director:peopleFromLinks(meta,'director')).filter(Boolean);
  const genres=(meta.genres||peopleFromLinks(meta,'genre')).filter(Boolean);
  const y=yearOf(meta)||item.y||null;
  const rating=Number(meta.imdbRating||best.c.imdbRating)||item.r||null;
  return {
    t:meta.name||best.c.name||item.t,
    y,
    k:best.c.type==='series'?'tv':'movie',
    c:item.c||1,
    e:1,
    r:rating?Number(rating):null,
    d:parseRuntime(meta.runtime)||item.d||null,
    g:genres.length?genres:item.g||[],
    a:cast.length?cast.slice(0,12):item.a||[],
    w:item.w||[],
    s:meta.description||best.c.description||item.s||'',
    p:meta.poster||best.c.poster||item.p||'',
    dir:directors.join(', ')||item.dir||'',
    id:best.c.id||item.id||'',
    ms:Math.round(best.s)
  };
}

const out=new Array(source.length);
let cursor=0,done=0,matched=0;
const workers=12;
async function worker(){
  while(true){
    const i=cursor++;
    if(i>=source.length)return;
    try{out[i]=await enrichOne(source[i],i)}
    catch(e){out[i]={...source[i],err:String(e.message||e)}}
    done++; if(out[i]?.e)matched++;
    if(done%25===0||done===source.length)console.log('progress',done+'/'+source.length,'enriched',matched);
    await new Promise(r=>setTimeout(r,25));
  }
}
await Promise.all(Array.from({length:workers},worker));

const chunks=4, size=Math.ceil(out.length/chunks);
for(let i=0;i<chunks;i++){
  const chunk=out.slice(i*size,(i+1)*size);
  fs.writeFileSync('data-0'+(i+1)+'.js','window.CHOOSE_DATA=(window.CHOOSE_DATA||[]).concat('+JSON.stringify(chunk)+');\n');
}
const unmatched=out.filter(x=>!x.e).map(x=>({title:x.t,year:x.y||null,kind:x.k||'movie'}));
fs.writeFileSync('unmatched.json',JSON.stringify(unmatched,null,2)+'\n');
console.log('DONE',JSON.stringify({total:out.length,enriched:out.filter(x=>x.e).length,unmatched:unmatched.length}));
