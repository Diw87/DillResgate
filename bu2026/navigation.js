(()=>{"use strict";

let handlingPop=false;
let patched=false;
let lastView="";
const VALID_VIEWS=new Set(["novo","apurados","resultados","vitorino","segundo-turno"]);

function activeView(){
 const el=document.querySelector(".section.active");
 return el?.id||"";
}
function tabFor(view){
 const map={novo:0,apurados:1,resultados:2,vitorino:3,"segundo-turno":4};
 const i=map[view];
 return Number.isInteger(i)?document.querySelectorAll(".tab")[i]:null;
}
function currentState(){return history.state&&history.state.__buNav?history.state:null}
function setState(kind,data={},replace=false){
 const state={__buNav:true,kind,...data};
 try{
  if(replace)history.replaceState(state,"",location.href);
  else history.pushState(state,"",location.href);
 }catch{}
}
function showAccessFromHistory(){
 if(window.BUAccess?.reset){
  handlingPop=true;
  try{window.BUAccess.reset()}finally{handlingPop=false}
 }else{
  document.body.classList.add("access-pending");
  document.getElementById("accessGate")?.classList.remove("hidden");
 }
}
function restoreView(view){
 if(!VALID_VIEWS.has(view))view="resultados";
 handlingPop=true;
 try{
  window.showMain?.(view,tabFor(view));
 }finally{handlingPop=false}
 lastView=view;
}
function closeOpenModalForPop(){
 const qr=document.getElementById("qrModal");
 if(qr?.classList.contains("open")){
  handlingPop=true;
  try{window.closeQrScanner?.()}finally{handlingPop=false}
  return true
 }
 const ios=document.getElementById("iosInstallModal");
 if(ios?.classList.contains("open")){
  handlingPop=true;
  try{window.closeIOSInstall?.()}finally{handlingPop=false}
  return true
 }
 return false
}
function patchShowMain(){
 if(patched||typeof window.showMain!=="function")return;
 const base=window.showMain;
 window.showMain=function(id,btn){
  const before=activeView();
  const result=base(id,btn);
  if(!handlingPop&&VALID_VIEWS.has(id)){
   const s=currentState();
   if(!(s?.kind==="view"&&s.view===id)){
    setState("view",{view:id});
   }
  }
  lastView=id||before;
  return result
 };
 patched=true;
}
function patchQr(){
 if(typeof window.openQrScanner==="function"&&!window.__buQrNavPatched){
  const open=window.openQrScanner;
  const close=window.closeQrScanner;
  window.openQrScanner=function(){
   const result=open.apply(this,arguments);
   if(!handlingPop){
    const s=currentState();
    if(s?.kind!=="qr")setState("qr",{view:activeView()||lastView||"novo"});
   }
   return result
  };
  window.closeQrScanner=function(){
   if(!handlingPop&&currentState()?.kind==="qr"){
    history.back();
    return;
   }
   return close.apply(this,arguments)
  };
  window.__buQrNavPatched=true;
 }
}
function patchIos(){
 if(typeof window.showIOSHelp==="function"&&!window.__buIosNavPatched){
  const open=window.showIOSHelp;
  const close=window.closeIOSInstall;
  window.showIOSHelp=function(){
   const result=open.apply(this,arguments);
   if(!handlingPop&&currentState()?.kind!=="ios")setState("ios",{view:activeView()||lastView||"novo"});
   return result
  };
  window.closeIOSInstall=function(){
   if(!handlingPop&&currentState()?.kind==="ios"){history.back();return}
   return close.apply(this,arguments)
  };
  window.__buIosNavPatched=true;
 }
}

function initHistory(){
 patchShowMain();patchQr();patchIos();

 // A entrada do app vira a raiz interna. A escolha de acesso/tela seguinte
 // cria uma segunda entrada, permitindo que o botão Voltar retorne ao app.
 setState("access",{},true);

 setTimeout(()=>{
  const gate=document.getElementById("accessGate");
  const mode=window.BUAccess?.mode;
  const view=activeView();
  if(gate?.classList.contains("hidden")&&mode&&VALID_VIEWS.has(view)){
   lastView=view;
   setState("view",{view});
  }
 },80);
}

window.addEventListener("popstate",e=>{
 const s=e.state;
 if(!s?.__buNav){
  // Não deixa a navegação interna cair direto para fora quando ainda há
  // uma tela ativa do app: restaura a raiz de acesso.
  setState("access",{},true);
  showAccessFromHistory();
  return;
 }
 if(closeOpenModalForPop()&&(s.kind==="qr"||s.kind==="ios"))return;
 if(s.kind==="access"){
  showAccessFromHistory();
  return;
 }
 if(s.kind==="view"){
  restoreView(s.view);
  return;
 }
 if(s.kind==="qr"){
  restoreView(s.view||"novo");
  handlingPop=true;try{window.openQrScanner?.()}finally{handlingPop=false}
  return;
 }
 if(s.kind==="ios"){
  restoreView(s.view||"resultados");
  handlingPop=true;try{window.showIOSHelp?.()}finally{handlingPop=false}
 }
});

document.addEventListener("DOMContentLoaded",()=>{
 initHistory();
 // Reaplica os patches após todos os módulos terminarem sua inicialização.
 setTimeout(()=>{patchShowMain();patchQr();patchIos()},300);
});

window.BUNavigation={
 get view(){return activeView()},
 back(){history.back()},
 go(view){window.showMain?.(view,tabFor(view))}
};

})();