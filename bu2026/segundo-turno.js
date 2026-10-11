/* DW Tech • Apuração presidencial do segundo turno 2026 (eleição TSE 6258) */
(()=>{
"use strict";
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados";
const RELEASE=Date.UTC(2026,9,25,20,0,0); // 25/10/2026 17h no horário de Brasília
const AREAS=[
 {id:"br",key:"presidente_br",name:"Brasil + exterior",short:"BRASIL",url:BASE+"/br/br-c0001-e006258-u.json"},
 {id:"ma",key:"presidente_ma",name:"Maranhão",short:"MARANHÃO",url:BASE+"/ma/ma-c0001-e006258-u.json"},
 {id:"odc",key:"presidente_odc",name:"Olho d’Água das Cunhãs",short:"OLHO D’ÁGUA",url:BASE+"/ma/ma08478-c0001-e006258-u.json"},
 {id:"vf",key:"presidente_vf",name:"Vitorino Freire",short:"VITORINO FREIRE",url:BASE+"/ma/ma09539-c0001-e006258-u.json"}
];
let selected="br",results={},finalists=[],updated=0,inFlight=null,timer=null;
const $=id=>document.getElementById(id);
const n=v=>Number(v)||0;
const decimal=v=>Number(String(v??0).replace(",","."))||0;
const fmt=v=>n(v).toLocaleString("pt-BR");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const hasReleased=()=>Date.now()>=RELEASE;
function officialReady(r){
 return !!r&&r.fase!=="s"&&r.divulgacao!=="n"&&n(r.secoes?.totalizadas)>0&&
        (r.candidatos||[]).some(c=>n(c.votos)>0)&&hasReleased();
}
function statusText(r){
 if(!officialReady(r))return "Aguardando apuração";
 return r.totalizacaoFinal==="s"||r.andamento==="f"?"Finalizado":"Apuração parcial";
}
function normalize(key,doc,url){
 if(!doc||typeof doc!=="object"||(doc.f&&doc.f!=="o"))return null;
 const area=AREAS.find(a=>a.key===key);if(!area)return null;
 const candidates=[];
 for(const cargo of doc.carg||[])for(const agr of cargo.agr||[])for(const par of agr.par||[])for(const c of par.cand||[]){
  candidates.push({numero:String(c.n??""),nome:c.nmu||c.nm||"",partido:par.sg||"",votos:n(c.vap),percentual:decimal(c.pvap),situacao:c.st||""});
 }
 candidates.sort((a,b)=>b.votos-a.votos);
 const s=doc.s||{},v=doc.v||{},e=doc.e||{};
 return {key,cargo:"Presidente",abrangencia:area.name,fase:doc.f,divulgacao:doc.dv,andamento:doc.and,totalizacaoFinal:doc.tf,
  geradoEm:{data:doc.dg||"",hora:doc.hg||""},secoes:{total:n(s.ts),totalizadas:n(s.st),percentual:decimal(s.pst)},
  eleitores:{total:n(e.te),comparecimento:n(e.c),abstencao:n(e.a)},
  votos:{validos:n(v.vv),brancos:n(v.vb),nulos:n(v.tvn)},candidatos:candidates,sourceUrl:url};
}
function pickCandidates(r){
 if(officialReady(r))return (r.candidatos||[]).slice(0,2);
 return finalists.map(c=>({...c,votos:null,percentual:null}));
}
function cardForCandidate(c,i,hasVotes){
 const pct=Math.max(0,Math.min(100,decimal(c.percentual)));
 return '<article class="t2-candidate">'+
  '<div class="t2-candidate-top"><span class="t2-number">'+esc(c.numero||"—")+'</span><span class="t2-position">'+(hasVotes?(i+1)+"º lugar":"Candidato")+'</span></div>'+
  '<h3>'+esc(c.nome||"Candidato a presidente")+'</h3><p>'+esc(c.partido||"")+'</p>'+
  '<strong class="t2-percent">'+(hasVotes?pct.toFixed(2).replace(".",",")+"%":"—")+'</strong>'+
  '<div class="t2-progress" role="img" aria-label="'+esc(hasVotes?"Percentual de votos válidos: "+pct.toFixed(2)+"%":"Aguardando apuração")+'"><i style="width:'+(hasVotes?pct:0)+'%"></i></div>'+
  '<div class="t2-vote-count">'+(hasVotes?fmt(c.votos)+" votos válidos":"Votos do 2º turno ainda não divulgados")+'</div></article>';
}
function render(){
 const area=AREAS.find(a=>a.id===selected)||AREAS[0];
 const r=results[area.key],ready=officialReady(r);
 const status=$("turno2Status"),summary=$("turno2Summary"),candidates=$("turno2Candidates"),areas=$("turno2Areas"),headline=$("turno2Headline"),time=$("turno2Updated");
 if(!status||!summary||!candidates||!areas)return;
 if(headline)headline.textContent="Apuração para presidente • "+area.name;
 if(!hasReleased()){
  status.textContent="O 2º turno será em 25/10/2026. Resultados disponíveis somente após a divulgação oficial do TSE, a partir das 17h (Brasília).";
 }else if(!ready){
  status.textContent="Aguardando publicação dos resultados oficiais do 2º turno pelo TSE. Nenhum voto do 1º turno será utilizado nesta tela.";
 }else{
  status.textContent="Dados oficiais do TSE • "+statusText(r)+" • "+area.name+". Atualização automática a cada 30 segundos enquanto esta aba estiver aberta.";
 }
 areas.innerHTML=AREAS.map(a=>{
  const item=results[a.key],isReady=officialReady(item),pct=isReady?decimal(item.secoes.percentual).toFixed(2).replace(".",",")+"%":"—";
  return '<button type="button" class="t2-area '+(selected===a.id?"selected":"")+'" onclick="BUSecondRound.select(\''+a.id+'\')" aria-pressed="'+(selected===a.id?'true':'false')+'"><span>'+esc(a.short)+'</span><strong>'+pct+'</strong><small>'+statusText(item)+'</small></button>';
 }).join("");
 const dash="—";
 summary.innerHTML=[
  ["Seções totalizadas",ready?fmt(r.secoes.totalizadas)+" / "+fmt(r.secoes.total):dash],
  ["Progresso",ready?decimal(r.secoes.percentual).toFixed(2).replace(".",",")+"%":dash],
  ["Votos válidos",ready?fmt(r.votos.validos):dash],
  ["Brancos",ready?fmt(r.votos.brancos):dash],
  ["Nulos",ready?fmt(r.votos.nulos):dash],
  ["Comparecimento",ready?fmt(r.eleitores.comparecimento):dash]
 ].map(([label,value])=>'<div class="t2-stat"><span>'+label+'</span><strong>'+value+'</strong></div>').join("");
 const listed=pickCandidates(r);
 candidates.innerHTML=listed.length?listed.map((c,i)=>cardForCandidate(c,i,ready)).join(""):
  '<div class="t2-empty">Os dois candidatos classificados aparecem aqui após a leitura da base oficial. A votação do 2º turno permanece separada do 1º turno.</div>';
 const timestamp=ready?[r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" "):"—";
 if(time)time.textContent="Fonte: Tribunal Superior Eleitoral • eleição 6258 • Atualização TSE: "+timestamp;
 const link=$("turno2Source");if(link)link.href=area.url;
}
async function fetchJson(url,timeoutMs=12000){
 const controller=new AbortController();const t=setTimeout(()=>controller.abort(),timeoutMs);
 try{const res=await fetch(url+(url.includes("?")?"&":"?")+"_="+Date.now(),{cache:"no-store",signal:controller.signal});if(!res.ok)throw Error("HTTP "+res.status);return await res.json();}
 finally{clearTimeout(t);}
}
async function loadFinalists(){
 if(finalists.length)return;
 try{
  const source=await fetchJson("./resultados-oficiais.json",10000);
  const all=source?.results?.presidente_br?.candidatos||[];
  const selected=all.filter(c=>/2\s*[º°o]?\s*turno/i.test(c.situacao||"")).slice(0,2);
  if(selected.length===2)finalists=selected.map(c=>({numero:c.numero,nome:c.nome,partido:c.partido}));
 }catch{}
 render();
}
async function fetchResults(force=false){
 if(inFlight)return inFlight;
 if(!hasReleased()){await loadFinalists();render();return;}
 if(!force&&Date.now()-updated<25000){render();return;}
 inFlight=(async()=>{
  const fetched={};
  const calls=[fetchJson("./resultados-segundo-turno.json",11000).catch(()=>null),
               ...AREAS.map(a=>fetchJson(a.url).catch(()=>null))];
  const data=await Promise.all(calls);
  const snapshot=data[0]?.results||{};
  for(const a of AREAS){
   const r=snapshot[a.key];
   if(r&&r.fase!=="s")fetched[a.key]=r;
  }
  AREAS.forEach((a,i)=>{
   const normalized=normalize(a.key,data[i+1],a.url);
   if(normalized&&officialReady(normalized))fetched[a.key]=normalized;
  });
  results=fetched;
  updated=Date.now();
  if(!Object.values(results).some(officialReady))await loadFinalists();
  render();
 })().finally(()=>inFlight=null);
 return inFlight;
}

/* Visão limpa para TV/telão, com alternativa para navegadores sem Fullscreen API. */
function fullscreenHost(){return $("segundo-turno");}
function fullscreenActive(){
 const host=fullscreenHost();
 return !!host&&(document.fullscreenElement===host||host.classList.contains("t2-fullscreen-fallback"));
}
function updateFullscreenButton(){
 const button=$("turno2FullscreenBtn");
 if(!button)return;
 const active=fullscreenActive();
 button.textContent=active?"↙ Sair da tela cheia":"⛶ Tela cheia";
 button.setAttribute("aria-pressed",String(active));
 button.setAttribute("aria-label",active?"Sair da tela cheia":"Exibir apuração em tela cheia");
}
function closeFullscreenFallback(){
 const host=fullscreenHost();
 if(!host?.classList.contains("t2-fullscreen-fallback"))return;
 host.classList.remove("t2-fullscreen-fallback");
 document.body.classList.remove("t2-fullscreen-open");
 updateFullscreenButton();
}
async function toggleFullscreen(){
 const host=fullscreenHost();
 if(!host)return;
 if(host.classList.contains("t2-fullscreen-fallback")){
  closeFullscreenFallback();
  return;
 }
 if(document.fullscreenElement===host){
  try{await document.exitFullscreen();}catch(error){console.warn("Não foi possível sair da tela cheia.",error);}
  updateFullscreenButton();
  return;
 }
 if(typeof host.requestFullscreen==="function"){
  try{
   await host.requestFullscreen({navigationUI:"hide"});
   updateFullscreenButton();
   return;
  }catch(error){
   console.warn("Modo nativo indisponível; usando modo telão.",error);
  }
 }
 // Safari no iPhone e outros ambientes podem não aceitar fullscreen de elementos.
 host.classList.add("t2-fullscreen-fallback");
 document.body.classList.add("t2-fullscreen-open");
 updateFullscreenButton();
}
function activate(){render();fetchResults(false);}
function select(id){if(!AREAS.some(a=>a.id===id))return;selected=id;render();if(hasReleased()&&Date.now()-updated>25000)fetchResults();}
function init(){
 document.addEventListener("fullscreenchange",updateFullscreenButton);
 document.addEventListener("webkitfullscreenchange",updateFullscreenButton);
 document.addEventListener("keydown",event=>{if(event.key==="Escape")closeFullscreenFallback();});
 render();
 updateFullscreenButton();
 timer=setInterval(()=>{
  if(document.visibilityState==="visible"&&$("segundo-turno")?.classList.contains("active")&&navigator.onLine)fetchResults(false);
 },30000);
 window.addEventListener("online",()=>{if($("segundo-turno")?.classList.contains("active"))fetchResults(true)});
 if($("segundo-turno")?.classList.contains("active"))activate();
}
window.BUSecondRound={activate,refresh:()=>fetchResults(true),select,toggleFullscreen,get results(){return {...results}}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();