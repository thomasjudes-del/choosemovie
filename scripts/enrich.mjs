import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const FILES=['data-01.js','data-02.js','data-03.js','data-04.js'];
const SOURCE_REF='82814ebbc01f0f0380f00d0f9e575dacc53b29a6';

function loadCatalog(contentsByFile){
  const ctx={window:{}};
  vm.createContext(ctx);
  for(const [file,content] of contentsByFile){
    vm.runInContext(content,ctx,{filename:file});
  }
  return ctx.window.CHOOSE_DATA||[];
}

const existing=loadCatalog(FILES.map(file=>[file,fs.readFileSync(file,'utf8')]));
let source;
try{
  source=loadCatalog(FILES.map(file=>[
    file,
    execFileSync('git',['show',SOURCE_REF+':'+file],{encoding:'utf8'})
  ]));
}catch(e){
  console.warn('Could not load original catalog ref, using current catalog:',String(e.message||e));
  source=existing.map(x=>({...x}));
}

const ALIASES=new Map([
  ["3 BODY PROBLEM",{q:"3 Body Problem",type:"series"}],
  ["Butch Cassidy et le Kid",{q:"Butch Cassidy and the Sundance Kid"}],
  ["C'Est Arrive Pres De Chez Vous Fr Par Subbass -dvdphoenix fr st",{q:"Man Bites Dog"}],
  ["Chantons Sous La Pluie",{q:"Singin' in the Rain"}],
  ["Dikkenek -OTHERS by SYR",{q:"Dikkenek"}],
  ["Dragon Ball Z Doragon Bôru Z - Fukkatsu No 'F'",{q:"Dragon Ball Z: Resurrection 'F'"}],
  ["DUNE PROPHECY",{q:"Dune: Prophecy",type:"series"}],
  ["ENFERMES DEHORS",{q:"Enfermés dehors"}],
  ["Fourmiz",{q:"Antz"}],
  ["Indiana Jones Et La Derniere Croisade",{q:"Indiana Jones and the Last Crusade"}],
  ["James Bond Operation Tonnerre",{q:"Thunderball"}],
  ["Juste cause Sean connery",{q:"Just Cause"}],
  ["Kill Bill Volume 1",{q:"Kill Bill: Vol. 1"}],
  ["La Cite de dieu",{q:"City of God"}],
  ["La Grande Belleza",{q:"The Great Beauty"}],
  ["La Grande Bellezza",{q:"The Great Beauty"}],
  ["La Mélodie Du Bonheur",{q:"The Sound of Music"}],
  ["La Tour Infernale John Guillermin Steve Mcqueen Paul Newman William Holden Faye Dunaway",{q:"The Towering Inferno"}],
  ["La Tour Montparnasse Infernale francais DivX",{q:"La Tour Montparnasse infernale"}],
  ["Lawrence d'Arabie - Fr - Complet - de David Lean avec Peter O'Toole, Anthony Quinn, Omar Sharif",{q:"Lawrence of Arabia"}],
  ["Le 13eme Guerrier DivX-Notag",{q:"The 13th Warrior"}],
  ["Le Bon La Brute et le Truand Version",{q:"The Good, the Bad and the Ugly"}],
  ["Le Cauchemar De Darwin VOST",{q:"Darwin's Nightmare"}],
  ["Le Cercle Des Poetes Disparus",{q:"Dead Poets Society"}],
  ["Le Clan Des Siciliens",{q:"The Sicilian Clan"}],
  ["Le Gout Des Autres (Agnes Jaoui, Jpierre Bacri, Alain Chabat, Gerard Lanvin)",{q:"The Taste of Others"}],
  ["Le Mur de l'Atlantique",{q:"The Atlantic Wall"}],
  ["Le Nom De La Rose",{q:"The Name of the Rose"}],
  ["LE PLUS BEAU DES COMBATS",{q:"Remember the Titans"}],
  ["Le Premier Jour Du Reste De Ta Vie -GKS",{q:"The First Day of the Rest of Your Life"}],
  ["Le Roi Lion",{q:"The Lion King"}],
  ["Le Voyage Du Ballon Rouge",{q:"Flight of the Red Balloon"}],
  ["Les 55 Jours de Pekin",{q:"55 Days at Peking"}],
  ["Les Fantomes De Goya Goyas Ghosts",{q:"Goya's Ghosts"}],
  ["Les rivieres pourpres",{q:"The Crimson Rivers"}],
  ["Les Seigneurs de la Guerre",{q:"The Warlords"}],
  ["Les Sept Mercenaires",{q:"The Magnificent Seven"}],
  ["Les Tontons Flingueurs (Benard Blier, Lino Ventura)",{q:"Crooks in Clover"}],
  ["Les Traducteurs",{q:"The Translators"}],
  ["Louis De Funès - Faites sauter la banque",{q:"Faites sauter la banque"}],
  ["Louis De Funes - La Folies Des Grandeurs",{q:"Delusions of Grandeur"}],
  ["Louis De Funès - Le Gentleman D'Epsom",{q:"The Gentleman from Epsom"}],
  ["louis de funes Le Petit Baigneur Fr -Dvd Rip Par Mikemarie(Excellent) testé",{q:"The Little Bather"}],
  ["Louis De Funes - Pouic Pouic Fr",{q:"Pouic-Pouic"}],
  ["Louis Funes - La Grande Vadrouille",{q:"La Grande Vadrouille"}],
  ["Louis Funes - La soupe aux choux",{q:"The Cabbage Soup"}],
  ["Louis Funes - LE CORNIAUD",{q:"The Sucker"}],
  ["Louis Funes - Le grand restaurant",{q:"The Restaurant"}],
  ["Louis Funes - Oscar",{q:"Oscar"}],
  ["Louis Funes - Rabbi Jacob",{q:"The Mad Adventures of Rabbi Jacob"}],
  ["Mackennas Gold",{q:"Mackenna's Gold"}],
  ["Mélodie En Sous-Sol - Henri Verneuil - Michel Audiard - Jean Gabin - Alain Delon",{q:"Any Number Can Win"}],
  ["Mépris, Le",{q:"Contempt"}],
  ["Miguel Gomes - Tabu",{q:"Tabu"}],
  ["Mononoke hime - Princess Mononoke",{q:"Princess Mononoke"}],
  ["O Som Ao Redor",{q:"Neighboring Sounds"}],
  ["Papi Fait De La Resistance",{q:"Papy fait de la résistance"}],
  ["Preditors",{q:"Predators"}],
  ["Proposition Indécente",{q:"Indecent Proposal"}],
  ["Season of the Witch",{q:"Season of the Witch",type:"movie"}],
  ["The Queens Gambit",{q:"The Queen's Gambit",type:"series"}],
  ["To Gerard",{q:"To: Gerard"}],
  ["Touchez pas au grisbi",{q:"Touchez pas au grisbi"}],
  ["Transformers 3 - Dark of the Moon",{q:"Transformers: Dark of the Moon"}],
  ["Willy 1er",{q:"Willy 1er"}],
  ["Wonderful Days",{q:"Wonderful Days"}],
  ["Zidane A 21st Century Portrait",{q:"Zidane: A 21st Century Portrait"}]
]);
const COLLECTION_NAMES=new Set([
  "CHRISTOPHER NOLAN dont Batman","DA et ANIMATION","DBZ","DBZ Kai et movies","FILMS EN ARABE ou recents"
]);

