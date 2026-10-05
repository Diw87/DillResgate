(()=>{"use strict";

const SB_URL="https://ecptjdykrzyiekunxylx.supabase.co";
const SB_KEY="sb_publishable_7KNgN5uT6Mywv0rTYv3dtw_QQS7f1Of";
const QUEUE_KEY="BU2026_CLOUD_QUEUE_V2";
const DEVICE_KEY="BU2026_DEVICE_ID_V1";
const DEVICE_ID=localStorage.getItem(DEVICE_KEY)||crypto.randomUUID();
localStorage.setItem(DEVICE_KEY,DEVICE_ID);

let cloudReady=false,pollTimer=null,toastTimer=null,patched=false,lastFingerprint="";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const queue=()=>{try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]")}catch{return[]}};
const setQueue=q=>{localStorage.setItem(QUEUE_KEY,JSON.stringify(q));renderStatus()};

function headers(extra={}){return {"apikey":SB_KEY,"Content-Type":"application/json",...extra}}
async function fetchJSON(url,opts={},timeout=15000){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const r=await fetch(url,{...opts,signal:ctrl.signal,cache:"no-store"});
  const txt=await r.text();let data=null;
  if(txt){try{data=JSON.parse(txt)}catch{data=txt}}
  if(!r.ok){
   const e=new Error(data?.message||data?.error_description||data?.error||("HTTP "+r.status));
   e.status=r.status;e.data=data;throw e;
  }
  return data;
 }catch(e){
  if(e.name==="AbortError")throw new Error("Tempo de conexão esgotado.");
  throw e;
 }finally{clearTimeout(timer)}
}
async function select(table,query=""){
 return fetchJSON(SB_URL+"/rest/v1/"+table+(query?("?"+query):""),{headers:headers()});
}
async function insert(table,row){
 return fetchJSON(SB_URL+"/rest/v1/"+table,{method:"POST",headers:headers({Prefer:"return=representation"}),body:JSON.stringify(row)});
}
async function update(table,query,row){
 return fetchJSON(SB_URL+"/rest/v1/"+table+"?"+query,{method:"PATCH",headers:headers({Prefer:"return=representation"}),body:JSON.stringify(row)});
}

function ensureUI(){
 if(!document.getElementById("cloudSimpleStatus")){
  const sidebar=document.querySelector(".dw-sidebar");
  if(sidebar){
   const grow=sidebar.querySelector(".side-grow");
   grow?.insertAdjacentHTML("beforebegin",
    '<div id="cloudSimpleStatus" class="cloud-status offline"><b><span class="dot"></span> Central compartilhada</b><span id="cloudSimpleText">Conectando…</span></div>'+
    '<button id="cloudSyncBtn" class="side-link" type="button"><span class="side-icon">↻</span><span>Sincronizar agora</span></button>');
   document.getElementById("cloudSyncBtn").onclick=async()=>{await softRefresh();toast("Sincronização concluída.")};
  }
 }
 if(!document.getElementById("cloudToast")){
  document.body.insertAdjacentHTML("beforeend",'<div id="cloudToast" class="cloud-toast"></div>');
 }
 if(!document.getElementById("buSaveReceipt")){
  document.body.insertAdjacentHTML("beforeend",'<div id="buSaveReceipt" class="bu-save-receipt" aria-hidden="true"><div class="bu-save-card"><div id="buSaveIcon" class="bu-save-icon">✓</div><div id="buSaveTitle" class="bu-save-title">B.U. salvo</div><div id="buSaveSection" class="bu-save-section"></div><div id="buSaveMessage" class="bu-save-message"></div><div id="buSaveTime" class="bu-save-time"></div><div class="bu-save-actions"><button type="button" class="soft" onclick="closeBUSaveReceipt()">Fechar</button><button id="buSaveNext" type="button" class="primary" onclick="closeBUSaveReceipt();openQrScanner()">📷 Próximo B.U.</button></div></div></div>');
 }
}
function toast(msg,type=""){
 const e=$("cloudToast");if(!e)return;e.textContent=msg;e.className="cloud-toast show"+(type?" "+type:"");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.className="cloud-toast",3500);
}
function showSaveReceipt(kind,secao,message){
 const host=$("buSaveReceipt");if(!host)return;
 const map={
  saving:{icon:"↻",title:"ENVIANDO B.U.",cls:"saving"},
  success:{icon:"✓",title:"B.U. SALVO NA CENTRAL",cls:"success"},
  pending:{icon:"!",title:"SALVO NESTE APARELHO",cls:"pending"},
  duplicate:{icon:"✓",title:"B.U. JÁ CONFIRMADO",cls:"duplicate"},
  error:{icon:"×",title:"B.U. NÃO FOI SALVO",cls:"error"}
 };
 const x=map[kind]||map.error;
 host.className="bu-save-receipt open "+x.cls;host.setAttribute("aria-hidden","false");
 $("buSaveIcon").textContent=x.icon;$("buSaveTitle").textContent=x.title;
 $("buSaveSection").textContent="Seção "+String(secao||"").padStart(3,"0");
 $("buSaveMessage").textContent=message||"";
 $("buSaveTime").textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const next=$("buSaveNext");if(next)next.style.display=kind==="error"||kind==="saving"?"none":"inline-flex";
 if(kind==="success"&&navigator.vibrate)navigator.vibrate([120,70,120]);
}
function closeBUSaveReceipt(){const host=$("buSaveReceipt");if(!host)return;host.className="bu-save-receipt";host.setAttribute("aria-hidden","true")}
window.closeBUSaveReceipt=closeBUSaveReceipt;
function renderStatus(){
 const c=$("cloudSimpleStatus"),t=$("cloudSimpleText");if(!c||!t)return;
 const q=queue(),conf=q.filter(x=>x.state==="conflict").length,pending=q.filter(x=>x.state!=="conflict").length;
 c.classList.toggle("offline",!navigator.onLine);
 t.innerHTML=(navigator.onLine?"Online • atualização automática 30s":"Offline")+
  (pending?'<br><span class="queue">'+pending+' pendente(s)</span>':"")+
  (conf?'<br><span class="queue">'+conf+' conflito(s)</span>':"");
}

