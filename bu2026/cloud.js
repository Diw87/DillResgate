(()=>{"use strict";
const SB_URL="https://ecptjdykrzyiekunxylx.supabase.co";
const SB_KEY="sb_publishable_7KNgN5uT6Mywv0rTYv3dtw_QQS7f1Of";
const QUEUE_KEY="BU2026_CLOUD_QUEUE_V1";
const DEVICE_KEY="BU2026_DEVICE_ID_V1";
const PROFILE_CACHE_KEY="BU2026_PROFILE_CACHE_V1";
const DEVICE_ID=localStorage.getItem(DEVICE_KEY)||crypto.randomUUID();
localStorage.setItem(DEVICE_KEY,DEVICE_ID);

let client=null,user=null,profile=null,cloudReady=false,channel=null,locks=[],currentClaim=null,heartbeatTimer=null,patched=false,toastTimer=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const roleLabel=r=>({admin:"Administrador",operator:"Operador",viewer:"Consulta"}[r]||r||"-");

function queue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]")}catch{return[]}}
function setQueue(q){localStorage.setItem(QUEUE_KEY,JSON.stringify(q));renderCloudStatus()}
function toast(msg,type=""){const e=$("cloudToast");if(!e)return;e.textContent=msg;e.className="cloud-toast show"+(type?" "+type:"");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.className="cloud-toast",4200)}
function authMsg(msg,type="warn"){const e=$("cloudAuthMsg");if(!e)return;e.textContent=msg;e.className="cloud-msg show "+type}
function setAuthBusy(v){["cloudLoginBtn","cloudSignupBtn"].forEach(id=>{const e=$(id);if(e)e.disabled=v})}

function ensureUI(){
 if($("cloudAuth"))return;
 document.body.insertAdjacentHTML("beforeend",`
 <div id="cloudAuth" class="cloud-auth">
  <div class="cloud-login">
   <div class="cloud-login-head"><strong>DW <span>Tech</span> • B.U. 2026</strong><p>Central multiusuário de Boletins de Urna</p></div>
   <div class="cloud-login-body">
    <h3>Acesso da equipe</h3>
    <div class="field"><label>Nome</label><input id="cloudName" autocomplete="name" placeholder="Seu nome"></div>
    <div class="field"><label>E-mail</label><input id="cloudEmail" type="email" autocomplete="username" placeholder="nome@exemplo.com"></div>
    <div class="field"><label>Senha</label><input id="cloudPassword" type="password" autocomplete="current-password" minlength="6" placeholder="Mínimo 6 caracteres"></div>
    <div class="cloud-login-actions"><button id="cloudLoginBtn" class="primary" type="button">Entrar</button><button id="cloudSignupBtn" class="soft" type="button">Criar acesso</button></div>
    <div id="cloudAuthMsg" class="cloud-msg"></div>
    <div id="cloudBootstrapBox" class="cloud-bootstrap">
      <label>Código único do administrador inicial</label>
      <div class="cloud-bootstrap-row"><input id="cloudBootstrapCode" autocomplete="off" placeholder="DW26-XXXXX-XXXXX-XXXXX"><button id="cloudBootstrapBtn" class="primary" type="button">Ativar administrador</button></div>
      <small>Use somente no primeiro acesso administrativo. Após a ativação, este código é inutilizado automaticamente.</small>
    </div>
   </div>
  </div>
 </div>
 <div id="cloudAdminModal" class="cloud-modal"><div class="cloud-card">
  <div class="cloud-card-head"><h3>DW Tech • <span>Central da Equipe</span></h3><div class="actions"><button id="cloudRefreshAdmin" class="soft">↻ Atualizar</button><button id="cloudCloseAdmin" class="soft">Fechar</button></div></div>
  <div class="cloud-card-body">
   <div id="cloudSummary" class="cloud-summary"></div>
   <div class="cloud-tabs"><button class="cloud-tab active" data-pane="users">Usuários</button><button class="cloud-tab" data-pane="audit">Auditoria</button><button class="cloud-tab" data-pane="sync">Sincronização</button></div>
   <div id="cloudPaneUsers" class="cloud-pane active"></div><div id="cloudPaneAudit" class="cloud-pane"></div><div id="cloudPaneSync" class="cloud-pane"></div>
  </div>
 </div></div>
 <div id="cloudToast" class="cloud-toast"></div>`);
 const sidebar=document.querySelector(".dw-sidebar");
 if(sidebar){
  const grow=sidebar.querySelector(".side-grow");
  grow?.insertAdjacentHTML("beforebegin",'<div id="cloudStatusCard" class="cloud-status offline" title="Clique para ver a sincronização"><b><span class="dot"></span> Nuvem</b><span id="cloudStatusText">Conectando…</span></div><button id="cloudTeamBtn" class="side-link" style="display:none"><span class="side-icon">☁</span><span>Equipe & Auditoria</span></button>');
 }
 $("cloudLoginBtn").onclick=login;
 $("cloudSignupBtn").onclick=signup;
 $("cloudBootstrapBtn").onclick=bootstrapAdmin;
 $("cloudCloseAdmin").onclick=()=>$("cloudAdminModal").classList.remove("open");
 $("cloudRefreshAdmin").onclick=loadAdminPanel;
 $("cloudTeamBtn")?.addEventListener("click",openAdmin);
 $("cloudStatusCard")?.addEventListener("click",()=>{if(profile?.role==="admin")openAdmin();else openSyncPane()});
 document.querySelectorAll(".cloud-tab").forEach(b=>b.onclick=()=>selectAdminPane(b.dataset.pane));
}

