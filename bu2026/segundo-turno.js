/* DW Tech • Apuração presidencial do segundo turno 2026 (eleição TSE 6258) */
(()=>{
"use strict";
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados";
const RELEASE=Date.UTC(2026,9,25,20,0,0); // 25/10/2026 17h no horário de Brasília
const REFRESH_INTERVAL_MS=5000;
const AREAS=[
 {id:"br",key:"presidente_br",name:"Brasil + exterior",short:"BRASIL",url:BASE+"/br/br-c0001-e006258-u.json"},
 {id:"ma",key:"presidente_ma",name:"Maranhão",short:"MARANHÃO",url:BASE+"/ma/ma-c0001-e006258-u.json"},
 {id:"odc",key:"presidente_odc",name:"Olho d’Água das Cunhãs",short:"OLHO D’ÁGUA",url:BASE+"/ma/ma08478-c0001-e006258-u.json"},
 {id:"vf",key:"presidente_vf",name:"Vitorino Freire",short:"VITORINO FREIRE",url:BASE+"/ma/ma09539-c0001-e006258-u.json"}
];
/* Fotografias originais cadastradas para exibição na urna em 2026.
   Origem oficial: TSE, eleição federal do 1º turno (6257), pasta fotos/br/{sqcand}.jpeg.
   Mantidas independentes dos resultados do 2º turno (6258). */
const TSE_URNA_PHOTOS={
 "22":"https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002551544.jpeg",
 "13":"https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br/280002542548.jpeg"
};
const PHOTO_CREDITS={
 "22":{by:"TSE • foto cadastrada na urna 2026",license:"Registro eleitoral",page:TSE_URNA_PHOTOS["22"]},
 "13":{by:"TSE • foto cadastrada na urna 2026",license:"Registro eleitoral",page:TSE_URNA_PHOTOS["13"]}
};
let selected="br",results={},finalists=[
 {numero:"13",nome:"LULA",partido:"PT"},
 {numero:"22",nome:"FLAVIO BOLSONARO",partido:"PL"}
],updated=0,inFlight=null,timer=null,countdownTimer=null,countdownFinished=false;
let manualRefreshing=false,lastConsultation=0;
const NATIONAL_LEAD_KEY="dwtech-bu2026-national-leader-6258-v1";
let nationalLeadState=null,lulaFlashUntil=0,lulaFlashTimer=null;
const $=id=>document.getElementById(id);
const n=v=>Number(v)||0;
const decimal=v=>Number(String(v??0).replace(",","."))||0;
const fmt=v=>n(v).toLocaleString("pt-BR");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const hasReleased=()=>Date.now()>=RELEASE;

/* Relógio do segundo turno: 25/10/2026 às 17h de Brasília (UTC-03). */
function countdownParts(now=Date.now()){
 const remaining=Math.max(0,Math.ceil((RELEASE-now)/1000));
 return {
  remaining,
  days:Math.floor(remaining/86400),
  hours:Math.floor(remaining%86400/3600),
  minutes:Math.floor(remaining%3600/60),
  seconds:remaining%60
 };
}
function renderCountdown(now=Date.now()){
 const root=$("turno2Countdown");
 if(!root)return;
 const c=countdownParts(now);
 const pad=n=>String(n).padStart(2,"0");
 const values=[
  ["Days",c.days],["Hours",c.hours],["Minutes",c.minutes],["Seconds",c.seconds]
 ];
 if(c.remaining>0){
  root.hidden=false;
  root.dataset.stage="countdown";
  const title=$("turno2CountdownTitle");
  if(title)title.textContent="Falta para o início da divulgação dos resultados";
  const status=$("turno2CountdownMessage");
  if(status)status.textContent="Domingo, 25 de outubro de 2026 • 17h de Brasília";
  const parts={Days:c.days,Hours:c.hours,Minutes:c.minutes,Seconds:c.seconds};
  for(const [label,value] of Object.entries(parts)){
   const el=$("turno2Count"+label);
   if(el)el.textContent=label==="Days"?String(value):pad(value);
  }
  countdownFinished=false;
 }else{
  // Libera o espaço do painel quando termina a contagem, sem interromper a apuração.
  root.hidden=true;
  root.dataset.stage="released";
  const title=$("turno2CountdownTitle");
  if(title)title.textContent="Chegou o horário previsto para a divulgação!";
  const status=$("turno2CountdownMessage");
  if(status)status.textContent="Consulte os resultados oficiais do TSE. A publicação pode ocorrer gradualmente.";
  for(const [label] of values){
   const el=$("turno2Count"+label);
   if(el)el.textContent="00";
  }
  if(!countdownFinished){
   countdownFinished=true;
   // Assim que o horário chega, atualiza a apuração ao invés de exibir dados estimados.
   if(navigator.onLine&&root.closest(".section")?.classList.contains("active"))fetchResults(true);
  }
 }
}

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
  eleitores:{total:n(e.te),comparecimento:e.c==null||e.c===""?null:n(e.c),abstencao:e.a==null||e.a===""?null:n(e.a)},
  votos:{validos:n(v.vv),brancos:n(v.vb),nulos:n(v.tvn)},candidatos:candidates,sourceUrl:url};
}
// Ordenação apenas visual: a classificação real continua determinada pelos votos.
function byNumber(a,b){return (Number(a.numero)||999)-(Number(b.numero)||999);}
function pickCandidates(r){
 if(officialReady(r))return (r.candidatos||[]).slice().sort((a,b)=>n(b.votos)-n(a.votos)).slice(0,2).sort(byNumber);
 return finalists.map(c=>({...c,votos:null,percentual:null})).sort(byNumber);
}
// Detecta somente virada real do 22 para o 13 na apuração nacional do TSE.
// O primeiro resultado observado nunca gera animação; empates preservam o último líder.
function observeNationalLead(){
 const r=results.presidente_br;
 if(!officialReady(r))return;
 const lula=(r.candidatos||[]).find(c=>String(c.numero)==="13");
 const outro=(r.candidatos||[]).find(c=>String(c.numero)==="22");
 if(!lula||!outro)return;
 const lulaVotes=n(lula.votos),otherVotes=n(outro.votos);
 if(lulaVotes+otherVotes<=0)return;
 const leader=lulaVotes>otherVotes?"13":otherVotes>lulaVotes?"22":"";
 const sections=n(r.secoes?.totalizadas),valid=n(r.votos?.validos);
 let previous=nationalLeadState;
 if(!previous){
  try{previous=JSON.parse(localStorage.getItem(NATIONAL_LEAD_KEY)||"null");}catch{}
 }
 // Ignora leituras antigas que poderiam simular uma virada falsa.
 if(previous&&(sections<n(previous.sections)||valid<n(previous.valid)))return;
 const previousLeader=previous?.lastStrictLeader||"";
 const changed=!previous||n(previous.lulaVotes)!==lulaVotes||n(previous.otherVotes)!==otherVotes;
 const next={lastStrictLeader:leader||previousLeader,lulaVotes,otherVotes,sections,valid};
 nationalLeadState=next;
 try{localStorage.setItem(NATIONAL_LEAD_KEY,JSON.stringify(next));}catch{}
 if(previous&&changed&&previousLeader==="22"&&leader==="13"){
  lulaFlashUntil=Date.now()+4800;
  if(lulaFlashTimer)clearTimeout(lulaFlashTimer);
  lulaFlashTimer=setTimeout(()=>{
   lulaFlashUntil=0;
   const card=$("turno2Candidates")?.querySelector('.t2-candidate[data-candidate-number="13"]');
   card?.classList.remove("t2-lula-virada");
   card?.querySelector(".t2-virada-note")?.remove();
  },4800);
 }
}
function decorateNationalLead(){
 if(selected!=="br"||Date.now()>=lulaFlashUntil)return;
 const card=$("turno2Candidates")?.querySelector('.t2-candidate[data-candidate-number="13"]');
 if(!card)return;
 card.classList.add("t2-lula-virada");
 if(card.querySelector(".t2-virada-note"))return;
 const note=document.createElement("div");
 note.className="t2-virada-note";
 note.setAttribute("role","status");
 note.textContent="↗ VIRADA NACIONAL • LULA ASSUME A LIDERANÇA";
 card.querySelector(".t2-candidate-top")?.insertAdjacentElement("afterend",note);
}
function cardForCandidate(c,i,hasVotes,rank){
 const number=String(c.numero||"");
 const palette=number==="22"?"blue":number==="13"?"red":"neutral";
 const photo=TSE_URNA_PHOTOS[number]||"";
 const credit=PHOTO_CREDITS[number];
 const pct=Math.max(0,Math.min(100,decimal(c.percentual)));
 const pctText=hasVotes?pct.toFixed(2).replace(".",",")+"%":"—";
 const label=hasVotes&&rank?rank+"º na apuração":"Candidatura oficial";
 const name=String(c.nome||"Candidato a presidente");
 const votes=hasVotes?fmt(c.votos)+" votos válidos":"Aguardando votos oficiais do segundo turno";
 const photoHtml=photo?'<img src="'+esc(photo)+'" alt="Foto cadastrada na urna eletrônica: '+esc(name)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">':"";
 return '<article class="t2-candidate" data-candidate-number="'+esc(number)+'" data-palette="'+palette+'" aria-label="'+esc(name)+', '+esc(c.partido||"")+'">'+
  '<div class="t2-candidate-top"><span class="t2-number">'+esc(number||"—")+'</span><span class="t2-position">'+esc(label)+'</span></div>'+
  '<div class="t2-candidate-profile">'+
   '<div class="t2-portrait" aria-label="Retrato de '+esc(name)+'"><span aria-hidden="true">'+esc(number||"•")+'</span>'+photoHtml+'</div>'+
   '<div class="t2-candidate-info"><span class="t2-office">Presidente da República</span><h3>'+esc(name)+'</h3><p>'+esc(c.partido||"")+'</p></div>'+
  '</div>'+
  '<div class="t2-candidate-metrics"><div class="t2-metric-label">'+(hasVotes?"Votos válidos":"Resultado do 2º turno")+'</div>'+
   '<strong class="t2-percent">'+pctText+'</strong>'+
   '<div class="t2-progress" role="img" aria-label="'+esc(hasVotes?"Percentual de votos válidos: "+pctText:"Votação ainda não divulgada")+'"><i style="width:'+(hasVotes?pct:0)+'%"></i></div>'+
   '<div class="t2-vote-count">'+votes+'</div>'+
   '<span class="t2-photo-source">Foto: '+(credit?'<a href="'+esc(credit.page)+'" target="_blank" rel="noopener noreferrer">'+esc(credit.by)+'</a> · '+esc(credit.license):'arquivo')+' • Apuração: TSE</span>'+
  '</div>'+
 '</article>';
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
  status.textContent="Dados oficiais do TSE • "+statusText(r)+" • "+area.name+". Atualização automática a cada 5 segundos enquanto esta aba estiver aberta.";
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
  ["Comparecimento",ready&&r.eleitores?.comparecimento!=null?fmt(r.eleitores.comparecimento):dash],
  ["Abstenção",ready&&r.eleitores?.abstencao!=null?fmt(r.eleitores.abstencao):dash]
 ].map(([label,value])=>'<div class="t2-stat"><span>'+label+'</span><strong>'+value+'</strong></div>').join("");
 const listed=pickCandidates(r);
 const ranked=ready?(r.candidatos||[]).slice().sort((a,b)=>n(b.votos)-n(a.votos)):[];
 candidates.innerHTML=listed.length?listed.map((c,i)=>cardForCandidate(c,i,ready,ranked.findIndex(x=>String(x.numero)===String(c.numero))+1)).join(""):
  '<div class="t2-empty">Os dois candidatos classificados aparecem aqui após a leitura da base oficial. A votação do 2º turno permanece separada do 1º turno.</div>';
 const picker=$("turno2AreaPicker");if(picker)picker.value=selected;
 const progress=$("turno2Progress");
 if(progress)progress.textContent=ready?decimal(r.secoes.percentual).toFixed(2).replace(".",",")+"% apurado • "+statusText(r):"Aguardando apuração";
 const gap=$("turno2Gap");
 if(gap){
  if(ready&&ranked.length>=2){
   const difference=Math.abs(n(ranked[0].votos)-n(ranked[1].votos));
   const points=Math.abs(decimal(ranked[0].percentual)-decimal(ranked[1].percentual));
   gap.textContent=(difference===0?"Empate":String(ranked[0].nome||"Candidato")+" à frente")+" • "+fmt(difference)+" votos • "+points.toFixed(2).replace(".",",")+" pontos percentuais";
  }else gap.textContent="Aguardando votos oficiais • diferença indisponível";
 }
 decorateNationalLead();
 const timestamp=ready?[r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" "):"—";
 if(time)time.textContent="Fonte: Tribunal Superior Eleitoral • eleição 6258 • Atualização TSE: "+timestamp;
 const link=$("turno2Source");if(link)link.href=area.url;
}
async function fetchJson(url,timeoutMs=12000){
 const controller=new AbortController();const t=setTimeout(()=>controller.abort(),timeoutMs);
 try{const res=await fetch(url+(url.includes("?")?"&":"?")+"_="+Date.now(),{cache:"no-store",signal:controller.signal});if(!res.ok)throw Error("HTTP "+res.status);return await res.json();}
 finally{clearTimeout(t);}
}
async function loadFinalists(force=false){
 if(finalists.length&&!force)return true;
 try{
  const source=await fetchJson("./resultados-oficiais.json",10000);
  const all=source?.results?.presidente_br?.candidatos||[];
  const qualifying=all.filter(c=>/2\s*[º°o]?\s*turno/i.test(c.situacao||"")).slice(0,2);
  if(qualifying.length===2)finalists=qualifying.map(c=>({numero:c.numero,nome:c.nome,partido:c.partido})).sort(byNumber);
  lastConsultation=Date.now();
  return true;
 }catch(error){
  console.info("Base local do 1º turno indisponível; usando as candidaturas oficiais:",error);
  lastConsultation=Date.now();
  return finalists.length>0;
 }finally{
  render();
 }
}
async function fetchResults(force=false){
 if(inFlight)return inFlight;
 if(!hasReleased()){
  const ok=await loadFinalists(force);
  render();
  return {ok,published:false,changed:false};
 }
 if(!force&&Date.now()-updated<REFRESH_INTERVAL_MS)return {ok:true,published:Object.values(results).some(officialReady),changed:false};
 inFlight=(async()=>{
  const fetched={};
  const calls=[fetchJson("./resultados-segundo-turno.json",11000).catch(()=>null),
               ...AREAS.map(a=>fetchJson(a.url).catch(()=>null))];
  const data=await Promise.all(calls);
  const reachable=data.some(x=>x&&typeof x==="object");
  if(!reachable)return {ok:false,published:Object.values(results).some(officialReady),changed:false};
  const snapshot=data[0]?.results||{};
  for(const a of AREAS){
   const r=snapshot[a.key];
   if(r&&r.fase!=="s")fetched[a.key]=r;
  }
  AREAS.forEach((a,i)=>{
   const normalized=normalize(a.key,data[i+1],a.url);
   if(normalized&&officialReady(normalized))fetched[a.key]=normalized;
  });
  const previous=JSON.stringify(results);
  // Se as fontes não publicaram novo arquivo, preserva a última apuração válida.
  if(Object.keys(fetched).length)results={...results,...fetched};
  observeNationalLead();
  const changed=JSON.stringify(results)!==previous;
  updated=lastConsultation=Date.now();
  if(!Object.values(results).some(officialReady))await loadFinalists();
  if(changed)render();
  paintConsultationTime();
  return {ok:true,published:Object.values(results).some(officialReady),changed};
 })().finally(()=>inFlight=null);
 return inFlight;
}

