/* DW Tech | Central 2º turno: mapa, painel ao vivo, TV, compartilhamento e relatórios */
(()=>{
"use strict";
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados";
const RELEASE=Date.UTC(2026,9,25,20,0,0);
const FIRST_BASE="https://resultados.tse.jus.br/oficial/ele2026/6257";
const FIRST_CONFIG=FIRST_BASE+"/config/mun-e006257-cm.json";
const UF=[
 ["AC","Acre",4,1],["AM","Amazonas",3,2],["RR","Roraima",1,3],["RO","Rondônia",5,2],
 ["PA","Pará",3,4],["AP","Amapá",2,5],["TO","Tocantins",5,5],["MA","Maranhão",4,6],
 ["PI","Piauí",5,7],["CE","Ceará",4,8],["RN","Rio Grande do Norte",4,9],["PB","Paraíba",5,9],
 ["PE","Pernambuco",6,9],["AL","Alagoas",7,9],["SE","Sergipe",8,9],["BA","Bahia",7,7],
 ["MT","Mato Grosso",6,4],["MS","Mato Grosso do Sul",8,4],["GO","Goiás",6,5],["DF","Distrito Federal",7,5],
 ["MG","Minas Gerais",8,6],["ES","Espírito Santo",9,7],["RJ","Rio de Janeiro",10,6],
 ["SP","São Paulo",9,5],["PR","Paraná",10,4],["SC","Santa Catarina",11,4],["RS","Rio Grande do Sul",12,3]
];
const AREAS=[
 ["presidente_br","Brasil + exterior"],["presidente_ma","Maranhão"],
 ["presidente_odc","Olho d'Água das Cunhãs"],["presidente_vf","Vitorino Freire"]
];
const $=id=>document.getElementById(id);
const n=v=>Number(v)||0, fmt=v=>n(v).toLocaleString("pt-BR");
const pct=v=>Number(String(v??0).replace(",","."))||0;
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const available=()=>Date.now()>=RELEASE;
const hasVotes=r=>available()&&r&&r.fase!=="s"&&r.divulgacao!=="n"&&n(r.secoes?.totalizadas)>0&&
 Array.isArray(r.candidatos)&&r.candidatos.some(c=>n(c.votos)>0);
const officialLink=uf=>BASE+"/"+uf.toLowerCase()+"/"+uf.toLowerCase()+"-c0001-e006258-u.json";
const officialFirstLink=uf=>FIRST_BASE+"/dados/"+uf.toLowerCase()+"/"+uf.toLowerCase()+"-c0001-e006257-u.json";
const officialFirstCityLink=(uf,cityCode)=>FIRST_BASE+"/dados/"+uf.toLowerCase()+"/"+uf.toLowerCase()+cityCode+"-c0001-e006257-u.json";
const officialSecondCityLink=(uf,cityCode)=>BASE+"/"+uf.toLowerCase()+"/"+uf.toLowerCase()+cityCode+"-c0001-e006258-u.json";
const hasFirstVotes=r=>!!r&&r.fase==="o"&&r.divulgacao==="s"&&n(r.secoes?.totalizadas)>0&&Array.isArray(r.candidatos)&&r.candidatos.some(c=>n(c.votos)>0);
let stateData={},selectedUF="",generatedAt="",lastCheck=0,failed=false,loading=false,started=false;
let mapMode="first",firstStates={},firstStatePromises={},firstLoading=null,firstFailures=0;
let cityDirectory=null,cityDirectoryPromise=null,selectedCity=null,selectedCityResult=null,cityLoading=false;
const FIRST_CACHE_KEY="dwtech-bu2026-map-first-6257-v1";
let tv=false,tvTimer=null,tvIndex=0,tvOwnFullscreen=false,scrollTick=0;
function allResults(){return window.BUSecondRound?.results||{};}
function getData(key){
 const live=allResults()[key],snap=stateData[key];
 if(hasVotes(live)&&hasVotes(snap)){
  const a=(live.geradoEm?.data||"")+" "+(live.geradoEm?.hora||"");
  const b=(snap.geradoEm?.data||"")+" "+(snap.geradoEm?.hora||"");
  return a>=b?live:snap;
 }
 return hasVotes(live)?live:hasVotes(snap)?snap:null;
}

function getMapData(uf){
 return mapMode==="first"?firstStates[uf]||null:getData("presidente_"+uf.toLowerCase());
}
function hasMapVotes(r){return mapMode==="first"?hasFirstVotes(r):hasVotes(r);}
function mapIntro(){
 const info=$("t2MapContext"),first=$("t2MapFirstBtn"),second=$("t2MapSecondBtn");
 if(first){first.classList.toggle("active",mapMode==="first");first.setAttribute("aria-pressed",String(mapMode==="first"));}
 if(second){second.classList.toggle("active",mapMode==="second");second.setAttribute("aria-pressed",String(mapMode==="second"));}
 const count=Object.values(firstStates).filter(hasFirstVotes).length;
 if(info)info.textContent=mapMode==="first"
  ?"MODO TESTE • 1º TURNO DE 2026 • "+count+" de 27 estados com dados oficiais"+(firstLoading?" • carregando...":"")+" • Sem relação com os votos do 2º turno"
  :"2º TURNO DE 2026 • "+(available()?"Apuração oficial do TSE, conforme divulgação":"Aguardando 25/10/2026, às 17h de Brasília");
}
function cacheFirstStates(){
 try{localStorage.setItem(FIRST_CACHE_KEY,JSON.stringify({election:6257,states:firstStates}));}catch{}
}
function loadFirstCache(){
 try{
  const saved=JSON.parse(localStorage.getItem(FIRST_CACHE_KEY)||"null");
  if(saved?.election!==6257||!saved.states)return;
  for(const [uf,value] of Object.entries(saved.states)){
   if(UF.some(x=>x[0]===uf)&&hasFirstVotes(value))firstStates[uf]=value;
  }
 }catch{}
}
async function ensureFirstState(uf,force=false){
 if(!UF.some(x=>x[0]===uf))return null;
 if(firstStatePromises[uf])return firstStatePromises[uf];
 if(!force&&hasFirstVotes(firstStates[uf]))return firstStates[uf];
 const url=officialFirstLink(uf);
 const work=(async()=>{
  try{
   const raw=await json(url);
   if(String(raw?.ele)!=="6257"||String(raw?.t)!=="1"||String(raw?.cdabr).toLowerCase()!==uf.toLowerCase())throw Error("Eleição ou UF inválida");
   const normal=normalize(uf,raw,url);
   if(!hasFirstVotes(normal))throw Error("Totalização não encontrada");
   firstStates[uf]=normal;
   cacheFirstStates();
   if(mapMode==="first"){mapIntro();paintMapStates();if(uf===selectedUF||!selectedUF)detailUF();connection();}
   return normal;
  }catch(error){
   console.warn("Não foi possível carregar o 1º turno da UF",uf,error.message);
   firstFailures++;
   return firstStates[uf]||null;
  }finally{delete firstStatePromises[uf];}
 })();
 firstStatePromises[uf]=work;
 return work;
}
async function loadFirstStates(force=false){
 if(firstLoading)return firstLoading;
 if(!navigator.onLine){mapIntro();return;}
 const states=UF.map(x=>x[0]).filter(uf=>force||!hasFirstVotes(firstStates[uf]));
 if(!states.length){mapIntro();return;}
 firstFailures=0;
 firstLoading=(async()=>{
  let at=0;
  const workers=Array.from({length:6},async()=>{
   for(;;){
    const index=at++;
    if(index>=states.length)return;
    await ensureFirstState(states[index],force);
   }
  });
  await Promise.all(workers);
 })();
 mapIntro();
 try{await firstLoading;}finally{
  firstLoading=null;mapIntro();paintMapStates();detailUF();connection();
 }
}
async function loadCityDirectory(){
 if(cityDirectory)return cityDirectory;
 if(cityDirectoryPromise)return cityDirectoryPromise;
 cityDirectoryPromise=(async()=>{
  const response=await json(FIRST_CONFIG);
  if(!Array.isArray(response?.abr))throw Error("Relação de municípios inválida");
  const byUF={};
  for(const reg of response.abr){
   const uf=String(reg.cd||"").toUpperCase();
   if(!UF.some(x=>x[0]===uf))continue;
   byUF[uf]=(reg.mu||[]).filter(m=>/^\d{5}$/.test(String(m.cd||""))).map(m=>({name:String(m.nm||""),code:String(m.cd),ibge:String(m.cdi||"")}))
     .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  }
  cityDirectory=byUF;
  return byUF;
 })();
 try{return await cityDirectoryPromise;}
 finally{cityDirectoryPromise=null;updateCityControls();}
}
function cityKey(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();}
function updateCityControls(){
 const controls=$("t2CityControls"),input=$("t2CitySearch"),list=$("t2CityDatalist"),help=$("t2CityHelp");
 if(!controls)return;
 const isVisible=!!selectedUF;
 controls.hidden=!isVisible;
 if(!isVisible)return;
 const cities=cityDirectory?.[selectedUF]||[];
 if(input)input.disabled=!cities.length||cityLoading;
 if(list)list.innerHTML=cities.map(c=>'<option value="'+esc(c.name)+'"></option>').join("");
 if(help)help.textContent=cityLoading?"Buscando apuração municipal..."
  :cities.length?cities.length+" municípios disponíveis. Digite e escolha uma cidade."
  :cityDirectoryPromise?"Carregando lista oficial de municípios...":"Carregando cidades do estado...";
}
function resetCity(){
 selectedCity=null;selectedCityResult=null;
 window.BUMunicipios?.highlight(null);
 const input=$("t2CitySearch"),result=$("t2CityResult");
 if(input)input.value="";
 if(result)result.innerHTML="";
 updateCityControls();
}
function renderCityResult(){
 const box=$("t2CityResult");if(!box)return;
 if(!selectedCity){box.innerHTML="";return;}
 const first=mapMode==="first",r=selectedCityResult,label=first?"1º TURNO":"2º TURNO";
 const valid=first?hasFirstVotes(r):hasVotes(r);
 if(!valid){
  box.innerHTML='<div class="t2-city-result-head"><span>'+label+' • MUNICÍPIO</span><h4>'+esc(selectedCity.name)+'</h4></div>'+
   '<p class="t2-city-note">'+(!first&&!available()?"O 2º turno ainda não aconteceu. Os votos serão exibidos após a divulgação do TSE.":"Aguardando votação oficial deste município.")+'</p>';
  return;
 }
 box.innerHTML='<div class="t2-city-result-head"><span>'+label+' • MUNICÍPIO</span><h4>'+esc(selectedCity.name)+'</h4>'+
  '<small>'+esc(fmt(r.secoes.totalizadas))+' seções totalizadas • fonte TSE</small></div>'+
  numberedCandidates(r).map(c=>
   '<div class="t2-uf-line"><span>'+esc(c.nome)+' ('+esc(c.numero)+')</span><b>'+pct(c.percentual).toFixed(2).replace(".",",")+'%</b></div>'+
   '<div class="t2-uf-track"><i class="'+candidateClass(c)+'" style="width:'+Math.max(0,Math.min(100,pct(c.percentual)))+'%"></i></div>'+
   '<small>'+fmt(c.votos)+' votos</small>').join("")+
  '<a class="t2-city-source" href="'+esc(r.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Conferir resultado no TSE ↗</a>';
}
async function lookupCity(){
 if(!selectedUF)return false;
 const input=$("t2CitySearch"),help=$("t2CityHelp");
 if(!cityDirectory){try{await loadCityDirectory();}catch{if(help)help.textContent="Não foi possível carregar os municípios do TSE.";return false;}}
 const requested=cityKey(input?.value),options=cityDirectory?.[selectedUF]||[];
 const city=options.find(x=>cityKey(x.name)===requested);
 if(!city){if(help)help.textContent="Escolha o nome completo de uma cidade na lista.";return false;}
 const uf=selectedUF,mode=mapMode,first=mode==="first";
 selectedCity=city;selectedCityResult=null;
 window.BUMunicipios?.highlight(city.ibge);
 if(!first&&!available()){
  renderCityResult();
  if(help)help.textContent="2º turno • votação ainda não divulgada para "+city.name;
  return true;
 }
 cityLoading=true;updateCityControls();
 if(help)help.textContent="Consultando "+city.name+" no TSE...";
 try{
  const url=first?officialFirstCityLink(uf,city.code):officialSecondCityLink(uf,city.code);
  const raw=await json(url);
  if(uf!==selectedUF||mode!==mapMode||String(raw?.ele)!==(first?"6257":"6258")||
     String(raw?.t)!==(first?"1":"2")||String(raw?.cdabr)!==city.code)throw Error("Cidade ou turno incompatível");
  const data=normalize(uf,raw,url),valid=first?hasFirstVotes(data):hasVotes(data);
  if(!valid)throw Error("Ainda não há dados oficiais para este município");
  data.abrangencia=city.name;
  selectedCityResult=data;
  renderCityResult();
  const winner=orderedCandidates(data)[0];
  window.BUMunicipios?.highlight(city.ibge,winner?.numero);
  if(help)help.textContent="Resultado oficial de "+city.name+" • "+(first?"1º":"2º")+" turno de 2026";
  return true;
 }catch(err){
  if(uf===selectedUF&&mode===mapMode){
   if(help)help.textContent="Resultado desta cidade indisponível. Verifique sua conexão e tente novamente.";
   renderCityResult();
  }
  return false;
 }finally{cityLoading=false;updateCityControls();}
}
async function selectCityByIBGE(id){
 if(!selectedUF||!id)return false;
 try{
  const list=await loadCityDirectory(),cities=list?.[selectedUF]||[];
  const city=cities.find(c=>c.ibge===String(id));
  if(!city)return false;
  const input=$("t2CitySearch");if(input)input.value=city.name;
  return await lookupCity();
 }catch(e){console.info("Falha ao relacionar município IBGE e TSE",e);return false;}
}
function selectMapMode(mode){
 if(mode!=="first"&&mode!=="second")return;
 mapMode=mode;resetCity();mapIntro();mapHtml();
 window.BUMunicipios?.refreshColors();
 if(mode==="first")loadFirstStates();
 else if(available())refresh();
}
function finalists(){
 const national=getData("presidente_br");
 if(national)return national.candidatos.slice(0,2);
 const any=Object.values(stateData).find(hasVotes);
 if(any)return any.candidatos.slice(0,2);
 // Mapa ainda sem votos: legenda informativa, sem prever vencedores.
 return [{numero:"13",nome:"LULA"},{numero:"22",nome:"FLAVIO BOLSONARO"}];
}
function orderedCandidates(r){
 // Ordenação por votos usada APENAS para identificar corretamente o vencedor.
 return (r?.candidatos||[]).slice().sort((a,b)=>n(b.votos)-n(a.votos)).slice(0,2);
}
function numberedCandidates(r){
 // Apresentação em ordem de número (13, 22), sem alterar os votos ou o vencedor.
 return orderedCandidates(r).sort((a,b)=>(Number(a.numero)||999)-(Number(b.numero)||999));
}
function candidateClass(c){
 // As cores são fixas por candidato (não por colocação na apuração).
 const num=String(c?.numero||"");
 return num==="22"?"first":num==="13"?"second":num?"other":"pending";
}

/* SVG real dos estados, com precisão vetorial e nenhum pacote pesado. */
let mapReady=false,mapLoading=false,mapZoom=1;
function paintMapStates(){
 const svg=document.querySelector("#t2Map svg");if(!svg)return;
 for(const element of svg.querySelectorAll("[data-uf]")){
  const uf=element.getAttribute("data-uf");
  const r=getMapData(uf),winner=hasMapVotes(r)?orderedCandidates(r)[0]:null;
  const kind=winner?candidateClass(winner):"pending";
  element.classList.remove("first","second","pending","active");
  element.classList.add(kind);
  if(uf===selectedUF)element.classList.add("active");
  element.setAttribute("aria-pressed",String(uf===selectedUF));
  const title=element.querySelector("title"),name=UF.find(v=>v[0]===uf)?.[1]||uf;
  if(title)title.textContent=name+" • "+(winner?winner.nome+": "+pct(winner.percentual).toFixed(2).replace(".",",")+"%":"Aguardando resultados")+(mapMode==="first"?" • 1º turno":" • 2º turno");
 }
 for(const label of svg.querySelectorAll("[data-label]")){
  const uf=label.getAttribute("data-label"),r=getMapData(uf);
  const win=hasMapVotes(r)?orderedCandidates(r)[0]:null;
  label.classList.remove("first","second","pending");label.classList.add(win?candidateClass(win):"pending");
 }
}
function updateMapView(){
 const svg=document.querySelector("#t2Map svg");if(!svg)return;
 const base=(svg.dataset.baseViewBox||"0 0 620 618").split(" ").map(Number);
 const [ox,oy,ow,oh]=base,w=ow/mapZoom,h=oh/mapZoom;
 const focus=svg.querySelector('path[data-uf="'+selectedUF+'"]');
 let cx=ox+ow/2,cy=oy+oh/2;
 if(mapZoom>1&&focus){const b=focus.getBBox();cx=b.x+b.width/2;cy=b.y+b.height/2;}
 const x=Math.max(ox,Math.min(ox+ow-w,cx-w/2)),y=Math.max(oy,Math.min(oy+oh-h,cy-h/2));
 svg.setAttribute("viewBox",[x,y,w,h].map(v=>v.toFixed(2)).join(" "));
 const label=$("t2MapZoom");if(label)label.textContent=Math.round(mapZoom*100)+"%";
}
function zoomMap(factor){mapZoom=Math.max(1,Math.min(4,Math.round(mapZoom*factor*100)/100));updateMapView();}
function resetMapZoom(){mapZoom=1;updateMapView();}
async function loadMap(){
 const target=$("t2Map");if(!target||mapLoading||mapReady)return;
 mapLoading=true;target.textContent="Carregando mapa geográfico...";
 try{
  const response=await fetch("./brasil-estados.svg",{cache:"force-cache"});
  if(!response.ok)throw Error("Não foi possível carregar o mapa.");
  const doc=new DOMParser().parseFromString(await response.text(),"image/svg+xml");
  const svg=doc.documentElement;
  if(svg.tagName.toLowerCase()!=="svg"||svg.querySelectorAll("path.br-map-state").length!==27)throw Error("Arquivo SVG inválido.");
  const node=document.importNode(svg,true);node.dataset.baseViewBox=node.getAttribute("viewBox");
  window.BUMunicipios?.setCountryNode(node);
  if(!window.BUMunicipios?.isOpen())target.replaceChildren(node);
  target.addEventListener("click",event=>{
   const el=event.target.closest?.("[data-uf]");if(el&&target.contains(el))selectUF(el.getAttribute("data-uf"));
  });
  target.addEventListener("keydown",event=>{
   if(event.key!=="Enter"&&event.key!==" ")return;
   const el=event.target.closest?.("[data-uf]");
   if(el&&target.contains(el)){event.preventDefault();selectUF(el.getAttribute("data-uf"));}
  });
  mapReady=true;paintMapStates();updateMapView();
 }catch(error){
  console.warn("Mapa vetorial indisponível:",error);
  target.innerHTML='<p class="t2-muted">Mapa indisponível. Use a lista de estados acima para consultar os resultados.</p>';
 }finally{mapLoading=false;}
}
function mapHtml(){
 mapIntro();
 const legend=$("t2MapLegend");
 if(legend){
  legend.innerHTML='<span class="t2-key second"></span>Lula (13)'+
   '<span class="t2-key first"></span>Flávio Bolsonaro (22)'+
   '<span class="t2-key other"></span>Outro candidato'+
   '<span class="t2-key pending"></span>Sem dados';
 }
 const picker=$("t2StatePicker");
 if(picker){
  if(!picker.options.length){
   picker.innerHTML='<option value="">Selecione um estado</option>'+
    UF.slice().sort((a,b)=>a[1].localeCompare(b[1],"pt-BR")).map(([uf,name])=>
    '<option value="'+uf+'">'+esc(name)+" ("+uf+")</option>").join("");
  }
  if(picker.value!==selectedUF)picker.value=selectedUF;
 }
 if(mapReady)paintMapStates();else if(!mapLoading)loadMap();
 detailUF();
}
function detailUF(){
 const box=$("t2UFDetail");if(!box)return;
 if(!selectedUF){
  box.innerHTML='<div class="t2-map-default"><span class="t2-map-default-icon">⌖</span><h4>Brasil inteiro</h4>'+
    '<p>Selecione qualquer estado no mapa ou na lista para ver a votação e pesquisar seus municípios.</p></div>';
  updateCityControls();
  return;
 }
 const row=UF.find(x=>x[0]===selectedUF),name=row?.[1]||"Estado";
 const r=getMapData(selectedUF);
 const first=mapMode==="first";
 const label=first?"1º TURNO • TESTE":"2º TURNO";
 const title='<div class="t2-detail-heading"><span>'+label+'</span><h4>'+esc(name)+' <small>('+esc(selectedUF)+')</small></h4></div>';
 if(!hasMapVotes(r)){
  box.innerHTML=title+'<p class="t2-muted">'+(first?"Carregando votação oficial do 1º turno para este estado...":"Sem votos oficiais do 2º turno divulgados para esta UF.")+'</p>'+
   '<a href="'+(first?officialFirstLink(selectedUF):officialLink(selectedUF))+'" target="_blank" rel="noopener noreferrer">Consultar arquivo oficial ↗</a>';
 }else{
  const candidates=numberedCandidates(r);
  box.innerHTML=title+'<p class="t2-muted">'+esc(fmt(r.secoes.totalizadas)+" de "+fmt(r.secoes.total)+" seções")+
   ' • '+pct(r.secoes.percentual).toFixed(2).replace(".",",")+'% apuradas</p>'+
   candidates.map(c=>'<div class="t2-uf-line"><span>'+esc(c.nome)+' ('+esc(c.numero)+')</span><b>'+pct(c.percentual).toFixed(2).replace(".",",")+'%</b></div>'+
    '<div class="t2-uf-track"><i class="'+candidateClass(c)+'" style="width:'+Math.max(0,Math.min(100,pct(c.percentual)))+'%"></i></div>'+
    '<small>'+fmt(c.votos)+' votos</small>').join("")+
   '<p class="t2-muted">Arquivo TSE: '+esc([r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" ")||"horário não informado")+'</p>'+
   '<a href="'+(first?officialFirstLink(selectedUF):officialLink(selectedUF))+'" target="_blank" rel="noopener noreferrer">Conferir resultado no TSE ↗</a>';
 }
 updateCityControls();
 renderCityResult();
}
function pulse(){
 const box=$("t2NationalPulse");if(!box)return;
 const r=getData("presidente_br");
 if(!hasVotes(r)){
  box.innerHTML='<span class="t2-live-pill">BRASIL • 2º TURNO</span><strong>Aguardando os dados oficiais da votação</strong><small>25 de outubro, a partir das 17h (Brasília)</small>';
  return;
 }
 const cs=numberedCandidates(r);
 box.innerHTML='<span class="t2-live-pill">BRASIL • '+pct(r.secoes.percentual).toFixed(2).replace(".",",")+'% DAS SEÇÕES</span>'+
  cs.map(c=>'<div class="t2-live-candidate '+candidateClass(c)+'"><b>'+esc(c.nome)+'</b><strong>'+pct(c.percentual).toFixed(2).replace(".",",")+'%</strong>'+
  '<small>'+fmt(c.votos)+' votos</small></div>').join("")+
  '<small class="t2-live-source">TSE: '+esc([r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" "))+'</small>';
}
function connection(){
 const e=$("t2DataQuality");if(!e)return;
 const first=mapMode==="first",count=Object.values(firstStates).filter(hasFirstVotes).length;
 const state=!navigator.onLine?"Sem conexão":first
   ?firstLoading?"Carregando resultados do 1º turno":count?"1º turno • dados oficiais do TSE":"Aguardando resultados do 1º turno"
   :loading?"Consultando 2º turno":failed?"Falha na última consulta do 2º turno":"Conectado ao TSE";
 const local=lastCheck?new Date(lastCheck).toLocaleTimeString("pt-BR"):"ainda não realizada";
 e.innerHTML='<span class="t2-health-dot '+(!navigator.onLine?"error":firstLoading||loading?"pending":first&&count?"ok":failed?"error":"ok")+'"></span>'+
  esc(state)+(first
    ?" • Uso apenas no mapa eleitoral • "+count+"/27 estados com dados • Eleição 6257"
    :" • Última consulta: "+local+" • Eleição 6258")+
  ' • Fonte: Tribunal Superior Eleitoral';
 const btn=$("t2StateRefresh");if(btn){
  const busy=first?!!firstLoading:loading;
  btn.disabled=busy;btn.textContent=busy?"↻ Consultando...":"↻ Atualizar mapa";
 }
}
function paint(){pulse();mapHtml();connection();}
function normalize(uf,doc,url){
 if(!doc||typeof doc!=="object"||doc.f&&doc.f!=="o")return null;
 const a=[],s=doc.s||{},v=doc.v||{},e=doc.e||{};
 for(const carg of doc.carg||[])for(const agr of carg.agr||[])for(const par of agr.par||[])for(const c of par.cand||[]){
  a.push({numero:String(c.n??""),nome:c.nmu||c.nm||"",partido:par.sg||"",votos:n(c.vap),percentual:pct(c.pvap)});
 }
 a.sort((x,y)=>y.votos-x.votos);
 return {key:"presidente_"+uf.toLowerCase(),abrangencia:UF.find(x=>x[0]===uf)?.[1]||uf,
  fase:doc.f,divulgacao:doc.dv,andamento:doc.and,totalizacaoFinal:doc.tf,
  geradoEm:{data:doc.dg||"",hora:doc.hg||""},
  secoes:{total:n(s.ts),totalizadas:n(s.st),percentual:pct(s.pst)},
  eleitores:{total:n(e.te),comparecimento:n(e.c),abstencao:n(e.a)},
  votos:{validos:n(v.vv),brancos:n(v.vb),nulos:n(v.tvn)},candidatos:a,sourceUrl:url};
}
async function json(url){
 const controller=new AbortController(),t=setTimeout(()=>controller.abort(),15000);
 try{
  const sep=url.includes("?")?"&":"?";
  const response=await fetch(url+sep+"t="+Date.now(),{cache:"no-store",signal:controller.signal});
  if(!response.ok)throw new Error("HTTP "+response.status);
  return await response.json();
 }finally{clearTimeout(t);}
}
async function refreshState(uf){
 if(!available()||!navigator.onLine)return;
 try{
  const raw=await json(officialLink(uf));
  const data=normalize(uf,raw,officialLink(uf));
  if(hasVotes(data)){stateData[data.key]=data;paint();}
 }catch(error){console.info("A consulta direta da UF pode estar indisponível no navegador.",uf,error.message);}
}
async function refresh(){
 if(loading)return;
 loading=true;failed=false;connection();
 try{
  if(!navigator.onLine)throw new Error("Sem conexão");
  const data=await json("./resultados-estados-segundo-turno.json");
  if(n(data?.meta?.turno)!==2||n(data?.meta?.eleicao)!==6258||!data?.results||typeof data.results!=="object")
   throw new Error("Arquivo de 2º turno inválido");
  for(const [key,value] of Object.entries(data.results)){
   if(/^presidente_[a-z]{2}$/.test(key)&&UF.some(u=>"presidente_"+u[0].toLowerCase()===key)&&hasVotes(value)){
    stateData[key]=value;
   }
  }
  generatedAt=data.meta.generatedAt||"";
  lastCheck=Date.now();
  paint();
 }catch(error){failed=true;lastCheck=Date.now();console.warn("Mapa estadual sem atualização:",error.message);}
 finally{loading=false;paint();}
}
function selectUF(uf){
 if(uf&&!UF.some(x=>x[0]===uf))return;
 const changed=selectedUF!==uf;
 selectedUF=uf;if(changed)resetCity();
 mapZoom=1;
 window.BUMunicipios?.show(uf);
 paint();updateMapView();
 const zoom=$("t2MapZoom");if(zoom)zoom.textContent="100%";
 if(!uf)return;
 if(mapMode==="first")ensureFirstState(uf);
 else refreshState(uf);
 if(!cityDirectory)loadCityDirectory().catch(error=>{
  const help=$("t2CityHelp");if(help)help.textContent="Não foi possível carregar os municípios. Tente novamente.";
  console.info("Consulta ao catálogo municipal indisponível:",error.message);
 });
 else updateCityControls();
}
function refreshAll(){
 window.BUMunicipios?.refreshColors(true);
 if(mapMode==="first")loadFirstStates(true);
 else{
  refresh();
  if(available())window.BUSecondRound?.refresh();
 }
}
async function share(){
 const url="https://diw87.github.io/DillResgate/bu2026/";
 const data={title:"2º Turno Presidencial 2026 | DW Tech",text:"Acompanhe a apuração oficial do TSE no painel DW Tech BU 2026.",url};
 const e=$("t2ShareMessage");
 try{
  if(navigator.share){await navigator.share(data);if(e)e.textContent="Link enviado para compartilhar.";return;}
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);}
  else{
   const input=document.createElement("textarea");input.value=url;document.body.appendChild(input);input.select();
   if(!document.execCommand("copy"))throw new Error("Cópia indisponível");
   input.remove();
  }
  if(e)e.textContent="Link copiado! Cole no WhatsApp para exibir a prévia.";
 }catch(err){
  if(err?.name==="AbortError")return;
  if(e)e.textContent="Abra ou copie este link: "+url;
 }
}
function tvButton(){
 const b=$("t2TVBtn");
 if(!b)return;
 b.setAttribute("aria-pressed",String(tv));b.textContent=tv?"■ Parar modo TV":"▶ Modo TV automático";
 const s=$("t2TVStatus");if(s)s.textContent=tv?"TV ativa • alternando Brasil, Maranhão e municípios a cada 12 segundos":"";
}
async function toggleTV(){
 if(tv){
  tv=false;clearInterval(tvTimer);tvTimer=null;
  if(tvOwnFullscreen){tvOwnFullscreen=false;try{await window.BUSecondRound?.toggleFullscreen();}catch{}}
  tvButton();return;
 }
 tv=true;tvIndex=0;window.BUSecondRound?.select("br");
 const host=$("segundo-turno");
 const alreadyFullscreen=!!document.fullscreenElement||host?.classList.contains("t2-fullscreen-fallback");
 tvOwnFullscreen=!alreadyFullscreen;
 if(tvOwnFullscreen)try{await window.BUSecondRound?.toggleFullscreen();}catch{}
 tvTimer=setInterval(()=>{
  if(!tv)return;
  const tabs=["br","ma","odc","vf"];
  tvIndex=(tvIndex+1)%tabs.length;
  window.BUSecondRound?.select(tabs[tvIndex]);
 },12000);
 tvButton();
}
function validReport(key){return getData(key);}
async function ensurePdf(){
 if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
 return new Promise((resolve,reject)=>{
  const s=document.createElement("script");
  s.src="./jspdf.umd.min.js?build=20261010.7";
  s.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error("Biblioteca PDF indisponível"));
  s.onerror=()=>reject(new Error("Falha ao carregar PDF"));
  document.head.appendChild(s);
 });
}
function clean(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7e]/g," ");}
function docHeader(pdf,title,subtitle){
 const w=210;
 pdf.setFillColor(15,20,26);pdf.rect(0,0,w,37,"F");
 pdf.setTextColor(255,106,25);pdf.setFont("helvetica","bold");pdf.setFontSize(17);
 pdf.text("DW TECH | B.U. 2026",14,16);
 pdf.setTextColor(255,255,255);pdf.setFontSize(10);pdf.text(clean(title),14,25);
 pdf.setFontSize(8);pdf.text(clean(subtitle),14,32);
 pdf.setTextColor(28,38,46);
}
function reportInfo(pdf,key,y){
 const names=Object.fromEntries(AREAS);
 const uf=key.replace("presidente_","").toUpperCase();
 const label=names[key]||UF.find(x=>x[0]===uf)?.[1]||key;
 const r=validReport(key);if(!hasVotes(r))return y;
 if(y>210){pdf.addPage();y=20;}
 pdf.setFillColor(244,246,248);pdf.roundedRect(12,y-5,186,13,2,2,"F");
 pdf.setFont("helvetica","bold");pdf.setFontSize(13);pdf.setTextColor(25,30,35);
 pdf.text(clean(label),16,y+4);y+=17;
 pdf.setFont("helvetica","normal");pdf.setFontSize(9);
 pdf.text(clean("Secoes apuradas: "+fmt(r.secoes.totalizadas)+" / "+fmt(r.secoes.total)+" ("+pct(r.secoes.percentual).toFixed(2)+"%)"),16,y);y+=7;
 pdf.text(clean("Votos validos: "+fmt(r.votos?.validos)+" | Brancos: "+fmt(r.votos?.brancos)+" | Nulos: "+fmt(r.votos?.nulos)),16,y);y+=9;
 const cs=numberedCandidates(r);
 for(const c of cs){
  if(String(c.numero)==="13")pdf.setFillColor(206,48,69);
  else if(String(c.numero)==="22")pdf.setFillColor(23,105,204);
  else pdf.setFillColor(137,117,187);
  pdf.roundedRect(16,y-4,4,7,1,1,"F");
  pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.setTextColor(22,28,34);
  pdf.text(clean(c.nome)+" ("+clean(c.numero)+")",23,y);
  pdf.text(pct(c.percentual).toFixed(2).replace(".",",")+"%",185,y,{align:"right"});
  y+=6;pdf.setFont("helvetica","normal");pdf.setFontSize(8);
  pdf.text(fmt(c.votos)+" votos",23,y);y+=9;
 }
 pdf.setTextColor(95,103,112);pdf.setFontSize(7.5);
 pdf.text(clean("Arquivo TSE: "+[r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" ")),16,y);y+=5;
 pdf.text(clean("Fonte: "+(r.sourceUrl||"Tribunal Superior Eleitoral")),16,y,{maxWidth:180});y+=13;
 return y;
}
function reportFooter(pdf){
 const pages=pdf.getNumberOfPages();
 for(let i=1;i<=pages;i++){
  pdf.setPage(i);pdf.setDrawColor(225,229,234);pdf.line(12,284,198,284);
  pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.setTextColor(95,103,112);
  pdf.text("DW Tech | Dados oficiais TSE | 2o turno presidencial | 25/10/2026",12,290);
  pdf.text(i+" / "+pages,198,290,{align:"right"});
 }
}
async function report(){
 const sel=$("t2ReportSelect")?.value||"presidente_br",message=$("t2ReportMessage"),button=$("t2ReportBtn");
 if(message)message.textContent="";
 if(!available()){if(message)message.textContent="O 2º turno ainda não aconteceu. Nenhum relatório de votos está disponível.";return;}
 let keys=sel==="estados"?["presidente_br",...UF.map(x=>"presidente_"+x[0].toLowerCase())]:sel==="uf"?["presidente_"+selectedUF.toLowerCase()]:[sel];
 keys=keys.filter(k=>hasVotes(validReport(k)));
 if(!keys.length){if(message)message.textContent="Ainda não há resultados oficiais para este relatório. Tente atualizar.";return;}
 if(button){button.disabled=true;button.textContent="Gerando PDF...";}
 try{
  const JSPDF=await ensurePdf(),pdf=new JSPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  const name=sel==="estados"?"Brasil por estado":sel==="uf"?selectedUF:Object.fromEntries(AREAS)[sel]||sel;
  docHeader(pdf,"RELATORIO DE APURACAO | 2o TURNO",name);
  pdf.setFontSize(8);pdf.setTextColor(95,103,112);
  pdf.text("Gerado em "+new Date().toLocaleString("pt-BR")+" | Situacao: parcial ou final, conforme fonte TSE",14,46);
  let y=59;
  for(const key of keys)y=reportInfo(pdf,key,y);
  reportFooter(pdf);
  pdf.save("DWTech_BU2026_Segundo_Turno_"+sel.replace(/[^a-z]/g,"_")+".pdf");
  if(message)message.textContent="PDF gerado com "+keys.length+" localidade(s) com dados oficiais disponíveis.";
 }catch(err){
  console.error(err);if(message)message.textContent="Não foi possível gerar PDF: "+err.message;
 }finally{if(button){button.disabled=false;button.textContent="📄 Gerar relatório PDF";}}
}
function init(){
 if(started)return;started=true;
 loadFirstCache();tvButton();paint();loadFirstStates();if(available())refresh();
 setInterval(()=>{if(document.visibilityState==="visible"){paint();if(navigator.onLine&&available()&&mapMode==="second")refresh();}},30000);
 setInterval(()=>{if(document.visibilityState==="visible")pulse();},5000);
 window.addEventListener("online",()=>{if(mapMode==="first")loadFirstStates();else refresh();});
 window.addEventListener("offline",connection);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){paint();if(mapMode==="second"&&available())refresh();}});
}
window.BUCentral={selectUF,selectMapMode,lookupCity,selectCityByIBGE,zoomMap,resetMapZoom,refresh:refreshAll,share,toggleTV,report,getCityDirectory:async uf=>(await loadCityDirectory())[uf]||[],get currentMapMode(){return mapMode;},get stateResults(){return {...stateData}},get firstRoundStates(){return {...firstStates}}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();