function selectAdminPane(pane){
 document.querySelectorAll(".cloud-tab").forEach(b=>b.classList.toggle("active",b.dataset.pane===pane));
 ["Users","Audit","Sync"].forEach(x=>$("cloudPane"+x)?.classList.toggle("active",x.toLowerCase()===pane));
}
function renderCloudStatus(){
 const c=$("cloudStatusCard"),t=$("cloudStatusText");if(!c||!t)return;
 const q=queue(),pending=q.filter(x=>x.state!=="conflict").length,conf=q.filter(x=>x.state==="conflict").length;
 c.classList.toggle("offline",!navigator.onLine);
 const who=profile?(profile.display_name||profile.email||"usuário")+" • "+roleLabel(profile.role):"sem sessão";
 t.innerHTML=(navigator.onLine?"Online":"Offline")+" • "+esc(who)+(pending?'<br><span class="queue">'+pending+" pendente(s)</span>":"")+(conf?'<br><span class="queue">'+conf+" conflito(s)</span>':"");
}

async function boot(){
 ensureUI();
 const gate=$("cloudBootGate");if(gate)gate.style.display="none";
 if(!window.supabase?.createClient){document.body.classList.add("cloud-locked");authMsg("O módulo de nuvem não carregou. Verifique a conexão e recarregue a página.","bad");return}
 client=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:10}}});
 window.__BU_SUPABASE=client;
 client.auth.onAuthStateChange(async(event,session)=>{if(event==="SIGNED_OUT"){stopCloud();showAuth()}else if(session?.user&&event!=="TOKEN_REFRESHED"){await activate(session.user)}});
 const {data}=await client.auth.getSession();
 if(data?.session?.user)await activate(data.session.user);else showAuth();
 window.addEventListener("online",()=>{renderCloudStatus();if(cloudReady){syncQueue();loadCloudBallots();}});
 window.addEventListener("offline",renderCloudStatus);
}