const FORCED=new Map([
  ["Dune",{id:"tt1160419",type:"movie"}],
  ["Blade Runner",{id:"tt0083658",type:"movie"}],
  ["Charlie Wilsons War",{id:"tt0472062",type:"movie"}],
  ["conte princesse Kaguya-hime no Monogatari",{id:"tt2576852",type:"movie"}],
  ["Kaguya-hime no Monogatari",{id:"tt2576852",type:"movie"}],
  ["Enki Bilal - Immortel Ad Vitam (fr)",{id:"tt0314063",type:"movie"}],
  ["Festen - Thomas Vinterbergh - Vo St Fr (Rippé & Encodé Par Tilt Lyon)",{id:"tt0154420",type:"movie"}],
  ["Good Morning England TS MD MZISYS",{id:"tt1131729",type:"movie"}],
  ["Inglorious Bastards",{id:"tt0361748",type:"movie"}],
  ["L'Aile Ou La Cuisse - Louis De Funes",{id:"tt0074103",type:"movie"}],
  ["Louis De Funès - L'aile ou la cuisse - DivX Fr",{id:"tt0074103",type:"movie"}],
  ["La Legende Du Scorpion Noir Vrai By Bf15",{id:"tt0465676",type:"movie"}],
  ["La Traversée De Paris (Bourvil, Jean Gabin, Louis De Funes)",{id:"tt0049877",type:"movie"}],
  ["LE CAVE SE REBIFFE FR VVF COOLI",{id:"tt0054734",type:"movie"}],
  ["Le Chacal FR",{id:"tt0069947",type:"movie"}],
  ["Le Clan Des Siciliens",{id:"tt0064169",type:"movie"}],
  ["Le Scaphandre Et Le Papillon Eng hard subs fw",{id:"tt0401383",type:"movie"}],
  ["Le Verdict - eng",{id:"tt0084855",type:"movie"}],
  ["Les Oiseaux - Hitchcock testé par",{id:"tt0056869",type:"movie"}],
  ["Louis Funes - Le grand restaurant",{id:"tt0061728",type:"movie"}],
  ["Louis Funes - Oscar",{id:"tt0062083",type:"movie"}],
  ["Monty Python - And Now for Something Completely Different",{id:"tt0066765",type:"movie"}],
  ["monty python - The Meaning of life",{id:"tt0085959",type:"movie"}],
  ["Monty Pythons - Life of Brian",{id:"tt0079470",type:"movie"}],
  ["Mr Quigley L'australien",{id:"tt0102744",type:"movie"}],
  ["Origin - Spirits Of The Past",{id:"tt0493247",type:"movie"}],
  ["The Realm",{id:"tt7095482",type:"movie"}],
  ["Blanche - Bernie Bonvoisin -- Francais",{id:"tt0302346",type:"movie"}]
]);