function consultationTime(){
 return new Date(lastConsultation).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}
function paintConsultationTime(){
 const elem=$("turno2LastCheck");
 if(elem)elem.textContent=lastConsultation?"Última consulta: "+consultationTime():"Última consulta: ainda não realizada";
}
function refreshFeedback(state,message){
 const button=$("turno2RefreshBtn"),label=$("turno2RefreshLabel"),feedback=$("turno2RefreshFeedback");
 if(button){
  button.disabled=state==="loading";
  button.classList.toggle("is-loading",state==="loading");
  button.setAttribute("aria-busy",String(state==="loading"));
 }
 if(label)label.textContent=state==="loading"?"Consultando TSE...":"Atualizar TSE";
 if(feedback){
  feedback.dataset.state=state;
  feedback.textContent=message;
 }
 paintConsultationTime();
}
async function refreshManually(){
 if(manualRefreshing)return;
 manualRefreshing=true;
 const started=Date.now();
 refreshFeedback("loading","Consultando os dados oficiais...");
 try{
  if(!navigator.onLine)throw new Error("Dispositivo sem conexão com a internet.");
  const outcome=await fetchResults(true);
  // Tempo mínimo para tornar a animação perceptível mesmo numa resposta muito rápida.
  const remaining=550-(Date.now()-started);
  if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
  if(!outcome?.ok)throw new Error("Não foi possível acessar os arquivos do TSE.");
  let message;
  if(!hasReleased())message="✓ Painel verificado às "+consultationTime()+". O TSE divulgará a votação do segundo turno a partir de 25/10, às 17h (Brasília).";
  else if(!outcome.published)message="✓ Consulta concluída às "+consultationTime()+". Aguardando a divulgação oficial dos votos.";
  else if(outcome.changed)message="✓ Dados recebidos às "+consultationTime()+". Apuração atualizada!";
  else message="✓ Consulta concluída às "+consultationTime()+". Nenhuma alteração nos resultados.";
  refreshFeedback("success",message);
 }catch(error){
  console.warn("Não foi possível atualizar a apuração:",error);
  refreshFeedback("error","Não foi possível consultar o TSE. Confira sua conexão e tente novamente.");
 }finally{
  manualRefreshing=false;
  paintConsultationTime();
 }
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
 // No telão o mapa nacional fica no segundo turno, independente das consultas anteriores.
 window.BUCentral?.selectMapMode("second");
 window.BUCentral?.selectUF("");
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
function activate(){render();renderCountdown();fetchResults(false);}
function select(id){if(!AREAS.some(a=>a.id===id))return;selected=id;render();if(hasReleased()&&Date.now()-updated>=REFRESH_INTERVAL_MS)fetchResults();}
function init(){
 document.addEventListener("fullscreenchange",updateFullscreenButton);
 document.addEventListener("webkitfullscreenchange",updateFullscreenButton);
 document.addEventListener("keydown",event=>{if(event.key==="Escape")closeFullscreenFallback();});
 render();
 updateFullscreenButton();
 paintConsultationTime();
 renderCountdown();
 countdownTimer=setInterval(()=>renderCountdown(),1000);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")renderCountdown();});
 timer=setInterval(()=>{
  if(document.visibilityState==="visible"&&$("segundo-turno")?.classList.contains("active")&&navigator.onLine)fetchResults(true);
 },REFRESH_INTERVAL_MS);
 window.addEventListener("online",()=>{if($("segundo-turno")?.classList.contains("active"))fetchResults(true)});
 if($("segundo-turno")?.classList.contains("active"))activate();
}
window.BUSecondRound={candidateCard:cardForCandidate,activate,refresh:refreshManually,select,toggleFullscreen,get results(){return {...results}}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();