function showAuth(msg=""){cloudReady=false;document.body.classList.add("cloud-locked");$("cloudAuth").classList.remove("hidden");if(msg)authMsg(msg,"warn");renderCloudStatus()}
function hideAuth(){document.body.classList.remove("cloud-locked");$("cloudAuth").classList.add("hidden");$("cloudBootstrapBox")?.classList.remove("show")}
async function login(){
 const email=$("cloudEmail").value.trim(),password=$("cloudPassword").value;if(!email||!password){authMsg("Informe e-mail e senha.","bad");return}
 setAuthBusy(true);authMsg("Entrando…","warn");
 const {data,error}=await client.auth.signInWithPassword({email,password});
 setAuthBusy(false);if(error){authMsg(error.message,"bad");return}if(data.user)await activate(data.user)
}
async function signup(){
 const display_name=$("cloudName").value.trim(),email=$("cloudEmail").value.trim(),password=$("cloudPassword").value;
 if(!display_name||!email||password.length<6){authMsg("Informe nome, e-mail e uma senha com pelo menos 6 caracteres.","bad");return}
 setAuthBusy(true);authMsg("Criando acesso…","warn");
 const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name}}});
 setAuthBusy(false);if(error){authMsg(error.message,"bad");return}
 if(data.session&&data.user)await activate(data.user);else authMsg("Cadastro criado. Se o Supabase pedir confirmação por e-mail, confirme e depois entre. Novos usuários aguardam liberação do administrador.","good")
}
async function bootstrapAdmin(){
 const code=$("cloudBootstrapCode").value.trim();if(!code){authMsg("Informe o código único de ativação.","bad");return}
 const b=$("cloudBootstrapBtn");b.disabled=true;
 const {data,error}=await client.rpc("bu_bootstrap_admin",{p_code:code});b.disabled=false;
 if(error){authMsg(error.message==="invalid bootstrap code"?"Código de ativação inválido.":error.message,"bad");return}
 profile=data;localStorage.setItem(PROFILE_CACHE_KEY,JSON.stringify(profile));$("cloudBootstrapBox").classList.remove("show");authMsg("Administrador ativado com sucesso.","good");await activate(user)
}
async function logout(){await releaseClaim();localStorage.removeItem(PROFILE_CACHE_KEY);await client.auth.signOut()}

async function ensureProfile(){
 let {data,error}=await client.from("bu_profiles").select("*").eq("id",user.id).maybeSingle();
 if(error)throw error;
 if(!data){
  const r=await client.rpc("bu_ensure_profile");if(r.error)throw r.error;
  const q=await client.from("bu_profiles").select("*").eq("id",user.id).single();if(q.error)throw q.error;data=q.data;
 }
 return data
}
async function activate(u){
 user=u;
 try{
  if(!navigator.onLine){
   const cached=JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY)||"null");
   if(!cached||cached.id!==u.id||!cached.active)throw new Error("Entre uma vez com internet para habilitar o uso offline neste aparelho.");
   profile=cached;
  }else{
   profile=await ensureProfile();
   localStorage.setItem(PROFILE_CACHE_KEY,JSON.stringify(profile));
  }
 }catch(e){showAuth("Não foi possível validar seu acesso: "+e.message);return}
 renderCloudStatus();
 if(!profile.active){
  let bootstrap=null;
  if(navigator.onLine){const r=await client.rpc("bu_bootstrap_status");if(!r.error)bootstrap=r.data}
  showAuth(bootstrap&&!bootstrap.admin_exists&&bootstrap.code_available?"Este é o primeiro acesso administrativo. Informe o código único abaixo.":"Seu cadastro existe, mas ainda aguarda liberação do administrador.");
  $("cloudBootstrapBox")?.classList.toggle("show",!!(bootstrap&&!bootstrap.admin_exists&&bootstrap.code_available));
  $("cloudLoginBtn").textContent="Atualizar acesso";
  $("cloudLoginBtn").onclick=async()=>{profile=await ensureProfile();if(profile.active)await activate(user);else authMsg("Acesso ainda pendente.","warn")};
  return
 }
 $("cloudLoginBtn").textContent="Entrar";$("cloudLoginBtn").onclick=login;hideAuth();cloudReady=true;document.body.classList.toggle("cloud-viewer",profile.role==="viewer");
 if(profile.role==="admin")$("cloudTeamBtn").style.display="flex";else $("cloudTeamBtn").style.display="none";
 patchApp();await loadCloudBallots();await loadClaims();subscribe();await syncQueue();renderCloudStatus();toast("Conectado à central DW Tech como "+roleLabel(profile.role))
}