function rowToRec(r){
 return{
  id:r.id,municipio:r.municipio,uf:r.uf,zona:String(r.zona),secao:String(r.secao),
  local:r.local||"",enderecoLocal:r.endereco_local||"",urna:r.urna||"",
  dataEleicao:r.data_eleicao||"2026-10-04",aptos:Number(r.aptos||0),
  comparecimento:Number(r.comparecimento||0),votes:r.votes||{},qrImport:r.qr_import||null,
  salvoEm:r.created_at,_cloud:true,cloudStatus:r.status,revision:r.revision,updatedAt:r.updated_at
 };
}
function refreshActiveViewAfterCloud(){
 try{
  renderStats();
  renderBUFilter();
  renderBUs();
  renderResults();
  renderSections();
  const view=document.querySelector(".section.active")?.id||"";
  if(view==="gerais"&&typeof window.renderGeneralResults==="function")window.renderGeneralResults();
 }catch(e){console.error("Falha ao redesenhar dados da central:",e)}
}
async function loadCloudBallots(silent=false){
 if(!navigator.onLine)return;
 try{
  const data=await select("bu_ballots","select=*&election_year=eq.2026&uf=eq.MA&zona=eq.87&status=eq.finalizado&order=secao.asc");
  const fp=JSON.stringify((data||[]).map(x=>[x.id,x.revision,x.updated_at]));
  if(silent&&fp===lastFingerprint)return;
  lastFingerprint=fp;
  buData=(data||[]).map(rowToRec).filter(r=>typeof ODC_OFFICIAL_SECTION_IDS==="undefined"||ODC_OFFICIAL_SECTION_IDS.has(Number(r.secao)));

  for(const item of queue().filter(x=>x.state!=="conflict")){
   const r={...item.rec,_queued:true};
   if(!buData.some(b=>b.id===r.id||String(b.secao)===String(r.secao)))buData.unshift(r);
  }

  localStorage.setItem(KEY_BU,JSON.stringify(buData));
  refreshActiveViewAfterCloud();renderStatus();
  cloudReady=true;
 }catch(e){
  cloudReady=false;renderStatus();
  if(!silent)toast("Central indisponível; usando dados locais.","warn");
 }
}

