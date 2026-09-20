/* DW Tech • Leitor QR oficial do Boletim de Urna 2026 */
(() => {
"use strict";
const OFFICE_CODE={1:"presidente",3:"governador",5:"senador",6:"federal",7:"estadual"};
const OFFICE_NAME={federal:"Deputado Federal",estadual:"Deputado Estadual",senador:"Senador",governador:"Governador",presidente:"Presidente"};
const GLOBAL_KEYS=new Set(["ORIG","ORLC","PROC","DTPL","PLEI","TURN","FASE","UNFE","MUNI","ZONA","SECA","AGRE","IDUE","IDCA","HIQT","HICA","VERS","LOCA","APTO","APTS","APTT","COMP","FALT","HBBM","HBBG","HBSB","DTAB","HRAB","DTFC","HRFC","JUNT","TURM","DTEM","HREM","IDEL","MAJO","PROP"]);
let state,stream=null,raf=null,detector=null,canvas=null,ctx=null,lastSeen="",lastSeenAt=0,torch=false;
function fresh(){return{parts:new Map(),total:0,version:"",certParts:new Map(),certTotal:0,parsed:null,hashChecks:[],hashOK:false,compatible:false,signaturePresent:false,startedAt:new Date().toISOString()}}
state=fresh();
const $=id=>document.getElementById(id);
const norm=s=>String(s||"").replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim();
function escQ(s=""){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function setStatus(msg,type=""){const e=$("qrStatus");if(!e)return;e.textContent=msg;e.className="qr-status"+(type?" "+type:"")}
function beep(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const a=new A(),o=a.createOscillator(),g=a.createGain();o.frequency.value=880;g.gain.setValueAtTime(.04,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.09);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.1);setTimeout(()=>a.close(),180)}catch{}if(navigator.vibrate)navigator.vibrate(45)}
function renderProgress(){
 const box=$("qrChips"),label=$("qrProgressLabel");if(!box)return;
 if(!state.total){box.innerHTML='<span class="qr-chip next">aguardando QR 1</span>';label.textContent="0 QR lidos";return}
 box.innerHTML=Array.from({length:state.total},(_,i)=>'<span class="qr-chip '+(state.parts.has(i+1)?"ok":(i+1===firstMissing()?"next":""))+'">'+(i+1)+'</span>').join("");
 label.textContent=state.parts.size+" de "+state.total+" QR do B.U.";
}
function firstMissing(){for(let i=1;i<=state.total;i++)if(!state.parts.has(i))return i;return state.total}
function resetSession(keepCamera=false){
 state=fresh();renderProgress();renderPreview();$("qrRawPaste").value="";$("qrImportBadge")?.classList.remove("show");
 setStatus("Aponte a câmera para o QR Code 1 do Boletim de Urna.","");
 if(!keepCamera){stopCamera();startCamera()}
}
async function startCamera(){
 if(stream)return;
 const v=$("qrVideo");if(!v)return;
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
  v.srcObject=stream;await v.play();
  const track=stream.getVideoTracks()[0],cap=track.getCapabilities?track.getCapabilities():{};
  $("qrTorchBtn").style.display=cap.torch?"inline-flex":"none";
  if("BarcodeDetector"in window){try{detector=new BarcodeDetector({formats:["qr_code"]})}catch{detector=null}}
  canvas=document.createElement("canvas");ctx=canvas.getContext("2d",{willReadFrequently:true});
  setStatus(state.total?"Continue escaneando os QR restantes do mesmo B.U.":"Aponte a câmera para o primeiro QR do B.U.","");
  scanLoop();
 }catch(e){setStatus("Não consegui acessar a câmera. Use “Importar foto” ou libere a permissão da câmera no navegador.","bad")}
}
function stopCamera(){if(raf){cancelAnimationFrame(raf);raf=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}const v=$("qrVideo");if(v)v.srcObject=null;detector=null}
async function scanLoop(){
 const v=$("qrVideo");if(!stream||!v)return;
 try{
  let raw="";
  if(detector&&v.readyState>=2){const codes=await detector.detect(v);if(codes?.length)raw=codes[0].rawValue||""}
  if(!raw&&window.jsQR&&v.readyState>=2){
   const w=v.videoWidth,h=v.videoHeight;if(w&&h){const scale=Math.min(1,1100/w);canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);ctx.drawImage(v,0,0,canvas.width,canvas.height);const im=ctx.getImageData(0,0,canvas.width,canvas.height);const c=jsQR(im.data,im.width,im.height,{inversionAttempts:"dontInvert"});if(c)raw=c.data}
  }
  if(raw)await acceptPayload(raw);
 }catch{}
 raf=requestAnimationFrame(scanLoop);
}
async function acceptPayload(raw){
 raw=norm(raw);if(!raw)return;
 const now=Date.now();if(raw===lastSeen&&now-lastSeenAt<1500)return;lastSeen=raw;lastSeenAt=now;
 let m=raw.match(/^QRBU:(\d+):(\d+)\s+VRQR:([^\s]+)\s+(.+)$/i);
 if(m){
  const idx=+m[1],total=+m[2];if(idx<1||total<1||idx>total){setStatus("Cabeçalho QRBU inválido.","bad");return}
  if(state.total&&state.total!==total){setStatus("Este QR parece pertencer a outro B.U. A sequência atual espera "+state.total+" QR.","bad");return}
  if(state.parts.has(idx)){setStatus("QR "+idx+" já lido. Procure o próximo QR do boletim.","warn");return}
  state.total=total;state.version=m[3];state.parts.set(idx,raw);beep();renderProgress();
  if(state.parts.size<state.total){setStatus("QR "+idx+" de "+total+" capturado. Agora escaneie o QR "+firstMissing()+" de "+total+".","good");return}
  setStatus("Todos os QR do B.U. foram capturados. Conferindo integridade e reconstruindo os votos…","good");
  await finishData();return;
 }
 m=raw.match(/^QRCE:(\d+):(\d+)\s+(.+)$/i);
 if(m){const idx=+m[1],total=+m[2];state.certTotal=total;state.certParts.set(idx,raw);beep();setStatus("QR de certificado "+idx+" de "+total+" capturado.","good");renderPreview();return}
 setStatus("O código lido não tem o cabeçalho oficial QRBU/QRCE esperado para Boletim de Urna.","bad");
}
function extractPart(raw){
 const s=norm(raw).replace(/^QRBU:\d+:\d+\s+VRQR:[^\s]+\s+/i,"");
 const h=s.indexOf(" HASH:");if(h<0)return{data:s,hash:"",assi:""};
 const data=s.slice(0,h),sec=s.slice(h+1);
 const hm=sec.match(/HASH:([0-9A-F]+)/i),am=sec.match(/(?:^|\s)ASSI:([0-9A-F]+)/i);
 return{data,hash:(hm?.[1]||"").toUpperCase(),assi:(am?.[1]||"").toUpperCase()}
}
async function sha512hex(text){const b=new TextEncoder().encode(text),d=await crypto.subtle.digest("SHA-512",b);return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,"0")).join("").toUpperCase()}
async function verifyHashes(){
 let cumulative="",checks=[];for(let i=1;i<=state.total;i++){const p=extractPart(state.parts.get(i)),input=cumulative?cumulative+" "+p.data:p.data,calc=await sha512hex(input),ok=!!p.hash&&calc===p.hash;checks.push({index:i,ok,given:p.hash,calc});cumulative=input+" HASH:"+p.hash}
 state.hashChecks=checks;state.hashOK=checks.length===state.total&&checks.every(x=>x.ok);return state.hashOK
}
function parseData(){
 const joined=Array.from({length:state.total},(_,i)=>extractPart(state.parts.get(i+1)).data).join(" ");
 const toks=joined.split(/\s+/),meta={},offices={};Object.values(OFFICE_CODE).forEach(k=>offices[k]={cand:{},legend:{},brancos:0,nulos:0,total:0,nominais:0,legendaTotal:0});
 let currentOffice=null,currentParty=null;
 for(const token of toks){const p=token.indexOf(":");if(p<1)continue;const key=token.slice(0,p).toUpperCase(),val=token.slice(p+1);
  if(GLOBAL_KEYS.has(key)){meta[key]=val;continue}
  if(key==="CARG"){currentOffice=OFFICE_CODE[Number(val)]||null;currentParty=null;continue}
  if(!currentOffice)continue;
  if(key==="TIPO"||key==="VERC"||key==="APTA"||key==="APTS"||key==="APTT"||key==="CSEC")continue;
  if(key==="PART"){currentParty=String(Number(val));continue}
  if(key==="LEGP"){if(currentParty)offices[currentOffice].legend[currentParty]=(offices[currentOffice].legend[currentParty]||0)+Number(val||0);continue}
  if(key==="NOMI"){offices[currentOffice].nominais=Number(val||0);continue}
  if(key==="LEGC"){offices[currentOffice].legendaTotal=Number(val||0);continue}
  if(key==="BRAN"){offices[currentOffice].brancos=Number(val||0);continue}
  if(key==="NULO"){offices[currentOffice].nulos=Number(val||0);continue}
  if(key==="TOTC"){offices[currentOffice].total=Number(val||0);continue}
  if(/^\d+$/.test(key)&&/^\d+$/.test(val)){const nr=String(Number(key)),q=Number(val);offices[currentOffice].cand[nr]=(offices[currentOffice].cand[nr]||0)+q}
 }
 const last=extractPart(state.parts.get(state.total));state.signaturePresent=!!last.assi;
 return{meta,offices,raw:joined,signature:last.assi||""}
}
function compatibility(parsed){
 const m=parsed.meta,sec=String(Number(m.SECA||0));let errors=[],warn=[];
 if(m.UNFE&&m.UNFE!=="MA")errors.push("UF do B.U.: "+m.UNFE+" (o sistema está configurado para MA)");
 if(m.ZONA&&Number(m.ZONA)!==87)errors.push("Zona do B.U.: "+m.ZONA+" (esperada: 87)");
 if(sec&&typeof ODAC_SECOES!=="undefined"&&!ODAC_SECOES.some(x=>String(Number(x.secao))===sec))errors.push("Seção "+sec+" não pertence à lista configurada de Olho d'Água das Cunhãs");
 if(m.FASE&&m.FASE!=="O")warn.push("FASE:"+m.FASE+" — este B.U. não está marcado como fase oficial (O)");
 if(m.ORLC&&m.ORLC!=="LEG")warn.push("ORLC:"+m.ORLC+" — configuração diferente de eleição legal oficial (LEG)");
 const date=m.DTPL||"";if(date&&date!=="20261004")warn.push("Data do pleito no QR: "+date);
 return{ok:errors.length===0,errors,warn}
}
async function finishData(){
 stopCamera();await verifyHashes();state.parsed=parseData();const comp=compatibility(state.parsed);state.compatible=comp.ok;renderPreview(comp);
 if(state.hashOK&&comp.ok)setStatus("Leitura completa: sequência íntegra e B.U. compatível. Revise o resumo e toque em “Aplicar ao formulário”.","good");
 else if(!state.hashOK)setStatus("A sequência foi lida, mas a conferência SHA-512 não fechou. Não vou preencher automaticamente para evitar erro.","bad");
 else setStatus("B.U. lido, mas ele não corresponde à configuração deste sistema. Confira os avisos ao lado.","bad")
}
function renderPreview(comp){
 const box=$("qrPreview");if(!box)return;
 if(!state.parsed){box.innerHTML='<div class="qr-preview-title">Prévia da leitura</div><div style="padding:18px;color:#707985;font-size:12px">Escaneie todos os QR do boletim para reconstruir os dados.</div>';$("qrApplyBtn").disabled=true;return}
 comp=comp||compatibility(state.parsed);const m=state.parsed.meta,o=state.parsed.offices;
 const checkRows=[
  {t:state.hashOK?"Integridade SHA-512 confirmada":"Integridade SHA-512 não confirmada",c:state.hashOK?"good":"bad"},
  {t:state.signaturePresent?"Assinatura digital presente no último QR":"Assinatura digital não localizada",c:state.signaturePresent?"good":"warn"},
  {t:comp.ok?"UF, zona e seção compatíveis com este B.U.":"B.U. incompatível com a configuração local",c:comp.ok?"good":"bad"},
  ...comp.errors.map(t=>({t,c:"bad"})),...comp.warn.map(t=>({t,c:"warn"}))
 ];
 const offices=Object.keys(OFFICE_NAME).map(k=>{const x=o[k],cand=Object.values(x.cand).reduce((a,b)=>a+b,0),leg=Object.values(x.legend).reduce((a,b)=>a+b,0);return'<div class="qr-office-row"><b>'+OFFICE_NAME[k]+'</b><span>'+cand+'</span><span>'+x.brancos+'</span><span>'+x.nulos+'</span></div>'}).join("");
 box.innerHTML='<div class="qr-preview-title">B.U. reconstruído</div><div class="qr-meta">'+
  '<div><span>UF / Zona / Seção</span><b>'+escQ(m.UNFE||"-")+' / '+escQ(m.ZONA||"-")+' / '+escQ(m.SECA||"-")+'</b></div>'+
  '<div><span>Urna</span><b>'+escQ(m.IDUE||"-")+'</b></div>'+
  '<div><span>Aptos</span><b>'+escQ(m.APTO||"-")+'</b></div>'+
  '<div><span>Comparecimento</span><b>'+escQ(m.COMP||"-")+'</b></div>'+
  '<div><span>Fase</span><b>'+escQ(m.FASE||"-")+'</b></div>'+
  '<div><span>Versão QR</span><b>'+escQ(state.version||"-")+'</b></div></div>'+
  '<div class="qr-checks">'+checkRows.map(x=>'<div class="qr-check '+x.c+'"><i>'+(x.c==="good"?"✓":x.c==="bad"?"✕":"!")+'</i><span>'+escQ(x.t)+'</span></div>').join("")+'</div>'+
  '<div class="qr-office-list"><div class="qr-office-row head"><span>Cargo</span><span>Nominais</span><span>Brancos</span><span>Nulos</span></div>'+offices+'</div>';
 $("qrApplyBtn").disabled=!(state.hashOK&&comp.ok)
}
function resolveCandidate(k,nr,partyNr){
 let c=null;try{c=candidateByNumber(k,nr)}catch{}
 let party="";try{party=c?.partido||partyMap(k)[partyNr]?.sigla||("Partido "+partyNr)}catch{party=c?.partido||""}
 return{id:c?.id||("qr-"+k+"-"+nr),numero:nr,nome:c?.nome||("Candidato nº "+nr),partido:party||c?.partido||""}
}
function applyToForm(){
 if(!state.parsed||!state.hashOK||!state.compatible)return;
 const m=state.parsed.meta,sec=String(Number(m.SECA||0));document.getElementById("secao").value=sec;fillSection();
 document.getElementById("urna").value=m.IDUE||"";document.getElementById("aptos").value=Number(m.APTO||0);document.getElementById("comparecimento").value=Number(m.COMP||0);
 if(/^\d{8}$/.test(m.DTPL||""))document.getElementById("dataEleicao").value=m.DTPL.slice(0,4)+"-"+m.DTPL.slice(4,6)+"-"+m.DTPL.slice(6,8);
 draftVotes=blankDraft();
 for(const k of Object.keys(OFFICE_NAME)){const src=state.parsed.offices[k],dst=draftVotes[k];dst.brancos=src.brancos;dst.nulos=src.nulos;
  for(const [nr,q] of Object.entries(src.cand)){let partyNr="";if(k==="federal"||k==="estadual")partyNr=nr.slice(0,2);const c=resolveCandidate(k,nr,partyNr);dst.cand[c.id]={numero:c.numero,nome:c.nome,partido:c.partido,votos:q}}
  for(const [pn,q] of Object.entries(src.legend)){let p={sigla:"Partido "+pn};try{p=partyMap(k)[pn]||p}catch{}dst.legend[pn]={numero:pn,nome:p.sigla,votos:q}}
 }
 window.__qrImportMeta={source:"QRBU oficial TSE",capturedAt:new Date().toISOString(),qrVersion:state.version,qrCount:state.total,hashVerified:true,signaturePresent:state.signaturePresent,phase:m.FASE||"",uf:m.UNFE||"",zone:m.ZONA||"",section:m.SECA||"",urn:m.IDUE||""};
 renderOfficeUI();refreshConference();
 const b=$("qrImportBadge");if(b){b.classList.add("show");b.innerHTML='<span class="dot"></span><span>Dados importados do QR oficial do B.U. • '+state.total+' QR lido(s) • integridade SHA‑512 confirmada</span>'}
 closeScanner();try{showMain("novo",document.querySelectorAll(".tab")[0])}catch{}window.scrollTo({top:0,behavior:"smooth"});
}
async function decodeFile(file){
 if(!file)return;setStatus("Lendo a imagem selecionada…","");
 try{const bmp=await createImageBitmap(file),c=document.createElement("canvas"),x=c.getContext("2d",{willReadFrequently:true}),max=1800,s=Math.min(1,max/Math.max(bmp.width,bmp.height));c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);x.drawImage(bmp,0,0,c.width,c.height);const im=x.getImageData(0,0,c.width,c.height);if(!window.jsQR)throw new Error("Biblioteca de QR indisponível");const r=jsQR(im.data,im.width,im.height,{inversionAttempts:"attemptBoth"});if(!r)throw new Error("QR não localizado na imagem");await acceptPayload(r.data);bmp.close?.()}catch(e){setStatus("Não consegui localizar um QR válido nessa imagem. Fotografe um QR por vez, com boa luz e enquadramento.","bad")}finally{$("qrFile").value=""}}
async function toggleTorch(){if(!stream)return;const t=stream.getVideoTracks()[0];try{torch=!torch;await t.applyConstraints({advanced:[{torch}]});$("qrTorchBtn").textContent=torch?"🔦 Desligar lanterna":"🔦 Lanterna"}catch{}}
function openScanner(){const m=$("qrModal");m.classList.add("open");m.setAttribute("aria-hidden","false");renderProgress();renderPreview();startCamera()}
function closeScanner(){stopCamera();const m=$("qrModal");m.classList.remove("open");m.setAttribute("aria-hidden","true")}
window.openQrScanner=openScanner;window.closeQrScanner=closeScanner;window.resetQrSession=()=>resetSession(true);window.applyQrToForm=applyToForm;window.toggleQrTorch=toggleTorch;
document.addEventListener("DOMContentLoaded",()=>{
 $("qrFile")?.addEventListener("change",e=>decodeFile(e.target.files?.[0]));
 $("qrPasteBtn")?.addEventListener("click",()=>acceptPayload($("qrRawPaste").value));
 $("qrModal")?.addEventListener("click",e=>{if(e.target.id==="qrModal")closeScanner()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("qrModal")?.classList.contains("open"))closeScanner()});
 renderProgress();renderPreview();
});
})();