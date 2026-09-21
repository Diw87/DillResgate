(()=>{"use strict";
let deferredPrompt=null;
let registration=null;
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

async function registerSW(){
  if(!("serviceWorker"in navigator))return;
  try{
    registration=await navigator.serviceWorker.register("./sw.js",{scope:"./"});
    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed"&&navigator.serviceWorker.controller){
          const b=$("pwaUpdateBtn");
          if(b)b.style.display="inline-flex";
        }
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange",()=>location.reload());
    setTimeout(()=>registration.update().catch(()=>{}),2500);
  }catch(err){
    console.error("Falha ao registrar PWA:",err);
  }
}
window.applyPwaUpdate=()=>{
  if(registration?.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
  else location.reload();
};

function handleShortcut(){
  const q=new URLSearchParams(location.search);
  const abrir=q.get("abrir");
  if(!abrir)return;
  setTimeout(()=>{
    const tabs=[...document.querySelectorAll(".tab")];
    const ids=["novo","apurados","resultados","candidatos"];
    const i=ids.indexOf(abrir);
    if(i>=0&&tabs[i]&&typeof showMain==="function")showMain(abrir,tabs[i]);
  },350);
}

document.addEventListener("DOMContentLoaded",()=>{
  renderNet();renderInstall();registerSW();handleShortcut();
  $("iosInstallModal")?.addEventListener("click",e=>{if(e.target.id==="iosInstallModal")window.closeIOSInstall()});
});
})();