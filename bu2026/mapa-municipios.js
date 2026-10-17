/* DW Tech | Malha municipal em SVG, obtida por UF sob demanda.
   Dados cartográficos: IBGE (geojson reempacotado por geodata-br, CC0).
   Geometria não contém resultados eleitorais; votos sempre consultados no TSE. */
(()=>{"use strict";
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const UF_ID={AC:12,AL:27,AP:16,AM:13,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,MT:51,MS:50,MG:31,PA:15,PB:25,PR:41,PE:26,PI:22,RJ:33,RN:24,RS:43,RO:11,RR:14,SC:42,SP:35,SE:28,TO:17};
const cache=new Map();
let country=null,openUF="",sequence=0,colorSequence=0,svgCity=null,cityID="";
const WINNER_CACHE_PREFIX="dwtech-bu2026-city-winners-v2-";
const maps=new Map();
const RELEASE=Date.UTC(2026,9,25,20,0,0);
const isOpen=()=>!!openUF;
function status(s){const n=$("t2MapScope");if(n)n.textContent=s;}
function controls(){
 const b=$("t2MapBack"),l=$("t2MunicipalLegend");
 if(b)b.hidden=!openUF;
 if(l)l.hidden=!openUF;
}
function setCountryNode(node){country=node;}
function goBrazil(){
 openUF="";sequence++;colorSequence++;cityID="";svgCity=null;
 const target=$("t2Map");if(target){delete target.dataset.scope;if(country)target.replaceChildren(country);}
 controls();status("Brasil inteiro • toque em um estado para visualizar todas as suas cidades.");
}
function polygons(f){
 const g=f&&f.geometry;
 return g?.type==="Polygon"?[g.coordinates]:g?.type==="MultiPolygon"?g.coordinates:[];
}
function walk(polys,callback){
 for(const poly of polys)for(const ring of poly)for(const p of ring)
  if(Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))callback(p);
}
function createMap(json,uf){
 const features=json.features.filter(f=>/^\d{7}$/.test(String(f?.properties?.id||""))&&polygons(f).length);
 if(!features.length)throw Error("Malha municipal sem polígonos");
 let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
 for(const f of features)walk(polygons(f),p=>{
  minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);
  miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1]);
 });
 if(!Number.isFinite(minx)||maxx<=minx||maxy<=miny)throw Error("Malha municipal sem coordenadas válidas");
 const W=820,H=585,corr=Math.max(.55,Math.cos((miny+maxy)*Math.PI/360));
 const sx=(maxx-minx)*corr,sy=maxy-miny,scale=Math.min(770/sx,530/sy);
 const ox=(W-sx*scale)/2,oy=(H-sy*scale)/2;
 const projected=p=>[(ox+(p[0]-minx)*corr*scale).toFixed(1),(oy+(maxy-p[1])*scale).toFixed(1)];
 const svg=document.createElementNS(NS,"svg");
 svg.setAttribute("viewBox","0 0 "+W+" "+H);
 svg.setAttribute("class","t2-muni-svg");
 svg.setAttribute("role","group");
 svg.setAttribute("aria-label","Mapa municipal interativo de "+uf);
 svg.dataset.baseViewBox="0 0 "+W+" "+H;
 const group=document.createElementNS(NS,"g"),frag=document.createDocumentFragment();
 for(const f of features){
  let d="";
  for(const poly of polygons(f))for(const ring of poly){
   const points=ring.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
   if(points.length<3)continue;
   d+=points.map((p,i)=>(i?"L":"M")+projected(p).join(",")).join("")+"Z";
  }
  if(!d)continue;
  const p=document.createElementNS(NS,"path");
  p.setAttribute("d",d);p.setAttribute("fill-rule","evenodd");
  p.setAttribute("class","t2-municipio");p.setAttribute("role","button");p.setAttribute("tabindex","0");
  p.dataset.ibge=String(f.properties.id);p.dataset.city=String(f.properties.name||"Município");
  p.setAttribute("aria-label",p.dataset.city);
  const title=document.createElementNS(NS,"title");title.textContent=p.dataset.city+" • selecionar cidade";p.appendChild(title);
  frag.appendChild(p);
 }
 group.appendChild(frag);svg.appendChild(group);
 function pick(event){
  const el=event.target.closest?.("path[data-ibge]");
  if(!el)return;
  highlight(el.dataset.ibge);
  status("Consultando "+el.dataset.city+" no TSE...");
  Promise.resolve(window.BUCentral?.selectCityByIBGE?.(el.dataset.ibge)).then(ok=>{
   if(!ok)status("Cidade selecionada: "+el.dataset.city+". Consulte também pelo campo de busca.");
  }).catch(()=>status("Consulte "+el.dataset.city+" pelo campo de busca."));
 }
 svg.addEventListener("click",pick);
 svg.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick(e);}});
 svg.addEventListener("pointerover",e=>{
  const p=e.target.closest?.("path[data-ibge]");
  if(p)status("Cidade: "+p.dataset.city+" • clique para consultar a votação.");
 });
 svg.addEventListener("pointerout",e=>{
  const p=e.target.closest?.("path[data-ibge]");
  if(p)status(features.length+" municípios de "+uf+" • selecione a cidade ou pesquise pelo nome.");
 });
 return {svg,count:features.length};
}
async function geometry(uf){
 if(cache.has(uf))return cache.get(uf);
 const file="geojs-"+UF_ID[uf]+"-mun.json";
 const links=[
  "https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/"+file,
  "https://cdn.jsdelivr.net/gh/tbrugz/geodata-br@master/geojson/"+file
 ];
 let lastError;
 for(const url of links){
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
   let response;
   try{response=await fetch(url,{cache:"force-cache",signal:controller.signal});}
   finally{clearTimeout(timer);}
   if(!response.ok)throw Error("HTTP "+response.status);
   const json=await response.json();
   if(json?.type!=="FeatureCollection"||!Array.isArray(json.features))throw Error("GeoJSON inválido");
   cache.set(uf,json);return json;
  }catch(e){lastError=e;}
 }
 throw lastError||Error("Malha indisponível");
}

