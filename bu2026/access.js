(()=>{"use strict";
const MODE_KEY="BU2026_ACCESS_MODE";
const FISCAL_USER="fiscal";
const PASS_HASH="8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
let mode=sessionStorage.getItem(MODE_KEY)||"";

const $=id=>document.getElementById(id);
async function sha256(text){
 const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,"0")).join("");
}
function gate(){return $("accessGate")}
function setModeBadge(){
 const host=document.querySelector(".dw-strap");if(!host)return;
 let b=$("accessModeBadge");
 if(!b){b=document.createElement("span");b.id="accessModeBadge";host.appendChild(b)}
 b.className="access-mode-badge "+mode;
 b.textContent=mode==="fiscal"?"● Modo fiscal":"● Modo visitante";
}
function ensureSwitch(){
 const side=document.querySelector(".dw-sidebar");if(!side||$("accessSwitchBtn"))return;
 const btn=document.createElement("button");btn.id="accessSwitchBtn";btn.className="access-switch";btn.innerHTML='<span class="side-icon">⇄</span><span>Trocar acesso</span>';
 btn.onclick=resetAccess;side.insertBefore(btn,side.querySelector(".side-signature"));
}
function showFiscalForm(){
 $("fiscalLoginBox")?.classList.add("show");setTimeout(()=>$("fiscalUser")?.focus(),50)
}
function showError(msg){
 const e=$("fiscalLoginMsg");if(!e)return;e.textContent=msg;e.classList.add("show")
}
function clearError(){$("fiscalLoginMsg")?.classList.remove("show")}
async function fiscalLogin(){
 clearError();
 const user=($("fiscalUser")?.value||"").trim().toLowerCase();
 const pass=($("fiscalPass")?.value||"").trim();
 if(user!==FISCAL_USER){showError("Login fiscal inválido.");return}
 if(!/^\d{6}$/.test(pass)){showError("A senha fiscal deve ter 6 dígitos.");return}
 const hash=await sha256(pass);
 if(hash!==PASS_HASH){showError("Senha fiscal incorreta.");return}
 enterMode("fiscal");
}
function enterVisitor(){enterMode("visitor")}
function enterMode(next){
 mode=next;sessionStorage.setItem(MODE_KEY,mode);
 document.body.classList.remove("access-pending","access-visitor","access-fiscal");
 document.body.classList.add(mode==="visitor"?"access-visitor":"access-fiscal");
 gate()?.classList.add("hidden");setModeBadge();ensureSwitch();
 if(mode==="visitor"){
   setTimeout(()=>{try{showMain("resultados",document.querySelectorAll(".tab")[2])}catch{}},0);
 }else{
   setTimeout(()=>{try{showMain("novo",document.querySelectorAll(".tab")[0])}catch{}},0);
 }
}
function resetAccess(){
 sessionStorage.removeItem(MODE_KEY);mode="";
 document.body.classList.remove("access-visitor","access-fiscal");
 document.body.classList.add("access-pending");
 gate()?.classList.remove("hidden");
 $("fiscalLoginBox")?.classList.remove("show");clearError();
}

function patchNavigation(){
 if(typeof window.showMain==="function"&&!window.__accessShowMainPatched){
  const base=window.showMain;window.__accessShowMainPatched=true;
  window.showMain=function(id,btn){
   const visitorViews=new Set(["resultados","vitorino","segundo-turno"]);
   if(mode==="visitor"&&!visitorViews.has(id)){
    id="resultados";btn=document.querySelectorAll(".tab")[2];
   }
   return base(id,btn);
  };
 }
 const form=$("buForm");
 if(form&&!form.dataset.accessGuard){
  form.dataset.accessGuard="1";
  form.addEventListener("submit",e=>{if(mode!=="fiscal"){e.preventDefault();e.stopImmediatePropagation();alert("O lançamento de B.U. é exclusivo do acesso Fiscal.")}},true);
 }
}

function init(){
 $("visitorAccessBtn")?.addEventListener("click",enterVisitor);
 $("showFiscalBtn")?.addEventListener("click",showFiscalForm);
 $("fiscalLoginBtn")?.addEventListener("click",fiscalLogin);
 $("fiscalPass")?.addEventListener("keydown",e=>{if(e.key==="Enter")fiscalLogin()});
 patchNavigation();
 if(mode==="visitor"||mode==="fiscal")enterMode(mode);
 else document.body.classList.add("access-pending");
}
window.BUAccess={get mode(){return mode},isFiscal:()=>mode==="fiscal",reset:resetAccess};
document.addEventListener("DOMContentLoaded",init);
})();