const SKIP_MATCH=new Set([
  "A Voix Haute Doc HDTVx264",
  "Arte - Quand les poissons disparaissent",
  "DIEUDONNE - Le Divorce De Patrick",
  "L'orque",
  "National Geographic - Les Orque",
  "Reportage Arte - Les Secrets De La Jungle D'afrique - Les Fourmis - Docu Fr Tvdivx5 11 2P Dodelio",
  "Reportage - Regne Animal - Fourmis Tueuses",
  "Rugby - France vs All-Blacks 06 Oct",
  "Thalassa - Australie - la grande barriere de Corail",
  "Thalassa - le mystère des baleines",
  "movie 75095 MPEG2"
]);


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
function scoreCandidate(item,c,query){
  const base=sim(query||cleanTitle(item.t),c.name||'');
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
function strippedOriginal(item){
  return {
    t:item.t,y:item.y||null,k:item.k||'movie',c:item.c||1,e:0,
    r:null,d:null,g:item.g||[],a:[],w:item.w||[],s:'',p:'',dir:'',id:''
  };
}

function resultFromMeta(item,meta,type,id,score=200){
  const cast=(Array.isArray(meta.cast)?meta.cast:peopleFromLinks(meta,'actor')).filter(Boolean);
  const directors=(Array.isArray(meta.director)?meta.director:peopleFromLinks(meta,'director')).filter(Boolean);
  const genres=(meta.genres||peopleFromLinks(meta,'genre')).filter(Boolean);
  const y=yearOf(meta)||item.y||null;
  const rating=Number(meta.imdbRating)||null;
  return {
    t:meta.name||item.t,
    y,
    k:type==='series'?'tv':'movie',
    c:item.c||1,
    e:1,
    r:rating?Number(rating):null,
    d:parseRuntime(meta.runtime)||null,
    g:genres.length?genres:(item.g||[]),
    a:cast.slice(0,12),
    w:item.w||[],
    s:meta.description||'',
    p:meta.poster||'',
    dir:directors.join(', '),
    id,
    ms:score
  };
}

function safeExisting(item,prev){
  if(!prev?.e || !prev.id)return false;
  if(ALIASES.has(item.t) || FORCED.has(item.t) || SKIP_MATCH.has(item.t))return false;
  if(item.y && prev.y && Math.abs(item.y-prev.y)>2)return false;
  const src=tokens(item.t), dst=tokens(prev.t);
  if(dst.size===1 && src.size>=3)return false;
  const similarity=sim(item.t,prev.t);
  if(similarity>=45)return true;
  if((prev.ms||0)>=120 && (!item.y || !prev.y || Math.abs(item.y-prev.y)<=2))return true;
  return false;
}

async function enrichOne(item,index){
  const prev=existing[index];
  if(SKIP_MATCH.has(item.t))return strippedOriginal(item);
  if(COLLECTION_NAMES.has(item.t))return {...strippedOriginal(item),k:'collection',e:1};
  if(item.k==='collection')return {...strippedOriginal(item),k:'collection',e:1};
  const forced=FORCED.get(item.t);
  if(forced){
    try{
      const meta=await detail(forced.type,forced.id);
      if(meta)return resultFromMeta(item,meta,forced.type,forced.id,250);
    }catch(e){
      console.warn('Forced lookup failed',item.t,forced.id,String(e.message||e));
    }
  }
  if(safeExisting(item,prev))return {...prev,w:item.w?.length?item.w:prev.w||[]};
  const alias=ALIASES.get(item.t);
  const q=alias?.q||cleanTitle(item.t);
  if(q.length<2)return {...item,e:item.e||0};
  const preferred=alias?.type||(item.k==='tv'?'series':'movie');
  let candidates=[];
  try{candidates=await search(preferred,q)}catch{}
  let ranked=candidates.map(c=>({c,s:scoreCandidate(item,c,q)})).sort((a,b)=>b.s-a.s);
  if(!ranked.length || ranked[0].s<68){
    try{
      const alt=await search(preferred==='movie'?'series':'movie',q);
      ranked=ranked.concat(alt.map(c=>({c,s:scoreCandidate(item,c,q)}))).sort((a,b)=>b.s-a.s);
    }catch{}
  }
  const best=ranked[0];
  if(!best||best.s<68)return {...item,e:item.e||0};
  let meta=best.c;
  try{meta=await detail(best.c.type,best.c.id)||best.c}catch{}
  const built=resultFromMeta(item,meta,best.c.type,best.c.id,Math.round(best.s));
  if(!built.r && best.c.imdbRating)built.r=Number(best.c.imdbRating)||null;
  if(!built.s)built.s=best.c.description||'';
  if(!built.p)built.p=best.c.poster||'';
  return built;
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