const n=v=>Number(v)||0;
const decimal=v=>Number(String(v??"").replace(",","."))||0;
function currentElection(){return window.BUCentral?.currentMapMode==="second"?"6258":"6257";}
function storeKey(uf,election){return WINNER_CACHE_PREFIX+election+"-"+uf;}
function cacheEntries(uf,election){
 const key=storeKey(uf,election);
 if(maps.has(key))return maps.get(key);
 let cached={items:{},updated:0,complete:false};
 try{
  const value=JSON.parse(localStorage.getItem(key)||"null");
  if(value?.items&&typeof value.items==="object"){
   cached={items:value.items,updated:n(value.updated),complete:!!value.complete};
  }
 }catch{}
 maps.set(key,cached);
 return cached;
}
function saveEntries(uf,election,entries){
 entries.updated=Date.now();
 try{localStorage.setItem(storeKey(uf,election),JSON.stringify(entries));}catch{}
}
function winnerOf(doc,election,cityCode){
 if(!doc||String(doc.ele)!==election||String(doc.t)!==(election==="6257"?"1":"2")||
    String(doc.cdabr)!==cityCode||doc.f!=="o"||doc.dv!=="s"||n(doc.s?.st)<1)return null;
 const results=[];
 for(const office of doc.carg||[]){
  if(String(office.cd)!=="1")continue;
  for(const agr of office.agr||[])for(const party of agr.par||[])for(const candidate of party.cand||[]){
   const votes=n(candidate.vap);
   if(votes>0)results.push({number:String(candidate.n),name:String(candidate.nmu||candidate.nm||""),votes,percent:decimal(candidate.pvap)});
  }
 }
 results.sort((a,b)=>b.votes-a.votes);
 return results.length?results[0]:null;
}
function setWinner(path,winner){
 if(!path)return;
 path.classList.remove("has-first","has-second","has-other","winner-known");
 const title=path.querySelector("title");
 const name=path.dataset.city||"Município";
 if(!winner){
  if(title)title.textContent=name+" • sem resultado municipal confirmado";
  path.setAttribute("aria-label",name+" • sem resultado confirmado");
  return;
 }
 const kind=winner.number==="13"?"has-second":winner.number==="22"?"has-first":"has-other";
 path.classList.add(kind,"winner-known");
 const detail=name+" • "+winner.name+" ("+winner.number+") "+winner.percent.toFixed(2).replace(".",",")+"% • "+winner.votes.toLocaleString("pt-BR")+" votos";
 if(title)title.textContent=detail;
 path.setAttribute("aria-label",detail);
}
function countPainted(svg){
 return svg.querySelectorAll("path.winner-known").length;
}
function updateProgress(uf,svg,scanned,total,pending){
 if(svg!==svgCity||uf!==openUF)return;
 const painted=countPainted(svg);
 const missing=Math.max(0,total-painted);
 status(pending
  ?uf+": "+scanned+" de "+total+" cidades consultadas • "+painted+" com vencedor confirmado. Cidades sem dados ficam cinza."
  :uf+": "+painted+" de "+total+" cidades com vencedor confirmado • "+missing+" sem resultado disponível. Clique em qualquer cidade.");
}
async function fetchWinner(uf,election,city,signal){
 const base="https://resultados.tse.jus.br/oficial/ele2026/"+election+"/dados/";
 const file=uf.toLowerCase()+city.code+"-c0001-e00"+election+"-u.json";
 const url=base+uf.toLowerCase()+"/"+file;
 const response=await fetch(url,{cache:election==="6257"?"force-cache":"no-store",signal});
 if(!response.ok)throw Error("TSE HTTP "+response.status);
 return winnerOf(await response.json(),election,city.code);
}
async function colorMunicipalities(force=false){
 if(!openUF||!svgCity)return;
 const uf=openUF,svg=svgCity,election=currentElection(),generation=++colorSequence;
 for(const path of svg.querySelectorAll("path[data-ibge]"))setWinner(path,null);
 if(election==="6258"&&Date.now()<RELEASE){
  status("2º turno • aguardando a divulgação oficial de 25/10/2026. Municípios permanecem sem cor de vencedor.");
  return;
 }
 const cached=cacheEntries(uf,election);
 const age=Date.now()-cached.updated;
 const snapshotValid=!force&&cached.complete&&(election==="6257"||age<120000);
 const allPaths=[...svg.querySelectorAll("path[data-ibge]")];
 for(const p of allPaths)setWinner(p,cached.items[p.dataset.ibge]||null);
 if(snapshotValid){
  updateProgress(uf,svg,allPaths.length,allPaths.length,false);
  return;
 }
 let directory=[];
 try{
  status("Carregando os municípios oficiais do TSE para pintar o mapa...");
  directory=await window.BUCentral.getCityDirectory(uf);
 }catch(error){
  status("A lista oficial do TSE está indisponível. Consulte as cidades individualmente.");
  return;
 }
 if(generation!==colorSequence||svg!==svgCity||uf!==openUF)return;
 const byIbge=new Map(directory.filter(c=>c.ibge&&c.code).map(c=>[c.ibge,c]));
 const tasks=allPaths.map(path=>({path,city:byIbge.get(path.dataset.ibge)})).filter(item=>item.city);
 const total=tasks.length;
 let at=0,scanned=0,errors=0;
 const refreshCache=election==="6258"&&age>120000||force;
 // Preservar dados já verificados do primeiro turno e retomar consultas interrompidas.
 const queue=tasks.filter(x=>refreshCache||!Object.prototype.hasOwnProperty.call(cached.items,x.path.dataset.ibge));
 scanned=total-queue.length;
 if(!total){status("Os códigos municipais IBGE e TSE não puderam ser associados.");return;}
 const workers=Array.from({length:8},async()=>{
  while(generation===colorSequence&&svg===svgCity&&uf===openUF){
   const idx=at++;
   if(idx>=queue.length)break;
   const {path,city}=queue[idx];
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),14000);
   try{
    const winner=await fetchWinner(uf,election,city,controller.signal);
    if(winner)cached.items[path.dataset.ibge]=winner;
    else delete cached.items[path.dataset.ibge];
    if(generation===colorSequence&&svg===svgCity)setWinner(path,winner);
   }catch(error){
    errors++;
    // Deixar cinza se TSE estiver indisponível. Nova tentativa no próximo acesso.
   }finally{
    clearTimeout(timer);
    scanned++;
    if(scanned%12===0&&generation===colorSequence)updateProgress(uf,svg,scanned,total,true);
    if(scanned%45===0)saveEntries(uf,election,cached);
   }
  }
 });
 updateProgress(uf,svg,scanned,total,true);
 await Promise.all(workers);
 saveEntries(uf,election,cached);
 if(generation!==colorSequence||svg!==svgCity)return;
 cached.complete=errors===0&&scanned===total;
 saveEntries(uf,election,cached);
 updateProgress(uf,svg,scanned,total,false);
 if(errors)status(uf+": "+countPainted(svg)+" cidades com vencedor confirmado. "+errors+" consultas não responderam; as demais ficam cinza. Atualize para tentar novamente.");
}
function refreshColors(force=false){
 if(openUF&&svgCity)colorMunicipalities(force).catch(e=>console.warn("Falha na pintura municipal:",e));
}
async function show(uf){
 if(!uf||!UF_ID[uf]){goBrazil();return;}
 if(openUF===uf&&svgCity)return;
 const request=++sequence,target=$("t2Map");openUF=uf;svgCity=null;cityID="";
 controls();if(!target)return;
 target.textContent="Carregando cidades do estado "+uf+"...";
 status("Carregando contornos municipais de "+uf+" (apenas este estado)...");
 try{
  const json=await geometry(uf);
  if(request!==sequence||openUF!==uf)return;
  const {svg,count}=createMap(json,uf);
  svgCity=svg;target.dataset.scope="municipios";target.replaceChildren(svg);
  status(count+" municípios no mapa de "+uf+" • conferindo vencedores oficiais...");
  refreshColors();
  const zoom=$("t2MapZoom");if(zoom)zoom.textContent="100%";
 }catch(error){
  if(request!==sequence)return;
  console.warn("Mapa municipal indisponível:",error);
  target.textContent="Mapa municipal indisponível nesta conexão.";
  status("Não foi possível carregar os contornos. Use a pesquisa de cidades ao lado.");
 }
}
function highlight(ibge,winner){
 cityID=String(ibge||"");
 if(!svgCity)return;
 for(const el of svgCity.querySelectorAll(".is-selected"))el.classList.remove("is-selected");
 if(!cityID)return;
 const path=svgCity.querySelector('[data-ibge="'+cityID+'"]');
 if(!path)return;
 path.classList.add("is-selected");
 const record=cacheEntries(openUF,currentElection()).items[cityID];
 if(winner&&(!record||String(winner)!==record.number)){
  // O detalhe consultado diretamente prevalece, sem alterar a cor dos outros municípios.
  path.classList.remove("has-first","has-second","has-other");
  path.classList.add(String(winner)==="13"?"has-second":String(winner)==="22"?"has-first":"has-other");
 }else if(record)setWinner(path,record);
}
window.BUMunicipios={show,goBrazil,isOpen,setCountryNode,highlight,refreshColors,
 get count(){return svgCity?.querySelectorAll("[data-ibge]").length||0;},
 get uf(){return openUF;}
};
controls();
})();