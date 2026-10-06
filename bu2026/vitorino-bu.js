(()=>{"use strict";
const URL="./bu-vitorino-oficiais.json";
const ORDER=["federal","estadual","senador","governador","presidente"];
const LABEL={federal:"Deputado Federal",estadual:"Deputado Estadual",senador:"Senador",governador:"Governador",presidente:"Presidente"};
let cache=null;
const $=id=>document.getElementById(id);
const n=v=>Number(v||0);
const fmt=v=>n(v).toLocaleString("pt-BR");
const sec=v=>String(v??"").padStart(3,"0");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

async function load(force=false){
 if(cache&&!force)return cache;
 const r=await fetch(URL+(force?"?ts="+Date.now():""),{cache:force?"no-store":"default"});
 if(!r.ok)throw new Error("Base de B.U.s de Vitorino Freire ainda não está disponível.");
 const data=await r.json();
 if(!data?.meta||!Array.isArray(data.ballots)||String(data.meta.codigoMunicipio)!=="09539")throw new Error("Base de Vitorino Freire inválida.");
 cache=data;
 return data;
}
function totals(rec){
 return ORDER.reduce((sum,k)=>sum+n(rec.votes?.[k]?.totalOficial),0);
}
function renderRows(data){
 const q=($("vitorinoBuSearch")?.value||"").trim().toLowerCase();
 const rows=data.ballots.filter(r=>!q||[r.secao,r.local,r.localCodigo,r.urna].join(" ").toLowerCase().includes(q));
 const body=$("vitorinoBuBody");
 if(body)body.innerHTML=rows.map(r=>'<tr>'+
  '<td><b>'+sec(r.secao)+'</b></td>'+
  '<td>'+esc(r.local||("Local nº "+(r.localCodigo||"-")))+'</td>'+
  '<td>'+esc(r.urna||"-")+'</td>'+
  '<td>'+fmt(r.aptos)+'</td>'+
  '<td>'+fmt(r.comparecimento)+'</td>'+
  '<td><span class="badge ok">TSE oficial</span></td>'+
  '<td><div class="actions"><button class="soft" type="button" onclick="openVitorinoBU('+n(r.secao)+')">Ver B.U.</button><button class="primary" type="button" onclick="downloadVitorinoIndividualBUPdf('+n(r.secao)+')">PDF individual</button></div></td>'+
  '</tr>').join("");
 const empty=$("vitorinoBuEmpty");if(empty)empty.style.display=rows.length?"none":"block";
 const count=$("vitorinoBuCount");if(count)count.textContent=rows.length+" B.U.(s)";
}
async function render(force=false){
 const status=$("vitorinoBuStatus");
 if(status)status.textContent=force?"Atualizando B.U.s oficiais…":"Carregando B.U.s oficiais por seção…";
 try{
  const data=await load(force);
  const m=data.meta||{};
  if(status)status.textContent=fmt(data.ballots.length)+" B.U.s oficiais • "+fmt(m.totalSecoesRepresentadas||data.ballots.length)+" seções representadas • Zona 49 • TSE";
  const meta=$("vitorinoBuMeta");
  if(meta)meta.innerHTML='<div class="stat"><span>B.U.s oficiais</span><strong>'+fmt(data.ballots.length)+'</strong></div>'+
   '<div class="stat"><span>Seções representadas</span><strong>'+fmt(m.totalSecoesRepresentadas||data.ballots.length)+'</strong></div>'+
   '<div class="stat"><span>Zona eleitoral</span><strong>49ª</strong></div>'+
   '<div class="stat"><span>Município</span><strong style="font-size:16px">Vitorino Freire</strong></div>';
  renderRows(data);
 }catch(e){
  if(status)status.textContent=e.message||String(e);
  const body=$("vitorinoBuBody");if(body)body.innerHTML="";
  const empty=$("vitorinoBuEmpty");if(empty){empty.style.display="block";empty.textContent="Aguardando a base oficial de B.U.s de Vitorino Freire."}
 }
}
function officeHtml(rec,key){
 const d=rec.votes?.[key]||{};
 const cand=Object.values(d.cand||{}).filter(x=>n(x.votos)>0).sort((a,b)=>n(b.votos)-n(a.votos));
 const leg=Object.values(d.legend||{}).filter(x=>n(x.votos)>0).sort((a,b)=>n(b.votos)-n(a.votos));
 const rows=[...cand.map(x=>({...x,tipo:"Candidato"})),...leg.map(x=>({...x,tipo:"Legenda"}))];
 return '<section class="vf-office"><h4>'+LABEL[key]+' <span>Total: '+fmt(d.totalOficial)+'</span></h4>'+
  '<div class="vf-office-rows">'+(rows.map(x=>'<div class="vf-vote"><b>'+esc(x.numero)+'</b><span>'+esc((x.tipo==="Legenda"?"LEGENDA • ":"")+(x.nome||""))+'<small>'+esc(x.partido||"")+'</small></span><strong>'+fmt(x.votos)+'</strong></div>').join("")||'<div class="empty">Sem votos nominais/legenda.</div>')+'</div>'+
  '<div class="vf-office-foot"><span>Brancos <b>'+fmt(d.brancos)+'</b></span><span>Nulos <b>'+fmt(d.nulos)+'</b></span><span>Outros <b>'+fmt(d.outros)+'</b></span></div></section>';
}
async function openBu(section){
 try{
  const data=await load(false),rec=data.ballots.find(r=>n(r.secao)===n(section));
  if(!rec)throw new Error("B.U. não encontrado.");
  $("vitorinoBuModalTitle").textContent="B.U. • Seção "+sec(rec.secao);
  $("vitorinoBuModalInfo").innerHTML='<b>Vitorino Freire - MA • 49ª Zona</b><span>'+esc(rec.local||"")+' • Urna '+esc(rec.urna||"-")+' • Aptos '+fmt(rec.aptos)+' • Comparecimento '+fmt(rec.comparecimento)+'</span>';
  $("vitorinoBuModalBody").innerHTML=ORDER.map(k=>officeHtml(rec,k)).join("");
  $("vitorinoBuModalPdf").onclick=()=>window.downloadVitorinoIndividualBUPdf?.(rec.secao);
  $("vitorinoBuModal").classList.add("open");
 }catch(e){alert(e.message||e)}
}
function closeBu(){$("vitorinoBuModal")?.classList.remove("open")}
window.loadVitorinoBallots=async(force=false)=>(await load(force)).ballots;
window.getVitorinoBallotData=async(force=false)=>await load(force);
window.renderVitorinoBUSection=render;
window.refreshVitorinoBallots=()=>render(true);
window.filterVitorinoBUs=()=>{if(cache)renderRows(cache)};
window.openVitorinoBU=openBu;
window.closeVitorinoBU=closeBu;
document.addEventListener("DOMContentLoaded",()=>{
 render(false);
 $("vitorinoBuModal")?.addEventListener("click",e=>{if(e.target.id==="vitorinoBuModal")closeBu()});
});
})();