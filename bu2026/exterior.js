/* DW Tech • Exterior, segundo turno presidencial 2026 • fonte TSE, eleição 6258. */
(()=>{
"use strict";
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/";
const RELEASE=Date.UTC(2026,9,25,20),INTERVAL=5000;
const $=id=>document.getElementById(id);
const number=v=>Math.max(0,Number(String(v??0).replace(",","."))||0);
const fmt=v=>number(v).toLocaleString("pt-BR");
const pct=v=>number(v).toFixed(2).replace(".",",")+"%";
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const finalists=[{numero:"13",nome:"LULA",partido:"PT"},{numero:"22",nome:"FLAVIO BOLSONARO",partido:"PL"}];
let catalog=[],catalogPromise=null,country="",locality="",inFlight=null,lastCheck=0;
const results=new Map();
const failures=new Set();
const scope=()=>country+"/"+locality;
const source=code=>BASE+"zz"+(code==="zz"?"":code)+"-c0001-e006258-u.json";
const locations=()=>catalog.filter(item=>item.pais===country);
const ready=r=>!!r&&r.fase==="o"&&r.divulgacao!=="n"&&number(r.secoes?.totalizadas)>0&&Date.now()>=RELEASE;
const setText=(id,value)=>{const el=$(id);if(el&&el.textContent!==value)el.textContent=value};
const setHTML=(id,value)=>{const el=$(id);if(el&&el.innerHTML!==value)el.innerHTML=value};

async function json(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(url+(url.includes("?")?"&":"?")+"_="+Date.now(),{cache:"no-store",signal:controller.signal});
  if(!response.ok)throw Error("HTTP "+response.status);
  return await response.json();
 }finally{clearTimeout(timer)}
}
async function loadCatalog(){
 if(catalog.length)return;
 if(catalogPromise)return catalogPromise;
 catalogPromise=(async()=>{
  const doc=await json("./exterior-localidades.json");
  catalog=(doc.localidades||[]).filter(item=>/^\d{5}$/.test(item.codigo)&&typeof item.nome==="string"&&typeof item.pais==="string");
  renderFilters();
 })().catch(()=>{
  setText("exteriorCoverage","A lista de países está indisponível. O total do exterior continua sendo consultado.");
 }).finally(()=>catalogPromise=null);
 return catalogPromise;
}
function normalize(doc,code){
 if(!doc||String(doc.ele)!=="6258"||String(doc.t)!=="2"||doc.f!=="o"||![code,code==='zz'?'zz':'zz'+code].includes(String(doc.cdabr).toLowerCase()))return null;
 const cargo=(doc.carg||[]).find(c=>String(c.cd)==="1");
 if(!cargo||!doc.s||!doc.e||!doc.v)return null;
 const candidatos=[];
 for(const group of cargo.agr||[])for(const party of group.par||[])for(const c of party.cand||[]){
  candidatos.push({numero:String(c.n),nome:c.nmu||c.nm||"",partido:party.sg||"",votos:number(c.vap),percentual:number(c.pvap)});
 }
 if(!finalists.every(f=>candidatos.some(c=>c.numero===f.numero)))return null;
 return {fase:doc.f,divulgacao:doc.dv,andamento:doc.and,totalizacaoFinal:doc.tf,
  geradoEm:{data:doc.dg||"",hora:doc.hg||""},totalizadoEm:{data:doc.dt||"",hora:doc.ht||""},
  secoes:{total:number(doc.s.ts),totalizadas:number(doc.s.st),percentual:number(doc.s.pst)},
  eleitores:{total:number(doc.e.te),comparecimento:number(doc.e.c),abstencao:number(doc.e.a)},
  votos:{validos:number(doc.v.vv),brancos:number(doc.v.vb),nulos:number(doc.v.tvn)},candidatos,sourceUrl:source(code)};
}
function stamp(r){
 const date=r?.geradoEm?.data?.split("/")||[],time=r?.geradoEm?.hora||"00:00:00";
 return date.length===3?Date.parse(date[2]+"-"+date[1]+"-"+date[0]+"T"+time+"-03:00")||0:0;
}
function accept(code,r){
 if(!r)return false;
 const previous=results.get(code);
 if(previous&&(stamp(r)<stamp(previous)||(ready(previous)&&!ready(r))))return true;
 results.set(code,r);return true;
}
async function loadLocalitySnapshot(){
 try{
  const doc=await json("./resultados-exterior-localidades.json");
  if(doc.meta?.official!==true||Number(doc.meta.eleicao)!==6258||Number(doc.meta.turno)!==2)return false;
  let valid=0;
  for(const [code,r] of Object.entries(doc.results||{})){
   if(!/^\d{5}$/.test(code)||!catalog.some(x=>x.codigo===code)||Number(r.eleicao)!==6258||Number(r.turno)!==2||r.codigoAbrangencia!==code)continue;
   if(accept(code,r))valid++;
  }
  return valid>0;
 }catch{return false}
}
async function fallback(){
 try{
  const doc=await json("./resultados-segundo-turno.json"),r=doc.results?.presidente_zz;
  if(doc.meta?.eleicao===6258&&doc.meta?.turno===2&&r?.eleicao===6258&&r.turno===2&&r.codigoAbrangencia==="zz"&&r.fase==="o"&&Array.isArray(r.candidatos))return accept("zz",r);
 }catch{}
 return false;
}
async function queryCodes(codes){
 let cursor=0,successes=0;
 await Promise.all(Array.from({length:Math.min(4,codes.length)},async()=>{
  while(cursor<codes.length){
   const code=codes[cursor++];
   try{
    if(accept(code,normalize(await json(source(code)),code))){successes++;failures.delete(code)}
    else failures.add(code);
   }catch{failures.add(code)}
  }
 }));
 return successes;
}
function aggregate(items=locations()){
 const available=items.map(x=>results.get(x.codigo)).filter(Boolean),published=available.filter(ready);
 if(!published.length)return null;
 const r={fase:"o",divulgacao:"s",secoes:{total:0,totalizadas:0,percentual:0},eleitores:{total:0,comparecimento:0,abstencao:0},votos:{validos:0,brancos:0,nulos:0},candidatos:finalists.map(c=>({...c,votos:0,percentual:0})),incompleto:available.length!==items.length};
 for(const item of available){
  r.secoes.total+=item.secoes.total;r.eleitores.total+=item.eleitores.total;
  if(!ready(item))continue;
  r.secoes.totalizadas+=item.secoes.totalizadas;
  for(const key of ["comparecimento","abstencao"])r.eleitores[key]+=number(item.eleitores[key]);
  for(const key of Object.keys(r.votos))r.votos[key]+=number(item.votos[key]);
  for(const c of r.candidatos)c.votos+=number(item.candidatos.find(x=>x.numero===c.numero)?.votos);
 }
 r.secoes.percentual=r.secoes.total?100*r.secoes.totalizadas/r.secoes.total:0;
 for(const c of r.candidatos)c.percentual=r.votos.validos?100*c.votos/r.votos.validos:0;
 // A data mais antiga identifica o limite de frescor da soma, nunca uma atualização fictícia.
 const oldest=published.slice().sort((a,b)=>stamp(a)-stamp(b))[0];
 r.geradoEm=oldest.geradoEm;return r;
}
function renderFilters(){
 const countries=[...new Set(catalog.map(x=>x.pais))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 setHTML("exteriorCountry",'<option value="">Total do exterior</option>'+countries.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join(""));
 const picker=$("exteriorCountry");if(picker)picker.value=country;
 const items=locations();
 setHTML("exteriorLocality",'<option value="">Todas as localidades do país / território</option>'+items.map(x=>'<option value="'+x.codigo+'">'+esc(x.nome)+'</option>').join(""));
 const city=$("exteriorLocality");if(city){city.value=locality;city.disabled=!country}
}
function countryOverview(){
 if(!catalog.length)return '<p class="exterior-coverage">Carregando lista de países do TSE…</p>';
 const groups=new Map();
 for(const place of catalog){
  if(!groups.has(place.pais))groups.set(place.pais,[]);
  groups.get(place.pais).push(place);
 }
 const entries=[...groups].map(([name,places])=>{
  const counted=places.filter(x=>ready(results.get(x.codigo)));
  const votes=num=>counted.reduce((sum,x)=>sum+number(results.get(x.codigo).candidatos.find(c=>String(c.numero)===num)?.votos),0);
  return {name,total:places.length,loaded:counted.length,lula:votes("13"),flavio:votes("22")};
 }).sort((a,b)=>(b.lula+b.flavio)-(a.lula+a.flavio)||a.name.localeCompare(b.name,"pt-BR"));
 const total=entries.reduce((n,x)=>n+x.loaded,0);
 return '<div class="exterior-country-title"><h3>Votos separados por país</h3><span>'+fmt(total)+' de '+fmt(catalog.length)+' localidades com apuração</span></div>'+
 '<p class="exterior-coverage">Votos oficiais por localidade do TSE agrupados pela DW Tech. Selecione um país para visualizar suas cidades. Os países sem dados confirmados aparecem sem votos, não como zero.</p>'+
 (total?'':'<p class="exterior-coverage">O total geral pode estar disponível antes dos arquivos por localidade. Ainda não há votos individualizados confirmados nesta sincronização.</p>')+
 '<div class="exterior-country-grid">'+entries.map(x=>
 '<article class="exterior-country-card"><button type="button" class="exterior-country-name" data-country="'+esc(x.name)+'" onclick="BUExterior.selectCountry(this.dataset.country)">'+esc(x.name)+' <span aria-hidden="true">›</span></button>'+
 '<div class="exterior-country-metrics"><div><small>Lula • 13</small><strong class="exterior-red">'+(x.loaded?fmt(x.lula):"—")+'</strong></div>'+
 '<div><small>Flávio • 22</small><strong class="exterior-blue">'+(x.loaded?fmt(x.flavio):"—")+'</strong></div></div>'+
 '<p class="exterior-country-progress">Localidades com votos: '+fmt(x.loaded)+' / '+fmt(x.total)+'</p></article>').join("")+'</div>';
}
function render(){
 const items=locations(),place=catalog.find(x=>x.codigo===locality);
 const oficial=results.get("zz");
 const parcial=!country&&!locality&&!ready(oficial)?aggregate(catalog):null;
 const r=locality?results.get(locality):country?aggregate():ready(oficial)?oficial:parcial||oficial,hasVotes=ready(r);
 const totalPorLocalidades=!!parcial&&r===parcial;
 const zzSemTotalizacao=!!oficial&&number(oficial.secoes?.totalizadas)===0;
 const localidadesSemVotos=!!country&&items.length>0&&items.every(x=>results.has(x.codigo)&&!ready(results.get(x.codigo)));
 const label=place?place.nome+" • "+country:country||"Exterior • total geral";
 const stale=locality?failures.has(locality):country?items.some(x=>failures.has(x.codigo)):failures.has("zz");
 setText("exteriorHeadline","Apuração para presidente • "+label);
 setText("exteriorStatus",hasVotes?(totalPorLocalidades?"Soma parcial dos arquivos oficiais das localidades do exterior (não é o total oficial ZZ).":country?"Soma por país dos arquivos oficiais das localidades do TSE.":"Dados oficiais do TSE • "+label+".")+" "+(stale?"Falha na última consulta. Última parcial preservada.":"Atualização automática a cada 5 segundos."):localidadesSemVotos?"O TSE ainda informa zero seções totalizadas nas localidades de "+label+". Os dados deste país não devem ser confundidos com o total nacional.":zzSemTotalizacao?"O TSE informa 0 seções totalizadas no exterior (ZZ). O total Brasil + exterior não representa a votação exclusiva do exterior.":"Aguardando divulgação dos votos oficiais do segundo turno para "+label+".");
 const dash="—";
 setHTML("exteriorSummary",[
  ["Seções totalizadas",hasVotes?fmt(r.secoes.totalizadas)+(r.incompleto?" (parcial)":" / "+fmt(r.secoes.total)):dash],
  ["Progresso",hasVotes&&!r.incompleto?pct(r.secoes.percentual):dash],
  ["Votos válidos",hasVotes?fmt(r.votos.validos):dash],
  ["Brancos / nulos",hasVotes?fmt(r.votos.brancos)+" / "+fmt(r.votos.nulos):dash],
  ["Comparecimento",hasVotes?fmt(r.eleitores.comparecimento):dash],
  ["Abstenção apurada",hasVotes?fmt(r.eleitores.abstencao):dash]
 ].map(([key,value])=>'<div class="t2-stat"><span>'+key+'</span><strong>'+value+'</strong></div>').join(""));
 const ranked=hasVotes?r.candidatos.slice().sort((a,b)=>b.votos-a.votos):[];
 const candidates=finalists.map(f=>hasVotes?(r.candidatos.find(c=>c.numero===f.numero)||f):f);
 setHTML("exteriorCandidates",candidates.map((c,i)=>window.BUSecondRound.candidateCard(c,i,hasVotes,ranked.findIndex(x=>x.numero===c.numero)+1)).join(""));
 const loaded=items.filter(x=>results.has(x.codigo)).length,published=items.filter(x=>ready(results.get(x.codigo))).length;
 if(country){
  const failed=items.filter(x=>failures.has(x.codigo)).length;
  setText("exteriorCoverage",country+" • "+loaded+" / "+items.length+" localidades consultadas • "+published+" com votos apurados."+(loaded<items.length?" Cobertura incompleta: há localidades indisponíveis.":" O total do país soma as localidades abaixo.")+(failed?" Falha na última consulta de "+failed+" localidade(s); a última parcial disponível foi preservada.":""));
 }else if(catalog.length){
  setText("exteriorCoverage",totalPorLocalidades?"Parcial calculada a partir de "+catalog.filter(x=>ready(results.get(x.codigo))).length+" de "+catalog.length+" localidades do exterior. Não corresponde à totalização oficial ZZ; os demais locais ainda não foram confirmados.":"Total oficial do exterior (ZZ). Selecione um país / território para consultar suas localidades.");
 }
 setHTML("exteriorLocations",country?'<div class="table-wrap"><table><thead><tr><th>Localidade do TSE</th><th>Lula • 13</th><th>Flávio • 22</th><th>Seções apuradas</th><th>Situação</th></tr></thead><tbody>'+items.map(item=>{
  const row=results.get(item.codigo),ok=ready(row);
  const votes=num=>ok?fmt(row.candidatos.find(c=>c.numero===num)?.votos):dash;
  return '<tr><td><strong>'+esc(item.nome)+'</strong></td><td class="exterior-red">'+votes("13")+'</td><td class="exterior-blue">'+votes("22")+'</td><td>'+(row?fmt(row.secoes.totalizadas)+" / "+fmt(row.secoes.total):dash)+'</td><td>'+(row&&failures.has(item.codigo)?"Última parcial • falha na consulta":ok?(row.secoes.totalizadas===row.secoes.total?"Totalizada":"Parcial"):row?"Aguardando":"Indisponível")+'</td></tr>';
 }).join("")+'</tbody></table></div>':countryOverview());
 const time=hasVotes?[r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" "):dash;
 setText("exteriorUpdated","Fonte: TSE • eleição 6258 • "+((country&&!locality)||totalPorLocalidades?"Arquivo mais antigo na soma: ":"Atualização TSE: ")+time);
 const link=$("exteriorSource");if(link)link.href=source(locality||"zz");
}
function feedback(message,busy=false){
 setText("exteriorFeedback",message);setText("exteriorRefreshLabel",busy?"Consultando TSE...":"Atualizar TSE");
 const button=$("exteriorRefreshBtn");if(button){button.disabled=busy;button.setAttribute("aria-busy",String(busy))}
 if(lastCheck)setText("exteriorLastCheck","Última consulta: "+new Date(lastCheck).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
}
function refresh(){
 if(inFlight)return inFlight;
 let requestedScope=scope();
 inFlight=(async()=>{
  feedback("Consultando a apuração oficial do exterior...",true);
  await loadCatalog();requestedScope=scope();
  // Primeiro mostra o ultimo snapshot confiavel servido no mesmo dominio (sem bloqueio CORS).
  await Promise.all([loadLocalitySnapshot(),fallback()]);
  render();
  if(!navigator.onLine){feedback("Sem conexão. A última parcial recebida foi preservada.");return}
  if(Date.now()<RELEASE){render();feedback("Aguardando o horário de divulgação oficial do segundo turno.");return}
  const codes=["zz",...(locality?[locality]:country?locations().map(x=>x.codigo):[])];
  let count=await queryCodes(codes);
  // O arquivo de reserva ja foi consultado, independentemente do filtro selecionado.
  if(count)lastCheck=Date.now();
  const selectedCodes=locality?[locality]:country?locations().map(x=>x.codigo):["zz"];
  const failed=selectedCodes.filter(code=>failures.has(code)).length;
  render();
  const cached=locality?ready(results.get(locality)):country?!!aggregate():ready(results.get("zz"))||!!aggregate(catalog);
  feedback(failed?"Falha na consulta direta ao TSE em "+failed+" de "+selectedCodes.length+" consulta(s). "+(cached?"Última parcial oficial disponível preservada.":"Aguardando arquivo oficial.") :count?"Consulta ao TSE concluída.":cached?"Exibindo dados oficiais da última sincronização.":"Aguardando resultados oficiais do TSE; tente novamente.");
 })().catch(error=>{
  console.warn("Consulta do exterior indisponível:",error);feedback("Não foi possível consultar o TSE. A última parcial foi preservada.");
 }).finally(()=>{
  inFlight=null;
  if(requestedScope!==scope()&&$("exterior")?.classList.contains("active"))refresh();
 });
 return inFlight;
}
function selectCountry(value){
 if(value&&!catalog.some(x=>x.pais===value))return Promise.resolve();
 country=value;locality="";renderFilters();render();return refresh();
}
function selectLocality(value){
 if(value&&!locations().some(x=>x.codigo===value))return Promise.resolve();
 locality=value;renderFilters();render();return refresh();
}
async function activate(){render();return refresh()}
function fullscreenButton(){
 const host=$("exterior"),active=document.fullscreenElement===host||host?.classList.contains("t2-fullscreen-fallback");
 const button=$("exteriorFullscreenBtn");if(button){button.textContent=active?"↙ Sair da tela cheia":"⛶ Tela cheia";button.setAttribute("aria-pressed",String(!!active))}
}
function closeFallback(){
 $("exterior")?.classList.remove("t2-fullscreen-fallback");document.body.classList.remove("t2-fullscreen-open");fullscreenButton();
}
async function toggleFullscreen(){
 const host=$("exterior");if(!host)return;
 if(host.classList.contains("t2-fullscreen-fallback")){closeFallback();return}
 if(document.fullscreenElement===host){await document.exitFullscreen();fullscreenButton();return}
 try{if(host.requestFullscreen){await host.requestFullscreen({navigationUI:"hide"});fullscreenButton();return}}catch{}
 host.classList.add("t2-fullscreen-fallback");document.body.classList.add("t2-fullscreen-open");fullscreenButton();
}
function init(){
 render();
 setInterval(()=>{if(document.visibilityState==="visible"&&$("exterior")?.classList.contains("active")&&navigator.onLine)refresh()},INTERVAL);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&$("exterior")?.classList.contains("active"))refresh()});
 document.addEventListener("fullscreenchange",fullscreenButton);
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("exterior")?.classList.contains("t2-fullscreen-fallback"))closeFallback()});
 window.addEventListener("online",()=>{if($("exterior")?.classList.contains("active"))refresh()});
 if($("exterior")?.classList.contains("active"))activate();
}
window.BUExterior={activate,refresh,selectCountry,selectLocality,toggleFullscreen};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
