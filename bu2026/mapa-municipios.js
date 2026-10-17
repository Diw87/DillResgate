/* DW Tech | Malha municipal em SVG, obtida por UF sob demanda.
   Dados cartográficos: IBGE (geojson reempacotado por geodata-br, CC0).
   Geometria não contém resultados eleitorais; votos sempre consultados no TSE. */
(()=>{"use strict";
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const UF_ID={AC:12,AL:27,AP:16,AM:13,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,MT:51,MS:50,MG:31,PA:15,PB:25,PR:41,PE:26,PI:22,RJ:33,RN:24,RS:43,RO:11,RR:14,SC:42,SP:35,SE:28,TO:17};
const cache=new Map();
let country=null,openUF="",sequence=0,svgCity=null,cityID="";
const isOpen=()=>!!openUF;
function status(s){const n=$("t2MapScope");if(n)n.textContent=s;}
function controls(){
 const b=$("t2MapBack"),l=$("t2MunicipalLegend");
 if(b)b.hidden=!openUF;
 if(l)l.hidden=!openUF;
}
function setCountryNode(node){country=node;}
function goBrazil(){
 openUF="";sequence++;cityID="";svgCity=null;
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
  status(count+" municípios no mapa de "+uf+" • clique em qualquer cidade.");
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
 for(const el of svgCity.querySelectorAll(".is-selected"))el.classList.remove("is-selected","has-first","has-second","has-other");
 if(!cityID)return;
 const p=svgCity.querySelector('[data-ibge="'+cityID+'"]');
 if(!p)return;
 p.classList.add("is-selected");
 if(String(winner)==="13")p.classList.add("has-second");
 else if(String(winner)==="22")p.classList.add("has-first");
 else if(winner)p.classList.add("has-other");
}
window.BUMunicipios={show,goBrazil,isOpen,setCountryNode,highlight,
 get count(){return svgCity?.querySelectorAll("[data-ibge]").length||0;},
 get uf(){return openUF;}
};
controls();
})();