function stopCloud(){cloudReady=false;profile=null;user=null;currentClaim=null;clearInterval(heartbeatTimer);if(channel&&client){client.removeChannel(channel);channel=null}renderCloudStatus()}
function rowToRec(r){return{id:r.id,municipio:r.municipio,uf:r.uf,zona:String(r.zona),secao:String(r.secao),local:r.local||"",enderecoLocal:r.endereco_local||"",urna:r.urna||"",dataEleicao:r.data_eleicao||"2026-10-04",aptos:Number(r.aptos||0),comparecimento:Number(r.comparecimento||0),votes:r.votes||{},qrImport:r.qr_import||null,salvoEm:r.created_at,_cloud:true,cloudStatus:r.status,createdBy:r.created_by,revision:r.revision,updatedAt:r.updated_at}}
async function loadCloudBallots(){
 if(!cloudReady||!navigator.onLine)return;
 const {data,error}=await client.from("bu_ballots").select("*").eq("election_year",2026).eq("uf","MA").eq("zona",87).eq("status","finalizado").order("secao",{ascending:true});
 if(error){toast("Falha ao atualizar B.U.s: "+error.message,"bad");return}
 buData=(data||[]).map(rowToRec);
 const q=queue().filter(x=>x.state!=="conflict").map(x=>({...x.rec,_queued:true}));
 for(const r of q)if(!buData.some(b=>b.id===r.id||String(b.secao)===String(r.secao)))buData.unshift(r);
 localStorage.setItem(KEY_BU,JSON.stringify(buData));renderAll();renderCloudStatus()
}
async function loadClaims(){
 if(!cloudReady||!navigator.onLine)return;
 const {data}=await client.from("bu_section_claims").select("*").gt("expires_at",new Date().toISOString());locks=data||[];renderSections()
}
function subscribe(){
 if(channel)client.removeChannel(channel);
 channel=client.channel("bu-central-"+Date.now())
  .on("postgres_changes",{event:"*",schema:"public",table:"bu_ballots"},()=>setTimeout(loadCloudBallots,250))
  .on("postgres_changes",{event:"*",schema:"public",table:"bu_section_claims"},()=>setTimeout(loadClaims,180))
  .subscribe();
}
async function claimSection(secao){
 if(!cloudReady||!navigator.onLine||!secao||profile.role==="viewer")return{ok:true,offline:!navigator.onLine};
 if(currentClaim&&String(currentClaim)===String(secao))return{ok:true};
 if(currentClaim)await releaseClaim();
 const {data,error}=await client.rpc("bu_claim_section",{p_secao:Number(secao),p_device_id:DEVICE_ID});if(error)return{ok:false,reason:error.message};
 if(data?.ok){currentClaim=String(secao);clearInterval(heartbeatTimer);heartbeatTimer=setInterval(()=>heartbeat(),120000);await loadClaims();return data}
 return data||{ok:false,reason:"busy"}
}
async function heartbeat(){if(!currentClaim||!navigator.onLine)return;await client.rpc("bu_heartbeat_section",{p_secao:Number(currentClaim),p_device_id:DEVICE_ID})}
async function releaseClaim(){if(!currentClaim||!client||!navigator.onLine){currentClaim=null;return}const s=currentClaim;currentClaim=null;clearInterval(heartbeatTimer);try{await client.rpc("bu_release_section",{p_secao:Number(s),p_device_id:DEVICE_ID})}catch{}await loadClaims()}

