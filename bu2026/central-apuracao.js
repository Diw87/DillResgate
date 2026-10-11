/* DW Tech | Central 2º turno: mapa, painel ao vivo, TV, compartilhamento e relatórios */
(()=>{
"use strict";
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados";
const RELEASE=Date.UTC(2026,9,25,20,0,0);
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
let stateData={},selectedUF="MA",generatedAt="",lastCheck=0,failed=false,loading=false,started=false;
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
function finalists(){
 const national=getData("presidente_br");
 if(national)return national.candidatos.slice(0,2);
 const any=Object.values(stateData).find(hasVotes);
 return (any?.candidatos||[]).slice(0,2);
}
function orderedCandidates(r){
 return (r?.candidatos||[]).slice().sort((a,b)=>n(b.votos)-n(a.votos)).slice(0,2);
}
function candidateClass(c){
 const top=finalists();
 if(!top.length)return "pending";
 return String(c?.numero)===String(top[0]?.numero)?"first":String(c?.numero)===String(top[1]?.numero)?"second":"pending";
}
function mapHtml(){
 const leaders=finalists();
 const legend=$("t2MapLegend");
 if(legend)legend.innerHTML=leaders.length===2?
  '<span class="t2-key first"></span>'+esc(leaders[0].nome)+
  '<span class="t2-key second"></span>'+esc(leaders[1].nome)+
  '<span class="t2-key pending"></span>Sem dados':
  '<span class="t2-key pending"></span>Aguardando divulgação oficial';
 const target=$("t2Map");
 if(!target)return;
 target.innerHTML=UF.map(([uf,name,row,col])=>{
  const r=getData("presidente_"+uf.toLowerCase()),leader=hasVotes(r)?orderedCandidates(r)[0]:null;
  const kind=leader?candidateClass(leader):"pending";
  const description=leader?leader.nome+" — "+pct(leader.percentual).toFixed(2).replace(".",",")+"%":"Aguardando apuração";
  return '<button type="button" class="t2-uf '+kind+(uf===selectedUF?" active":"")+'" style="grid-row:'+row+';grid-column:'+col+'" '+
   'data-uf="'+uf+'" title="'+esc(name+": "+description)+'" aria-pressed="'+(uf===selectedUF)+'" '+
   'aria-label="'+esc(name+". "+description)+'" onclick="BUCentral.selectUF(\''+uf+'\')">'+uf+'</button>';
 }).join("");
 detailUF();
}
function detailUF(){
 const box=$("t2UFDetail");if(!box)return;
 const row=UF.find(x=>x[0]===selectedUF),name=row?.[1]||"Estado";
 const r=getData("presidente_"+selectedUF.toLowerCase());
 const title='<h4>'+esc(name)+' <small>('+esc(selectedUF)+')</small></h4>';
 if(!hasVotes(r)){
  box.innerHTML=title+'<p class="t2-muted">Sem votos oficiais do segundo turno divulgados para esta UF.</p>'+
   '<a href="'+officialLink(selectedUF)+'" target="_blank" rel="noopener noreferrer">Consultar arquivo oficial ↗</a>';
  return;
 }
 const candidates=orderedCandidates(r);
 box.innerHTML=title+'<p class="t2-muted">'+esc(fmt(r.secoes.totalizadas)+" de "+fmt(r.secoes.total)+" seções")+
  ' • '+pct(r.secoes.percentual).toFixed(2).replace(".",",")+'% apuradas</p>'+
  candidates.map(c=>'<div class="t2-uf-line"><span>'+esc(c.nome)+'</span><b>'+pct(c.percentual).toFixed(2).replace(".",",")+'%</b></div>'+
   '<div class="t2-uf-track"><i class="'+candidateClass(c)+'" style="width:'+Math.max(0,Math.min(100,pct(c.percentual)))+'%"></i></div>'+
   '<small>'+fmt(c.votos)+' votos</small>').join("")+
  '<p class="t2-muted">Arquivo TSE: '+esc([r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" ")||"horário não informado")+'</p>'+
  '<a href="'+officialLink(selectedUF)+'" target="_blank" rel="noopener noreferrer">Conferir fonte oficial ↗</a>';
}
function pulse(){
 const box=$("t2NationalPulse");if(!box)return;
 const r=getData("presidente_br");
 if(!hasVotes(r)){
  box.innerHTML='<span class="t2-live-pill">BRASIL • 2º TURNO</span><strong>Aguardando os dados oficiais da votação</strong><small>25 de outubro, a partir das 17h (Brasília)</small>';
  return;
 }
 const cs=orderedCandidates(r);
 box.innerHTML='<span class="t2-live-pill">BRASIL • '+pct(r.secoes.percentual).toFixed(2).replace(".",",")+'% DAS SEÇÕES</span>'+
  cs.map(c=>'<div class="t2-live-candidate"><b>'+esc(c.nome)+'</b><strong>'+pct(c.percentual).toFixed(2).replace(".",",")+'%</strong>'+
  '<small>'+fmt(c.votos)+' votos</small></div>').join("")+
  '<small class="t2-live-source">TSE: '+esc([r.geradoEm?.data,r.geradoEm?.hora].filter(Boolean).join(" "))+'</small>';
}
function connection(){
 const e=$("t2DataQuality");if(!e)return;
 const state=(!navigator.onLine?"Sem conexão":loading?"Consultando dados":failed?"Falha na última consulta":"Conectado");
 const age=generatedAt?new Date(generatedAt).getTime():0;
 const stale=available()&&age&&Date.now()-age>25*60*1000;
 const local=lastCheck?new Date(lastCheck).toLocaleTimeString("pt-BR"):"ainda não realizada";
 e.innerHTML='<span class="t2-health-dot '+(!navigator.onLine||failed?"error":loading?"pending":"ok")+'"></span>'+
  esc(state)+' • Última consulta aos dados estaduais: '+local+
  (generatedAt?' • Arquivo DW Tech: '+esc(new Date(generatedAt).toLocaleString("pt-BR")):'')+
  (stale?' • <b>Publicação pode estar atrasada</b>':'')+
  ' • Fonte: TSE (arquivos publicados pelo portal DW Tech)';
 const btn=$("t2StateRefresh");if(btn){btn.disabled=loading;btn.textContent=loading?"↻ Consultando...":"↻ Atualizar mapa";}
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
 if(!UF.some(x=>x[0]===uf))return;
 selectedUF=uf;paint();refreshState(uf);
}
function refreshAll(){
 refresh();
 if(available())window.BUSecondRound?.refresh();
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
 const cs=orderedCandidates(r);
 for(const [i,c] of cs.entries()){
  pdf.setFillColor(i===0?255:66,i===0?101:83,i===0?13:101);
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
 tvButton();paint();refresh();
 setInterval(()=>{if(document.visibilityState==="visible"){paint();if(navigator.onLine)refresh();}},30000);
 setInterval(()=>{if(document.visibilityState==="visible")pulse();},5000);
 window.addEventListener("online",()=>refresh());
 window.addEventListener("offline",connection);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){paint();refresh();}});
}
window.BUCentral={selectUF,refresh:refreshAll,share,toggleTV,report,get stateResults(){return {...stateData}}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();