(()=>{"use strict";
const MODE_KEY="BU2026_ACCESS_MODE";
const FISCAL_USER="fiscal";
const PASS_HASH="8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
// Cada abertura do aplicativo começa em Visitante, inclusive após uma sessão fiscal anterior.
let mode="visitor";
sessionStorage.removeItem(MODE_KEY);

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
 const side=document.querySelector(".dw-sidebar");if(!side)return;
 let btn=$("accessSwitchBtn");
 if(!btn){
  btn=document.createElement("button");btn.id="accessSwitchBtn";btn.className="access-switch";
  side.insertBefore(btn,side.querySelector(".side-signature"));
 }
 btn.innerHTML=mode==="fiscal"
  ?'<span class="side-icon">↩</span><span>Sair do modo fiscal</span>'
  :'<span class="side-icon">🔒</span><span>Área restrita</span>';
 btn.setAttribute("aria-label",mode==="fiscal"?"Voltar ao acesso visitante":"Abrir login restrito dos fiscais");
 btn.onclick=()=>mode==="fiscal"?enterMode("visitor"):openFiscalLogin();
}
function openFiscalLogin(){
 const popup=gate();if(!popup)return;
 clearError();const pass=$("fiscalPass");if(pass)pass.value="";
 popup.classList.remove("hidden");
 popup.setAttribute("role","dialog");
 popup.setAttribute("aria-modal","true");
 popup.setAttribute("aria-label","Login da área restrita");
 $("fiscalLoginBox")?.classList.add("show");
 setTimeout(()=>$("fiscalUser")?.focus(),0);
}
function closeFiscalLogin(){
 gate()?.classList.add("hidden");$("fiscalLoginBox")?.classList.remove("show");clearError();
 const pass=$("fiscalPass");if(pass)pass.value="";
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
 if(next!=="visitor"&&next!=="fiscal")return;
 mode=next;
 if(mode==="fiscal")sessionStorage.setItem(MODE_KEY,"fiscal");
 else sessionStorage.removeItem(MODE_KEY);
 document.body.classList.remove("access-pending","access-visitor","access-fiscal");
 document.body.classList.add(mode==="visitor"?"access-visitor":"access-fiscal");
 closeFiscalLogin();setModeBadge();ensureSwitch();
 const view=mode==="visitor"?"segundo-turno":"novo";
 const tab=mode==="visitor"?4:0;
 // Não gera navegação duplicada ao voltar para o início pelo botão do aparelho.
 if(document.querySelector(".section.active")?.id!==view){
  setTimeout(()=>{try{window.showMain?.(view,document.querySelectorAll(".tab")[tab])}catch{}},0);
 }
}
function resetAccess(){
 // O modo público é sempre a tela inicial: não existe mais uma escolha de acesso.
 enterMode("visitor");
}

function patchNavigation(){
 if(typeof window.showMain==="function"&&!window.__accessShowMainPatched){
  const base=window.showMain;window.__accessShowMainPatched=true;
  window.showMain=function(id,btn){
   // Visitante: somente os dois painéis públicos de apuração.
   if(mode==="visitor"&&!["segundo-turno","exterior"].includes(id)){
    id="segundo-turno";btn=document.querySelectorAll(".tab")[4];
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
 $("fiscalLoginBtn")?.addEventListener("click",fiscalLogin);
 $("fiscalPass")?.addEventListener("keydown",e=>{if(e.key==="Enter")fiscalLogin()});
 $("accessGate")?.addEventListener("keydown",e=>{if(e.key==="Escape")closeFiscalLogin()});
 patchNavigation();
 enterMode(mode);
}
window.BUAccess={get mode(){return mode},isFiscal:()=>mode==="fiscal",reset:resetAccess,openFiscalLogin,closeFiscalLogin};
document.addEventListener("DOMContentLoaded",init);
})();