function recordFromForm(){
 const id=document.getElementById("buId").value||crypto.randomUUID();
 return{id,municipio:document.getElementById("municipio").value,uf:"MA",zona:"87",secao:document.getElementById("secao").value,local:document.getElementById("local").value,enderecoLocal:document.getElementById("enderecoLocal").value,urna:document.getElementById("urna").value.trim(),dataEleicao:document.getElementById("dataEleicao").value,aptos:num(document.getElementById("aptos").value),comparecimento:num(document.getElementById("comparecimento").value),votes:JSON.parse(JSON.stringify(draftVotes)),qrImport:window.__qrImportMeta?JSON.parse(JSON.stringify(window.__qrImportMeta)):null,salvoEm:new Date().toISOString()}
}
function rowFromRec(rec,isUpdate=false){
 const x={municipio:rec.municipio,uf:"MA",zona:87,secao:Number(rec.secao),local:rec.local||"",endereco_local:rec.enderecoLocal||"",urna:rec.urna||"",data_eleicao:rec.dataEleicao||"2026-10-04",aptos:Number(rec.aptos||0),comparecimento:Number(rec.comparecimento||0),votes:rec.votes||{},qr_import:rec.qrImport||null,source:rec.qrImport?"qr":"manual",status:"finalizado",updated_by:user.id,device_id:DEVICE_ID,client_saved_at:rec.salvoEm||new Date().toISOString()};
 if(!isUpdate){x.id=rec.id;x.election_year=2026;x.created_by=user.id}return x
}
async function saveToCloud(rec,fromQueue=false){
 if(profile.role==="viewer")throw Object.assign(new Error("Seu perfil é somente consulta."),{kind:"permission"});
 const existing=buData.find(x=>x.id===rec.id&&x._cloud);
 if(existing){
  if(profile.role!=="admin")throw Object.assign(new Error("B.U. finalizado. Somente administrador pode corrigir."),{kind:"permission"});
  const {error}=await client.from("bu_ballots").update(rowFromRec(rec,true)).eq("id",rec.id);if(error)throw error;return{updated:true}
 }
 const cl=await claimSection(rec.secao);
 if(!cl?.ok)throw Object.assign(new Error(cl?.reason==="finalized"?"Esta seção já foi finalizada por outro usuário.":cl?.reason==="busy"?"Esta seção está sendo lançada por outro usuário.":(cl?.message||cl?.reason||"Não foi possível reservar a seção.")),{kind:"conflict"});
 try{
  const {error}=await client.from("bu_ballots").insert(rowFromRec(rec,false));if(error){if(error.code==="23505")throw Object.assign(new Error("Esta seção já existe na central."),{kind:"conflict"});throw error}
  return{inserted:true}
 }finally{await releaseClaim()}
}
function enqueue(rec){const q=queue();q.push({id:crypto.randomUUID(),rec,state:"pending",queuedAt:new Date().toISOString(),error:""});setQueue(q)}
async function syncQueue(){
 if(!cloudReady||!navigator.onLine||profile.role==="viewer")return;
 let q=queue(),changed=false;
 for(const item of q){
  if(item.state==="conflict")continue;
  try{await saveToCloud(item.rec,true);item.state="done";changed=true}
  catch(e){if(e.kind==="conflict"||e.code==="23505"){item.state="conflict";item.error=e.message;changed=true}else{item.error=e.message||String(e);changed=true;break}}
 }
 q=q.filter(x=>x.state!=="done");if(changed)setQueue(q);await loadCloudBallots();if(q.some(x=>x.state==="conflict"))toast("Há conflito de sincronização para revisar.","warn")
}