function recordFromForm(){
 const id=document.getElementById("buId").value||crypto.randomUUID();
 return{
  id,municipio:document.getElementById("municipio").value,uf:"MA",zona:"87",
  secao:document.getElementById("secao").value,local:document.getElementById("local").value,
  enderecoLocal:document.getElementById("enderecoLocal").value,urna:document.getElementById("urna").value.trim(),
  dataEleicao:document.getElementById("dataEleicao").value,aptos:num(document.getElementById("aptos").value),
  comparecimento:num(document.getElementById("comparecimento").value),
  votes:JSON.parse(JSON.stringify(draftVotes)),
  qrImport:window.__qrImportMeta?JSON.parse(JSON.stringify(window.__qrImportMeta)):null,
  salvoEm:new Date().toISOString()
 };
}
function rowFromRec(rec,isUpdate=false){
 const row={
  municipio:rec.municipio,uf:"MA",zona:87,secao:Number(rec.secao),
  local:rec.local||"",endereco_local:rec.enderecoLocal||"",urna:rec.urna||"",
  data_eleicao:rec.dataEleicao||"2026-10-04",aptos:Number(rec.aptos||0),
  comparecimento:Number(rec.comparecimento||0),votes:rec.votes||{},qr_import:rec.qrImport||null,
  source:rec.qrImport?"qr":"manual",status:"finalizado",
  device_id:DEVICE_ID,operator_device:DEVICE_ID,client_saved_at:rec.salvoEm||new Date().toISOString()
 };
 if(!isUpdate){row.id=rec.id;row.election_year=2026}
 return row;
}
function localDuplicateState(secao,ignoreId=""){
 const s=String(Number(secao||0));if(!s||s==="0")return "none";
 if(buData.some(x=>String(Number(x.secao||0))===s&&x.id!==ignoreId&&x._cloud&&x.cloudStatus!=="anulado"))return "central";
 if(queue().some(x=>x.state!=="conflict"&&String(Number(x.rec?.secao||0))===s&&x.rec?.id!==ignoreId))return "pending";
 if(buData.some(x=>String(Number(x.secao||0))===s&&x.id!==ignoreId&&x._queued))return "pending";
 return "none";
}
async function duplicateState(secao,ignoreId=""){
 const local=localDuplicateState(secao,ignoreId);if(local!=="none")return local;
 if(!navigator.onLine)return "none";
 try{
  const rows=await select("bu_ballots","select=id,secao,status&election_year=eq.2026&uf=eq.MA&zona=eq.87&secao=eq."+encodeURIComponent(Number(secao))+"&status=eq.finalizado&limit=1");
  return Array.isArray(rows)&&rows.some(x=>x.id!==ignoreId)?"central":"none";
 }catch{return "unknown"}
}
async function hasDuplicateSection(secao,ignoreId=""){const s=await duplicateState(secao,ignoreId);return s==="central"||s==="pending"}
async function confirmCloudSection(secao,id=""){
 const rows=await select("bu_ballots","select=id,secao,status,updated_at&election_year=eq.2026&uf=eq.MA&zona=eq.87&secao=eq."+encodeURIComponent(Number(secao))+"&status=eq.finalizado&limit=2");
 const hit=Array.isArray(rows)&&rows.find(x=>!id||x.id===id)||Array.isArray(rows)&&rows[0];
 if(!hit)throw new Error("A central não confirmou o registro da seção.");
 return hit;
}
async function saveCloud(rec){
 if(typeof ODC_OFFICIAL_SECTION_IDS!=="undefined"&&!ODC_OFFICIAL_SECTION_IDS.has(Number(rec.secao))){
  const err=new Error("A seção "+String(rec.secao).padStart(3,"0")+" não pertence às 53 seções oficiais de ODC.");err.kind="invalid_section";throw err;
 }
 if(await hasDuplicateSection(rec.secao,rec.id)){
  const err=new Error("B.U. repetido: esta seção já está registrada.");
  err.kind="conflict";throw err;
 }
 const existing=buData.find(x=>x.id===rec.id&&x._cloud);
 if(existing){
  await update("bu_ballots","id=eq."+encodeURIComponent(rec.id),rowFromRec(rec,true));
  return {updated:true};
 }
 try{
  await insert("bu_ballots",rowFromRec(rec,false));
  return {inserted:true};
 }catch(e){
  if(e.status===409||/duplicate|unique/i.test(e.message||"")){
   const err=new Error("Esta seção já foi lançada por outro aparelho.");
   err.kind="conflict";throw err;
  }
  throw e;
 }
}
function enqueue(rec){
 const q=queue(),s=String(Number(rec.secao||0));
 if(q.some(x=>x.state!=="conflict"&&String(Number(x.rec?.secao||0))===s))return false;
 q.push({id:crypto.randomUUID(),rec,state:"pending",queuedAt:new Date().toISOString(),error:""});setQueue(q);return true;
}
async function syncQueue(){
 if(!navigator.onLine)return;
 let q=queue(),changed=false;
 for(const item of q){
  if(item.state==="conflict")continue;
  try{await saveCloud(item.rec);item.state="done";changed=true}
  catch(e){
   if(e.kind==="conflict"||e.status===409){item.state="conflict";item.error=e.message;changed=true}
   else{item.error=e.message||String(e);changed=true;break}
  }
 }
 q=q.filter(x=>x.state!=="done");if(changed)setQueue(q);
 await loadCloudBallots(false);
 if(q.some(x=>x.state==="conflict"))toast("Uma seção pendente já foi lançada por outro aparelho.","warn");
}
async function softRefresh(){
 if(!navigator.onLine){renderStatus();return}
 const view=document.querySelector(".section.active")?.id||"";
 const y=window.scrollY||0;
 try{
  await syncQueue();
  await loadCloudBallots(true);
  if((view==="gerais"||view==="resultados")&&typeof window.loadOfficialResults==="function"){
   try{await window.loadOfficialResults(true)}catch{}
  }
 }finally{
  requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:"auto"}));
 }
}
async function syncAfterBallot(){
 if(!navigator.onLine){renderStatus();return}
 try{
  await syncQueue();
  await loadCloudBallots(false);
 }catch{}
}
async function submitCapture(e){
 e.preventDefault();e.stopImmediatePropagation();
 const verifiedQr=!!(window.__qrImportMeta?.source==="QRBU oficial TSE"&&window.__qrImportMeta?.hashVerified&&window.__qrImportMeta?.summaryVerified);
 if(!verifiedQr&&!refreshConference()){alert("O B.U. ainda não confere. Revise os totais de cada cargo.");return}
 if(verifiedQr)refreshConference();
 const rec=recordFromForm(),sec=Number(rec.secao||0);
 if(!sec){alert("Selecione a seção.");return}
 if(typeof ODC_OFFICIAL_SECTION_IDS!=="undefined"&&!ODC_OFFICIAL_SECTION_IDS.has(sec)){
  window.BUQrSaveState?.failed(sec,"seção fora de ODC");
  showSaveReceipt("error",sec,"Esta seção não pertence às 53 seções oficiais de Olho d’Água das Cunhãs.");
  return
 }

 const btn=document.querySelector('#buForm button[type="submit"]');
 if(btn){btn.disabled=true;btn.textContent="Salvando…"}
 try{
  const dup=await duplicateState(sec,rec.id);
  if(dup==="central"){
   window.BUQrSaveState?.duplicate(sec,"central");
   showSaveReceipt("duplicate",sec,"Esta seção já está confirmada na central. Nenhuma duplicata foi criada.");
   await loadCloudBallots(true);resetBU();return
  }
  if(dup==="pending"){
   window.BUQrSaveState?.duplicate(sec,"pending");
   showSaveReceipt("pending",sec,"Esta seção já está salva neste aparelho e ainda aguarda sincronização com a central.");
   resetBU();return
  }

  if(!navigator.onLine){
   enqueue(rec);rec._queued=true;buData.unshift(rec);localStorage.setItem(KEY_BU,JSON.stringify(buData));renderAll();resetBU();
   window.BUQrSaveState?.pending(sec);
   showSaveReceipt("pending",sec,"Sem internet. O B.U. ficou guardado neste aparelho e será enviado automaticamente quando a conexão voltar.");
   return
  }

  showSaveReceipt("saving",sec,"Aguardando confirmação da central…");
  await saveCloud(rec);
  await confirmCloudSection(sec,rec.id);
  window.BUQrSaveState?.confirmed(sec);
  await syncAfterBallot();
  resetBU();
  showSaveReceipt("success",sec,"Registro confirmado no banco central. Agora é seguro passar para o próximo B.U.");
 }catch(e){
  if(e.kind==="conflict"){
   window.BUQrSaveState?.duplicate(sec,"central");
   showSaveReceipt("duplicate",sec,"Outro aparelho já confirmou esta seção na central. Nenhuma duplicata foi criada.");
   await loadCloudBallots(true);resetBU();return
  }
  if(!navigator.onLine||/fetch|network|tempo|internet|abort/i.test(e.message||"")){
   enqueue(rec);rec._queued=true;if(!buData.some(x=>x.id===rec.id))buData.unshift(rec);localStorage.setItem(KEY_BU,JSON.stringify(buData));renderAll();resetBU();
   window.BUQrSaveState?.pending(sec);
   showSaveReceipt("pending",sec,"A conexão caiu. O B.U. ficou guardado neste aparelho e aguardará sincronização.");
  }else{
   window.BUQrSaveState?.failed(sec,e.message||String(e));
   showSaveReceipt("error",sec,e.message||"A central não confirmou o salvamento. O formulário foi mantido para nova tentativa.");
  }
 }finally{if(btn){btn.disabled=false;btn.textContent="Salvar B.U."}}
}

