(()=>{"use strict";
let deferredPrompt=null;
let registration=null;
let updateRequested=false;
const APP_BUILD="20261025.6";
const BUILD_KEY="BU2026_APP_BUILD";
const $=id=>document.getElementById(id);
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);

function netText(){
  return navigator.onLine?"Online":"Offline";
}
function renderNet(){
  const b=$("pwaNetBadge");
  if(!b)return;
  b.textContent=navigator.onLine?"● Online":"● Offline";
  b.className="pwa-net "+(navigator.onLine?"online":"offline");
}
function renderInstall(){
  const btn=$("installAppBtn");
  const side=$("installAppSide");
  const installed=isStandalone();
  if(btn)btn.style.display=installed?"none":"inline-flex";
  if(side)side.style.display=installed?"none":"flex";
  const status=$("pwaModeBadge");
  if(status)status.textContent=installed?"Aplicativo instalado":"Versão web";
}
function showIOSHelp(){
  const m=$("iosInstallModal");
  if(m)m.classList.add("open");
}
async function installApp(){
  if(isStandalone())return;
  if(isIOS()&&!deferredPrompt){showIOSHelp();return}
  if(!deferredPrompt){
    alert("A instalação ainda não foi liberada pelo navegador. No computador, use Chrome ou Edge. No iPhone, use Compartilhar → Adicionar à Tela de Início.");
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  renderInstall();
}
window.installApp=installApp;
window.closeIOSInstall=()=>$("iosInstallModal")?.classList.remove("open");

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  deferredPrompt=e;
  renderInstall();
});
window.addEventListener("appinstalled",()=>{
  deferredPrompt=null;
  renderInstall();
});
window.addEventListener("online",renderNet);
window.addEventListener("offline",renderNet);

async function forceFreshAssets(){
  if(!("caches" in window))return;
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith("dwtech-bu2026-")).map(k=>caches.delete(k)));
}
async function checkBuild(){
  if(!navigator.onLine)return;
  try{
    const r=await fetch("./VERSION.json?ts="+Date.now(),{cache:"no-store"});
    if(!r.ok)return;
    const v=await r.json();
    const remote=v.build||v.version||"";
    const local=localStorage.getItem(BUILD_KEY)||"";
    if(remote&&remote!==local){
      localStorage.setItem(BUILD_KEY,remote);
      if(local){
        try{await registration?.update()}catch{}
        if(registration?.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
      }
    }
  }catch{}
}
async function registerSW(){
  if(!("serviceWorker"in navigator)){checkBuild();return}
  try{
    registration=await navigator.serviceWorker.register("./sw.js?build="+APP_BUILD,{scope:"./",updateViaCache:"none"});
    if(registration.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed"&&navigator.serviceWorker.controller){
          worker.postMessage({type:"SKIP_WAITING"});
        }
      });
    });
    let reloading=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      // Atualizar o worker em segundo plano não pode fechar a tela cheia.
      if(!updateRequested||reloading)return;
      reloading=true;
      location.reload();
    });
    try{await registration.update()}catch{}
    await checkBuild();
  }catch(err){
    console.error("Falha ao registrar PWA:",err);
    checkBuild();
  }
}
window.applyPwaUpdate=async()=>{
  updateRequested=true;
  await forceFreshAssets();
  try{await registration?.update()}catch{}
  if(registration?.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
  else location.reload();
};

function handleShortcut(){
  const q=new URLSearchParams(location.search);
  const abrir=q.get("abrir");
  // A tela inicial pública é sempre Brasil + exterior, mesmo se um link
  // antigo tiver sido salvo com ?abrir=exterior.
  if(abrir==="exterior"){
    q.delete("abrir");
    try{
      const rest=q.toString();
      history.replaceState(history.state,"",location.pathname+(rest?"?"+rest:"")+(location.hash||""));
    }catch{}
    return;
  }
  if(!abrir)return;
  setTimeout(()=>{
    const tabs=[...document.querySelectorAll(".tab")];
    const ids=["novo","apurados","resultados","vitorino","segundo-turno","exterior"];
    const i=ids.indexOf(abrir);
    if(i>=0&&tabs[i]&&typeof showMain==="function")showMain(abrir,tabs[i]);
  },350);
}

document.addEventListener("DOMContentLoaded",()=>{
  renderNet();renderInstall();registerSW();handleShortcut();
  $("iosInstallModal")?.addEventListener("click",e=>{if(e.target.id==="iosInstallModal")window.closeIOSInstall()});
});
})();