async function submitCapture(e){
 if(!client)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(!cloudReady){showAuth("Entre com seu usuário para lançar B.U.s.");return}
 if(profile.role==="viewer"){toast("Seu perfil é somente consulta.","warn");return}
 if(!refreshConference()){alert("O B.U. ainda não confere. Revise os totais de cada cargo.");return}
 const rec=recordFromForm();if(!rec.secao){alert("Selecione a seção.");return}
 const btn=document.querySelector('#buForm button[type="submit"]');if(btn){btn.disabled=true;btn.textContent="Salvando…"}
 try{
  if(!navigator.onLine){enqueue(rec);rec._queued=true;buData.unshift(rec);localStorage.setItem(KEY_BU,JSON.stringify(buData));renderAll();resetBU();toast("Sem internet: B.U. guardado na fila para sincronizar.","warn");return}
  await saveToCloud(rec);await loadCloudBallots();resetBU();toast("B.U. salvo na central e disponível para toda a equipe.")
 }catch(err){if(!navigator.onLine||/fetch|network/i.test(err.message||"")){enqueue(rec);rec._queued=true;buData.unshift(rec);localStorage.setItem(KEY_BU,JSON.stringify(buData));renderAll();resetBU();toast("Conexão caiu: B.U. ficou na fila de sincronização.","warn")}else{alert(err.message||String(err))}
 }finally{if(btn){btn.disabled=false;btn.textContent="Salvar B.U."}}
}
function decorateSections(){
 const s=$("secao");if(!s)return;const used=new Set(buData.filter(x=>x._cloud&&!x._queued).map(x=>String(Number(x.secao))));
 [...s.options].forEach(o=>{if(!o.value)return;const v=String(Number(o.value)),lock=locks.find(x=>String(x.secao)===v&&x.user_id!==user?.id);
   if(used.has(v)){o.disabled=true;if(!o.textContent.includes("FINALIZADA"))o.textContent+=" • FINALIZADA"}
   else if(lock){o.disabled=true;if(!o.textContent.includes("EM EDIÇÃO"))o.textContent+=" • 🔒 EM EDIÇÃO"}
 })
}
function patchApp(){
 if(patched)return;patched=true;
 const baseRender=renderSections;renderSections=function(){baseRender();decorateSections()};
 const baseReset=resetBU;resetBU=function(){releaseClaim();baseReset()};
 const baseEdit=editBU;editBU=function(id){const r=buData.find(x=>x.id===id);if(r?._cloud&&profile?.role!=="admin"){alert("Este B.U. já está finalizado na central. Somente administrador pode fazer correção.");return}baseEdit(id)};
 deleteBU=async function(id){const r=buData.find(x=>x.id===id);if(!r)return;if(r._queued){if(confirm("Descartar este B.U. da fila offline?")){setQueue(queue().filter(x=>x.rec.id!==id));buData=buData.filter(x=>x.id!==id);localStorage.setItem(KEY_BU,JSON.stringify(buData));renderAll()}return}
  if(profile?.role!=="admin"){alert("Somente administrador pode anular um B.U. finalizado.");return}
  if(!confirm("Anular este B.U.? Ele continuará registrado na auditoria e deixará de entrar na apuração."))return;
  const {error}=await client.from("bu_ballots").update({status:"anulado",updated_by:user.id}).eq("id",id);if(error){alert(error.message);return}await loadCloudBallots();toast("B.U. anulado. O histórico foi preservado.","warn")
 };
 const form=$("buForm");form?.addEventListener("submit",submitCapture,true);
 $("secao")?.addEventListener("change",async e=>{const v=e.target.value;if(!v||!cloudReady||profile.role==="viewer")return;const r=await claimSection(v);if(!r?.ok){alert(r?.reason==="busy"?"Esta seção está em edição por outro usuário.":"Esta seção já foi finalizada.");e.target.value="";fillSection()}});
 const originalBackup=backupJSON;backupJSON=function(){originalBackup();if(profile?.role==="admin")toast("Backup local exportado. A central também mantém o histórico de auditoria.")};
 window.addEventListener("beforeunload",()=>{releaseClaim()});
 renderSections()
}