function decorateSections(){
 const s=$("secao");if(!s)return;
 const used=new Set(buData.filter(x=>x._cloud&&!x._queued).map(x=>String(Number(x.secao))));
 [...s.options].forEach(o=>{
  if(!o.value)return;
  const v=String(Number(o.value));
  if(used.has(v)&&!o.textContent.includes("FINALIZADA"))o.textContent+=" • FINALIZADA";
 });
}
function patchApp(){
 if(patched)return;patched=true;

 const baseRender=renderSections;
 renderSections=function(){baseRender();decorateSections()};

 deleteBU=async function(id){
  const r=buData.find(x=>x.id===id);if(!r)return;
  if(r._queued){
   if(confirm("Descartar este B.U. que ainda não foi sincronizado?")){
    setQueue(queue().filter(x=>x.rec.id!==id));buData=buData.filter(x=>x.id!==id);
    localStorage.setItem(KEY_BU,JSON.stringify(buData));renderAll();
   }
   return;
  }
  if(!confirm("Anular este B.U.? Ele deixará de entrar nos resultados."))return;
  try{
   await update("bu_ballots","id=eq."+encodeURIComponent(id),{status:"anulado",device_id:DEVICE_ID,operator_device:DEVICE_ID});
   await loadCloudBallots();toast("B.U. anulado.","warn");
  }catch(e){alert(e.message)}
 };

 const form=$("buForm");form?.addEventListener("submit",submitCapture,true);
 window.addEventListener("online",async()=>{renderStatus();await syncQueue();await loadCloudBallots()});
 window.addEventListener("offline",renderStatus);
}

async function boot(){
 ensureUI();
 document.body.classList.remove("cloud-locked");
 const gate=$("cloudBootGate");if(gate)gate.remove();
 const auth=$("cloudAuth");if(auth)auth.remove();

 patchApp();renderStatus();
 await loadCloudBallots();
 await syncQueue();
 clearInterval(pollTimer);
 pollTimer=setInterval(()=>softRefresh(),30000);
}

window.BUCloud={reload:softRefresh,sync:syncQueue,hasDuplicateSection,duplicateState,softRefresh};
document.addEventListener("DOMContentLoaded",boot);

})();