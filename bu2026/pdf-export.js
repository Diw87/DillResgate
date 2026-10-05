(()=>{"use strict";

const LIB_URL="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
const BRAND={orange:[255,101,13],black:[11,13,15],dark:[27,32,38],gray:[246,247,249],line:[219,224,229],muted:[103,113,124],green:[21,115,71]};
const OFFICE_ORDER=["federal","estadual","senador","governador","presidente"];
const OFFICE_LABEL={federal:"Deputado Federal",estadual:"Deputado Estadual",senador:"Senador",governador:"Governador",presidente:"Presidente"};

function loadScript(src){
 return new Promise((resolve,reject)=>{
  const found=[...document.scripts].find(s=>s.src===src);
  if(found){if(found.dataset.loaded==="1"||window.jspdf?.jsPDF)return resolve();found.addEventListener("load",resolve,{once:true});found.addEventListener("error",reject,{once:true});return}
  const s=document.createElement("script");s.src=src;s.async=true;s.crossOrigin="anonymous";
  s.onload=()=>{s.dataset.loaded="1";resolve()};s.onerror=()=>reject(new Error("Não foi possível carregar o gerador de PDF."));
  document.head.appendChild(s);
 });
}
async function ensurePdf(){
 if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
 await loadScript(LIB_URL);
 if(!window.jspdf?.jsPDF)throw new Error("Gerador de PDF indisponível.");
 return window.jspdf.jsPDF;
}
function clean(v){
 return String(v??"")
  .replace(/[–—]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'")
  .replace(/\u00a0/g," ").replace(/[^\x00-\xFF]/g," ");
}
function n(v){return Number(v||0)}
function fmt(v){return n(v).toLocaleString("pt-BR")}
function sectionNo(v){return String(v??"").padStart(3,"0")}
function orderedBallots(){
 return [...(typeof buData!=="undefined"&&Array.isArray(buData)?buData:[])].sort((a,b)=>n(a.secao)-n(b.secao));
}
function pageBase(doc,title,subtitle=""){
 doc.setFillColor(...BRAND.black);doc.rect(0,0,297,19,"F");
 doc.setFillColor(...BRAND.orange);doc.rect(0,19,297,2.2,"F");
 doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(15);doc.text("DW",12,12.5);
 doc.setTextColor(...BRAND.orange);doc.text("Tech",25,12.5);
 doc.setTextColor(255,255,255);doc.setFontSize(11);doc.text(clean(title),52,10.5);
 if(subtitle){doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(195,202,209);doc.text(clean(subtitle),52,15.2)}
 return 29;
}
function addFooterAll(doc){
 const total=doc.getNumberOfPages();
 for(let i=1;i<=total;i++){
  doc.setPage(i);
  doc.setDrawColor(...BRAND.line);doc.line(12,199,285,199);
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(...BRAND.muted);
  doc.text("DW Tech • B.U. 2026 • Olho d'Água das Cunhãs - MA",12,204);
  doc.text("Página "+i+" de "+total,285,204,{align:"right"});
 }
}
function roundedInfo(doc,x,y,w,label,value){
 doc.setFillColor(...BRAND.gray);doc.setDrawColor(...BRAND.line);doc.roundedRect(x,y,w,16,2,2,"FD");
 doc.setFont("helvetica","bold");doc.setFontSize(6.5);doc.setTextColor(...BRAND.muted);doc.text(clean(label).toUpperCase(),x+4,y+5);
 doc.setFontSize(11);doc.setTextColor(...BRAND.black);doc.text(clean(value),x+4,y+11.7,{maxWidth:w-8});
}
function cover(doc,ballots){
 doc.setFillColor(...BRAND.black);doc.rect(0,0,297,210,"F");
 doc.setFillColor(...BRAND.orange);doc.rect(0,0,12,210,"F");
 doc.setDrawColor(...BRAND.orange);doc.setLineWidth(1.1);doc.line(28,42,270,42);
 doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(30);doc.text("DW",31,30);
 doc.setTextColor(...BRAND.orange);doc.text("Tech",60,30);
 doc.setTextColor(255,255,255);doc.setFontSize(26);doc.text("B.U. 2026",31,70);
 doc.setFontSize(34);doc.text("RESULTADO GERAL",31,91);
 doc.setTextColor(...BRAND.orange);doc.setFontSize(14);doc.text("APURAÇÃO POR SEÇÃO • TODOS OS CARGOS",31,106);
 doc.setTextColor(208,214,220);doc.setFont("helvetica","normal");doc.setFontSize(11);
 doc.text("Olho d'Água das Cunhãs - MA • 87ª Zona Eleitoral",31,124);
 doc.text("Deputado Federal • Deputado Estadual • Senador • Governador • Presidente",31,134);
 doc.setFillColor(...BRAND.dark);doc.roundedRect(31,151,98,25,3,3,"F");
 doc.setFillColor(...BRAND.dark);doc.roundedRect(137,151,98,25,3,3,"F");
 doc.setFont("helvetica","bold");doc.setTextColor(...BRAND.orange);doc.setFontSize(8);doc.text("B.U.s NO ARQUIVO",38,160);
 doc.setTextColor(255,255,255);doc.setFontSize(19);doc.text(String(ballots.length),38,171);
 doc.setFontSize(8);doc.setTextColor(...BRAND.orange);doc.text("GERADO EM",144,160);
 doc.setTextColor(255,255,255);doc.setFontSize(11);doc.text(new Date().toLocaleString("pt-BR"),144,171);
 doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(150,158,166);
 doc.text("Relatório gerado diretamente pelo aplicativo DW Tech B.U. 2026.",31,190);
}
function backCover(doc){
 doc.addPage();
 doc.setFillColor(...BRAND.black);doc.rect(0,0,297,210,"F");
 doc.setFillColor(...BRAND.orange);doc.rect(285,0,12,210,"F");
 doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(31);doc.text("DW",44,79);
 doc.setTextColor(...BRAND.orange);doc.text("Tech",76,79);
 doc.setTextColor(255,255,255);doc.setFontSize(18);doc.text("B.U. 2026",44,101);
 doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(185,192,200);
 doc.text("Soluções em Tecnologia • Apuração • Transparência • Organização",44,116);
 doc.setDrawColor(...BRAND.orange);doc.setLineWidth(1);doc.line(44,128,230,128);
 doc.setFontSize(8);doc.text("Desenvolvido por Dill Wherbeth • DW Tech",44,143);
}
function officeRows(rec,key){
 const d=rec?.votes?.[key]||{};
 const cand=Object.values(d.cand||{}).map(x=>({
  numero:clean(x.numero||""),nome:clean(x.nome||""),partido:clean(x.partido||""),votos:n(x.votos),tipo:"Candidato"
 })).filter(x=>x.votos>0).sort((a,b)=>b.votos-a.votos);
 const leg=Object.values(d.legend||{}).map(x=>({
  numero:clean(x.numero||x.partidoNumero||""),nome:clean(x.nome||x.partido||"Legenda"),partido:clean(x.partido||""),votos:n(x.votos),tipo:"Legenda"
 })).filter(x=>x.votos>0).sort((a,b)=>b.votos-a.votos);
 return {rows:[...cand,...leg],blank:n(d.brancos),nulls:n(d.nulos),outros:n(d.outros),total:[...cand,...leg].reduce((s,x)=>s+x.votos,0)+n(d.brancos)+n(d.nulos)+n(d.outros)};
}
function sectionIntro(doc,rec,continuation=false){
 let y=pageBase(doc,continuation?"SEÇÃO "+sectionNo(rec.secao)+" • CONTINUAÇÃO":"SEÇÃO "+sectionNo(rec.secao),clean(rec.local||""));
 if(!continuation){
  roundedInfo(doc,12,y,65,"Seção",sectionNo(rec.secao));
  roundedInfo(doc,81,y,65,"Urna",rec.urna||"-");
  roundedInfo(doc,150,y,65,"Aptos",fmt(rec.aptos));
  roundedInfo(doc,219,y,66,"Comparecimento",fmt(rec.comparecimento));
  y+=22;
  doc.setFillColor(...BRAND.gray);doc.setDrawColor(...BRAND.line);doc.roundedRect(12,y,273,20,2,2,"FD");
  doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...BRAND.muted);doc.text("LOCAL / ENDEREÇO",16,y+6);
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(...BRAND.black);
  doc.text(clean(rec.local||"-"),16,y+12,{maxWidth:125});
  doc.setFont("helvetica","normal");doc.setFontSize(8.3);doc.setTextColor(70,76,84);
  doc.text(clean(rec.enderecoLocal||"-"),145,y+12,{maxWidth:136});
  y+=27;
 }else y+=2;
 return y;
}
function drawTableHeader(doc,y){
 doc.setFillColor(...BRAND.dark);doc.rect(12,y,273,7,"F");
 doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(255,255,255);
 doc.text("NÚMERO",16,y+4.8);doc.text("CANDIDATO / LEGENDA",43,y+4.8);doc.text("PARTIDO",222,y+4.8);doc.text("VOTOS",280,y+4.8,{align:"right"});
 return y+7;
}
function drawOffice(doc,rec,key,y){
 const data=officeRows(rec,key),label=OFFICE_LABEL[key]||key;
 const minStart=24;
 if(y>171){doc.addPage();y=sectionIntro(doc,rec,true)}
 doc.setFillColor(...BRAND.orange);doc.roundedRect(12,y,273,9,2,2,"F");
 doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text(clean(label).toUpperCase(),16,y+6.1);
 y+=11; y=drawTableHeader(doc,y);
 if(!data.rows.length){
  doc.setFont("helvetica","italic");doc.setFontSize(8);doc.setTextColor(...BRAND.muted);doc.text("Sem votos nominais ou de legenda registrados.",16,y+6);y+=9;
 }else{
  for(const row of data.rows){
   const name=(row.tipo==="Legenda"?"LEGENDA • ":"")+row.nome;
   const lines=doc.splitTextToSize(clean(name),170);
   const h=Math.max(7,lines.length*4.2+2);
   if(y+h>188){
    doc.addPage();y=sectionIntro(doc,rec,true);
    doc.setFillColor(...BRAND.orange);doc.roundedRect(12,y,273,9,2,2,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text(clean(label).toUpperCase()+" • CONTINUAÇÃO",16,y+6.1);
    y+=11;y=drawTableHeader(doc,y);
   }
   doc.setDrawColor(...BRAND.line);doc.line(12,y+h,285,y+h);
   doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...BRAND.orange);doc.text(clean(row.numero||"-"),16,y+4.8);
   doc.setFont("helvetica","normal");doc.setTextColor(...BRAND.black);doc.text(lines,43,y+4.8);
   doc.setFontSize(7.5);doc.setTextColor(...BRAND.muted);doc.text(clean(row.partido||"-"),222,y+4.8);
   doc.setFont("helvetica","bold");doc.setTextColor(...BRAND.black);doc.text(fmt(row.votos),280,y+4.8,{align:"right"});
   y+=h;
  }
 }
 if(y+13>188){doc.addPage();y=sectionIntro(doc,rec,true)}
 doc.setFillColor(...BRAND.gray);doc.roundedRect(12,y,273,10,1.5,1.5,"F");
 doc.setFont("helvetica","bold");doc.setFontSize(7.3);doc.setTextColor(...BRAND.muted);
 doc.text("Brancos: "+fmt(data.blank),16,y+6.5);
 doc.text("Nulos: "+fmt(data.nulls),78,y+6.5);
 doc.text("Outros: "+fmt(data.outros),136,y+6.5);
 doc.setTextColor(...BRAND.black);doc.text("Total: "+fmt(data.total),280,y+6.5,{align:"right"});
 return y+15;
}
function drawSection(doc,rec,startNew=true){
 if(startNew)doc.addPage();
 let y=sectionIntro(doc,rec,false);
 for(const k of OFFICE_ORDER)y=drawOffice(doc,rec,k,y);
}
function generalSummary(doc,ballots){
 doc.addPage();let y=pageBase(doc,"RESUMO GERAL","Consolidação dos B.U.s finalizados no aplicativo");
 const apt=ballots.reduce((s,r)=>s+n(r.aptos),0),comp=ballots.reduce((s,r)=>s+n(r.comparecimento),0);
 roundedInfo(doc,12,y,64,"Seções no PDF",String(ballots.length));
 roundedInfo(doc,80,y,64,"Aptos",fmt(apt));
 roundedInfo(doc,148,y,64,"Comparecimento",fmt(comp));
 roundedInfo(doc,216,y,69,"Faltosos",fmt(Math.max(0,apt-comp)));
 y+=24;
 doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(...BRAND.black);doc.text("Resultado consolidado por cargo",12,y+5);y+=10;
 for(const k of OFFICE_ORDER){
  const a=typeof aggregate==="function"?aggregate(k):{rows:[],valid:0,blank:0,nulls:0,legend:0};
  const den=n(a.valid)+(k==="federal"||k==="estadual"?n(a.legend):0);
  if(y>168){doc.addPage();y=pageBase(doc,"RESUMO GERAL • CONTINUAÇÃO","Consolidação por cargo")}
  doc.setFillColor(...BRAND.dark);doc.roundedRect(12,y,273,9,2,2,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text(clean(OFFICE_LABEL[k]).toUpperCase(),16,y+6);y+=12;
  const rows=(a.rows||[]).filter(x=>n(x.votos)>0);
  for(const x of rows){
   if(y>188){doc.addPage();y=pageBase(doc,"RESUMO GERAL • "+OFFICE_LABEL[k],"Continuação");}
   const pct=den?n(x.votos)/den*100:0;
   doc.setDrawColor(...BRAND.line);doc.line(12,y+6.2,285,y+6.2);
   doc.setFont("helvetica","bold");doc.setFontSize(7.8);doc.setTextColor(...BRAND.orange);doc.text(clean(x.numero||"-"),16,y+4.2);
   doc.setFont("helvetica","normal");doc.setTextColor(...BRAND.black);doc.text(clean(x.nome||"-"),42,y+4.2,{maxWidth:155});
   doc.setTextColor(...BRAND.muted);doc.text(clean(x.partido||"-"),205,y+4.2,{maxWidth:28});
   doc.setFont("helvetica","bold");doc.setTextColor(...BRAND.black);doc.text(fmt(x.votos)+" • "+pct.toFixed(2)+"%",280,y+4.2,{align:"right"});
   y+=6.3;
  }
  if(y>184){doc.addPage();y=pageBase(doc,"RESUMO GERAL • "+OFFICE_LABEL[k],"Continuação")}
  doc.setFillColor(...BRAND.gray);doc.roundedRect(12,y,273,9,1.5,1.5,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(...BRAND.muted);
  doc.text("Válidos: "+fmt(den)+"   •   Brancos: "+fmt(a.blank)+"   •   Nulos: "+fmt(a.nulls)+(n(a.legend)?"   •   Legenda: "+fmt(a.legend):""),16,y+5.9);
  y+=13;
 }
}
function createDoc(JsPDF){return new JsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true})}
async function downloadGeneral(){
 const ballots=orderedBallots();
 if(!ballots.length){alert("Não há B.U.s finalizados para gerar o PDF.");return}
 const btns=document.querySelectorAll(".dw-pdf-general");btns.forEach(b=>{b.disabled=true;b.dataset.old=b.textContent;b.textContent="Gerando PDF..."});
 try{
  const JsPDF=await ensurePdf(),doc=createDoc(JsPDF);
  cover(doc,ballots);
  generalSummary(doc,ballots);
  for(const rec of ballots)drawSection(doc,rec,true);
  backCover(doc);addFooterAll(doc);
  doc.save("BU_2026_DWTech_Resultados_Gerais_ODC.pdf");
 }catch(e){console.error(e);alert("Não foi possível gerar o PDF: "+(e.message||e))}
 finally{btns.forEach(b=>{b.disabled=false;b.textContent=b.dataset.old||"Baixar PDF Geral"})}
}
async function downloadIndividual(id){
 const rec=(typeof buData!=="undefined"?buData:[]).find(x=>String(x.id)===String(id));
 if(!rec){alert("B.U. não encontrado. Sincronize o aplicativo e tente novamente.");return}
 try{
  const JsPDF=await ensurePdf(),doc=createDoc(JsPDF);
  doc.setFillColor(...BRAND.black);doc.rect(0,0,297,210,"F");
  doc.setFillColor(...BRAND.orange);doc.rect(0,0,10,210,"F");
  doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(28);doc.text("DW",30,38);
  doc.setTextColor(...BRAND.orange);doc.text("Tech",58,38);
  doc.setTextColor(255,255,255);doc.setFontSize(24);doc.text("B.U. 2026 • SEÇÃO "+sectionNo(rec.secao),30,73);
  doc.setTextColor(208,214,220);doc.setFont("helvetica","normal");doc.setFontSize(12);doc.text(clean(rec.local||""),30,91,{maxWidth:235});
  doc.setFontSize(9);doc.text(clean(rec.enderecoLocal||""),30,104,{maxWidth:235});
  doc.setDrawColor(...BRAND.orange);doc.line(30,119,235,119);
  doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(11);
  doc.text("Urna: "+clean(rec.urna||"-")+"   •   Aptos: "+fmt(rec.aptos)+"   •   Comparecimento: "+fmt(rec.comparecimento),30,137);
  drawSection(doc,rec,true);
  backCover(doc);addFooterAll(doc);
  doc.save("BU_2026_DWTech_Secao_"+sectionNo(rec.secao)+".pdf");
 }catch(e){console.error(e);alert("Não foi possível gerar o PDF individual: "+(e.message||e))}
}
function injectGeneralButtons(){
 const ap=document.querySelector("#apurados .card .head");
 if(ap&&!ap.querySelector(".dw-pdf-general")){
  const box=document.createElement("div");box.className="actions";
  box.innerHTML='<button class="primary dw-pdf-general" type="button">📄 Baixar PDF Geral</button>';
  box.querySelector("button").addEventListener("click",downloadGeneral);ap.appendChild(box);
 }
 const rh=document.querySelector("#resultados .head .general-actions");
 if(rh&&!rh.querySelector(".dw-pdf-general")){
  const b=document.createElement("button");b.className="primary dw-pdf-general";b.type="button";b.textContent="📄 Baixar PDF Geral";
  b.addEventListener("click",downloadGeneral);rh.appendChild(b);
 }
}
function injectRowButtons(){
 const tb=document.getElementById("buBody");if(!tb)return;
 [...tb.querySelectorAll("tr")].forEach(tr=>{
  const sec=String(Number(tr.cells?.[0]?.textContent||0));if(!sec||sec==="0")return;
  const rec=(typeof buData!=="undefined"?buData:[]).find(x=>String(Number(x.secao||0))===sec);if(!rec)return;
  const actions=tr.cells?.[tr.cells.length-1]?.querySelector(".actions");if(!actions||actions.querySelector(".dw-pdf-one"))return;
  const b=document.createElement("button");b.type="button";b.className="soft dw-pdf-one";b.textContent="PDF individual";
  b.addEventListener("click",()=>downloadIndividual(rec.id));
  const danger=actions.querySelector(".danger");actions.insertBefore(b,danger||null);
 });
}
function patchRender(){
 if(typeof renderBUs==="function"&&!renderBUs.__dwPdfPatched){
  const base=renderBUs;
  const wrapped=function(){const r=base.apply(this,arguments);injectRowButtons();return r};
  wrapped.__dwPdfPatched=true;renderBUs=wrapped;
 }
}
function boot(){injectGeneralButtons();patchRender();injectRowButtons();setTimeout(()=>{injectGeneralButtons();injectRowButtons()},1200)}
window.downloadGeneralBUPdf=downloadGeneral;
window.downloadIndividualBUPdf=downloadIndividual;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();