async function openAdmin(){if(profile?.role!=="admin"){openSyncPane();return}$("cloudAdminModal").classList.add("open");selectAdminPane("users");await loadAdminPanel()}
async function openSyncPane(){$("cloudAdminModal").classList.add("open");selectAdminPane("sync");await renderSyncPane()}
async function loadAdminPanel(){
 if(profile?.role!=="admin"){await renderSyncPane();return}
 const [{data:users,error:uerr},{data:audit,error:aerr},{count:ballots}]=await Promise.all([
  client.from("bu_profiles").select("*").order("created_at",{ascending:true}),
  client.from("bu_audit_logs").select("*").order("created_at",{ascending:false}).limit(120),
  client.from("bu_ballots").select("*",{count:"exact",head:true}).eq("status","finalizado")
 ]);
 if(uerr){toast(uerr.message,"bad");return}
 const active=(users||[]).filter(x=>x.active).length,pending=(users||[]).filter(x=>!x.active).length;
 $("cloudSummary").innerHTML='<div><span>Usuários</span><b>'+users.length+'</b></div><div><span>Ativos</span><b>'+active+'</b></div><div><span>Pendentes</span><b>'+pending+'</b></div><div><span>B.U.s centrais</span><b>'+(ballots||0)+'</b></div>';
 $("cloudPaneUsers").innerHTML='<div class="cloud-user-row head"><span>Usuário</span><span>Nome</span><span>Perfil</span><span>Ativo</span><span>Ação</span></div>'+users.map(x=>'<div class="cloud-user-row" data-user="'+x.id+'"><span>'+esc(x.email||"")+'<small>'+esc(x.id.slice(0,8))+'</small></span><input class="cu-name" value="'+esc(x.display_name||"")+'"><select class="cu-role"><option value="viewer"'+(x.role==="viewer"?" selected":"")+'>Consulta</option><option value="operator"'+(x.role==="operator"?" selected":"")+'>Operador</option><option value="admin"'+(x.role==="admin"?" selected":"")+'>Administrador</option></select><label><input class="cu-active" type="checkbox"'+(x.active?" checked":"")+'> sim</label><button class="primary cu-save">Salvar</button></div>').join("");
 document.querySelectorAll(".cu-save").forEach(b=>b.onclick=async()=>{const row=b.closest(".cloud-user-row"),id=row.dataset.user,role=row.querySelector(".cu-role").value,active=row.querySelector(".cu-active").checked,name=row.querySelector(".cu-name").value.trim();b.disabled=true;const {error}=await client.rpc("bu_admin_set_access",{p_user_id:id,p_role:role,p_active:active,p_display_name:name});b.disabled=false;if(error)alert(error.message);else{toast("Acesso atualizado.");loadAdminPanel()}});
 if(aerr)$("cloudPaneAudit").innerHTML='<div class="cloud-empty">'+esc(aerr.message)+'</div>';else $("cloudPaneAudit").innerHTML=(audit||[]).map(a=>'<div class="audit-row"><b>Seção '+String(a.secao).padStart(3,"0")+'</b><span>'+esc(a.action)+'</span><span>'+esc(a.actor_email||a.user_id||"sistema")+'</span><span>'+new Date(a.created_at).toLocaleString("pt-BR")+'</span></div>').join("")||'<div class="cloud-empty">Sem eventos de auditoria.</div>';
 await renderSyncPane()
}
async function renderSyncPane(){
 const q=queue();$("cloudPaneSync").innerHTML='<div class="actions" style="margin-bottom:10px"><button id="syncNowBtn" class="primary">↻ Sincronizar agora</button><button id="logoutCloudBtn" class="soft">Sair deste usuário</button></div>'+
 (q.length?q.map(x=>'<div class="sync-row '+(x.state==="conflict"?"conflict":"")+'"><b>Seção '+String(x.rec.secao).padStart(3,"0")+'</b><span>'+(x.state==="conflict"?"Conflito: "+esc(x.error):"Aguardando sincronização")+'</span><span><button class="soft discard-sync" data-id="'+x.id+'">Descartar</button></span></div>').join(""):'<div class="cloud-empty">Nenhum B.U. pendente de sincronização.</div>');
 $("syncNowBtn").onclick=syncQueue;$("logoutCloudBtn").onclick=logout;document.querySelectorAll(".discard-sync").forEach(b=>b.onclick=()=>{if(confirm("Descartar esta pendência local?")){setQueue(queue().filter(x=>x.id!==b.dataset.id));renderSyncPane();loadCloudBallots()}})
}
window.BUCloud={get client(){return client},get profile(){return profile},get ready(){return cloudReady},reload:loadCloudBallots,sync:syncQueue,logout,openAdmin};
document.addEventListener("DOMContentLoaded",boot);
})();