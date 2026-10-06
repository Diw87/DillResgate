const fs=require("node:fs/promises");
const path=require("node:path");
const {chromium}=require("playwright");

const BASE="https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220";
const APP="https://resultados.tse.jus.br/oficial/app/index.html#/eleicao/6257/uf/ma/dados-de-urna/boletim-de-urna";
const MUNICIPIO="09539";
const MUNICIPIO_NOME="Vitorino Freire";
const ZONA="0049";
const OUT=path.join(__dirname,"bu-vitorino-oficiais.json");
const CANDIDATES=path.join(__dirname,"candidatos.json");

const OFFICE={1:"presidente",3:"governador",5:"senador",6:"federal",7:"estadual"};
const OFFICE_ORDER=["federal","estadual","senador","governador","presidente"];
const VOTE_TYPE={1:"nominal",2:"branco",3:"nulo",4:"legenda",5:"outros"};

const num=v=>Number(v||0);
const pad=(v,n)=>String(v??"").padStart(n,"0");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchJson(url){
 for(let i=0;i<4;i++){
  try{
   const r=await fetch(url,{headers:{"User-Agent":"DWTech-BU2026/1.0"},signal:AbortSignal.timeout(45000)});
   if(r.ok)return r.json();
   if(r.status===404)return null;
   if(r.status<500&&r.status!==429)throw new Error("HTTP "+r.status);
  }catch(e){if(i===3)throw e}
  await sleep(700*(i+1));
 }
}
async function fetchBuffer(url){
 for(let i=0;i<4;i++){
  try{
   const r=await fetch(url,{headers:{"User-Agent":"DWTech-BU2026/1.0"},signal:AbortSignal.timeout(45000)});
   if(r.ok)return Buffer.from(await r.arrayBuffer());
   if(r.status===404)return null;
   if(r.status<500&&r.status!==429)throw new Error("HTTP "+r.status);
  }catch(e){if(i===3)throw e}
  await sleep(700*(i+1));
 }
}

async function loadDecoder(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.goto(APP,{waitUntil:"networkidle",timeout:90000});
 const ready=await page.evaluate(()=>{
  window.webpackChunkapp.push([[987654321],{},r=>window.__tseWebpackRequire=r]);
  const r=window.__tseWebpackRequire;
  const factory=r?.m?.[369];
  if(!factory)return false;
  const source=factory.toString();
  const sig=source.match(/^\s*(?:function\s*\w*\s*)?\(([^)]*)\)\s*(?:=>|\{)/);
  if(!sig)return false;
  const exp=sig[1].split(",")[1]?.trim();
  if(!exp)return false;
  const patched=source.replace(/}\s*$/, `; ${exp}.decodeBU = X; }`);
  const fn=new Function("return ("+patched+")")();
  const module={exports:{}};
  fn(module,module.exports,r);
  window.__tseDecodeBU=module.exports.decodeBU;
  return typeof window.__tseDecodeBU==="function";
 });
 if(!ready){await browser.close();throw new Error("Leitor oficial de BU do TSE não localizado.");}
 return {browser,page};
}

function buildCandidateMaps(payload){
 const byOffice={};
 const partyByNumber={};
 for(const k of OFFICE_ORDER){
  byOffice[k]={};
  for(const c of payload.candidates?.[k]||[]){
   const key=String(Number(c.numero));
   byOffice[k][key]={nome:c.nome||c.nomeCompleto||("Candidato "+key),partido:c.partido||""};
   if(c.partidoNumero)partyByNumber[String(Number(c.partidoNumero))]={nome:c.partidoNome||c.partido||("Partido "+c.partidoNumero),partido:c.partido||""};
  }
 }
 return {byOffice,partyByNumber};
}

function getMunicipalSections(config){
 const out=[];
 for(const abr of config.abr||[])for(const mu of abr.mu||[]){
  if(pad(mu.cd,5)!==MUNICIPIO)continue;
  for(const zon of mu.zon||[]){
   if(pad(zon.cd,4)!==ZONA)continue;
   for(const sec of zon.sec||[]){
    if(sec.nsp)continue;
    out.push({
     secao:pad(sec.ns,4),
     agregadas:(sec.nsa||[]).map(x=>num(x?.ns??x)).filter(Boolean),
     disponivel:!!(sec.da&&sec.ha)
    });
   }
  }
 }
 return out.sort((a,b)=>num(a.secao)-num(b.secao));
}

async function decodeBatch(page,files,candidateMaps){
 return page.evaluate(({items,candidateMaps})=>{
  const get=v=>v&&typeof v==="object"&&"value"in v?v.value:v;
  const result=[];
  const officeMap={1:"presidente",3:"governador",5:"senador",6:"federal",7:"estadual"};
  const voteType={1:"nominal",2:"branco",3:"nulo",4:"legenda",5:"outros"};
  const numberOf=v=>String(Number(get(v)||0));
  for(const item of items){
   try{
    const binary=atob(item.base64);
    const decoded=window.__tseDecodeBU(binary);
    const content=decoded?.conteudo?.entidadeBoletimUrna;
    if(!content)throw new Error("Conteúdo do BU ausente");
    const votes={};
    for(const k of ["federal","estadual","senador","governador","presidente"]){
     votes[k]={cand:{},legend:{},brancos:0,nulos:0,outros:0,totalOficial:0,comparecimento:Number(get(content.qtdEleitoresCompareceram)||0),aptos:0};
    }
    let aptos=0;
    for(const election of content.resultadosVotacaoPorEleicao?.content||[]){
     const apt=Number(get(election.qtdEleitoresAptos)||0); if(apt>aptos)aptos=apt;
     for(const contest of election.resultadosVotacao?.content||[]){
      for(const total of contest.totaisVotosCargo?.content||[]){
       const cargo=Number(get(total.codigoCargoConsulta)||get(total.codigoCargo)||0);
       const key=officeMap[cargo]; if(!key)continue;
       for(const vote of total.votosVotaveis?.content||[]){
        const tipo=voteType[Number(get(vote.tipoVoto)||0)]||"outros";
        const qtd=Number(get(vote.quantidadeVotos)||0);
        const code=numberOf(vote.identificacaoVotavel?.codigo);
        if(tipo==="nominal"&&code!=="0"){
         const info=candidateMaps.byOffice?.[key]?.[code]||{nome:"Candidato "+code,partido:""};
         votes[key].cand[code]={numero:code,nome:info.nome,partido:info.partido,votos:qtd};
        }else if(tipo==="legenda"&&code!=="0"){
         const info=candidateMaps.partyByNumber?.[code]||{nome:"Legenda "+code,partido:""};
         votes[key].legend[code]={numero:code,nome:info.nome,partido:info.partido||info.nome,votos:qtd};
        }else if(tipo==="branco")votes[key].brancos+=qtd;
        else if(tipo==="nulo")votes[key].nulos+=qtd;
        else votes[key].outros+=qtd;
       }
      }
     }
    }
    const comparecimento=Number(get(content.qtdEleitoresCompareceram)||0);
    for(const key of Object.keys(votes)){
     votes[key].comparecimento=comparecimento;
     votes[key].aptos=aptos;
     votes[key].totalOficial=Object.values(votes[key].cand).reduce((s,x)=>s+x.votos,0)+Object.values(votes[key].legend).reduce((s,x)=>s+x.votos,0)+votes[key].brancos+votes[key].nulos+votes[key].outros;
    }
    const urna=String(get(content.urna?.correspondenciaResultado?.carga?.numeroInternoUrna)||get(content.carga?.numeroInternoUrna)||"");
    const local=String(get(content.identificacaoSecao?.local)||get(content.urna?.identificacao?.identificacaoSecaoEleitoral?.local)||"");
    const emissao=String(get(content.dataHoraEmissao)||"");
    result.push({...item.meta,urna,localCodigo:local,aptos,comparecimento,emissao,votes});
   }catch(e){result.push({...item.meta,error:e.message})}
  }
  return result;
 },{items:files.map(f=>({meta:f.meta,base64:f.buffer.toString("base64")})),candidateMaps});
}

function validateBallot(rec){
 if(rec.error)return rec.error;
 for(const key of OFFICE_ORDER){
  const d=rec.votes?.[key]; if(!d)return "Cargo ausente: "+key;
  const expected=rec.comparecimento*(key==="senador"?2:1);
  if(num(d.totalOficial)!==expected)return key+": total "+d.totalOficial+" diferente do esperado "+expected;
 }
 return "";
}

async function main(){
 const configUrl=`${BASE}/config/ma/ma-p003220-cs.json`;
 const config=await fetchJson(configUrl);
 if(!config)throw new Error("Configuração do TSE não disponível.");
 const sections=getMunicipalSections(config).filter(s=>s.disponivel);
 if(!sections.length)throw new Error("Nenhuma seção de Vitorino Freire encontrada.");
 const candidates=JSON.parse(await fs.readFile(CANDIDATES,"utf8"));
 const maps=buildCandidateMaps(candidates);
 const decoder=await loadDecoder();
 const ballots=[],errors=[];
 try{
  for(let offset=0;offset<sections.length;offset+=12){
   const batch=sections.slice(offset,offset+12);
   const files=[];
   for(const sec of batch){
    const sectionPath=`${BASE}/dados/ma/${MUNICIPIO}/${ZONA}/${sec.secao}`;
    const auxName=`p003220-ma-m${MUNICIPIO}-z${ZONA}-s${sec.secao}-aux.json`;
    try{
     const aux=await fetchJson(`${sectionPath}/${auxName}`);
     const hashEntry=aux?.hashes?.find(h=>(h.arq||[]).some(a=>a.tp==="bu"||a.tp==="busa"));
     const bu=hashEntry?.arq?.find(a=>a.tp==="bu"||a.tp==="busa");
     if(!hashEntry||!bu)throw new Error("Arquivo BU ausente no auxiliar");
     const url=`${sectionPath}/${hashEntry.hash}/${bu.nm}`;
     const buffer=await fetchBuffer(url);
     if(!buffer)throw new Error("Arquivo BU não encontrado");
     files.push({buffer,meta:{secao:num(sec.secao),secoesAgregadas:sec.agregadas,sourceStatus:hashEntry.st||"",provenance:{auxUrl:`${sectionPath}/${auxName}`,buUrl:url,hash:hashEntry.hash}}});
    }catch(e){errors.push({secao:num(sec.secao),error:e.message})}
   }
   const decoded=files.length?await decodeBatch(decoder.page,files,maps):[];
   for(const rec of decoded){
    const err=validateBallot(rec);
    if(err){errors.push({secao:rec.secao,error:err});continue}
    ballots.push({
     id:`tse-2026-1-ma-${MUNICIPIO}-49-${rec.secao}`,
     electionYear:2026,turno:1,uf:"MA",codigoMunicipio:MUNICIPIO,municipio:MUNICIPIO_NOME,zona:49,secao:rec.secao,
     local:rec.localCodigo?`Local eleitoral nº ${rec.localCodigo}`:"Local eleitoral não informado",
     enderecoLocal:"Vitorino Freire - MA",
     localCodigo:rec.localCodigo,secoesAgregadas:rec.secoesAgregadas,urna:rec.urna,aptos:rec.aptos,comparecimento:rec.comparecimento,
     dataEleicao:"2026-10-04",source:"TSE",status:"finalizado",votes:rec.votes,
     provenance:{...rec.provenance,emissao:rec.emissao}
    });
   }
   console.log(`Vitorino Freire: ${Math.min(offset+batch.length,sections.length)}/${sections.length} seções processadas`);
  }
 }finally{await decoder.browser.close()}
 ballots.sort((a,b)=>a.secao-b.secao);
 if(errors.length)console.warn("Erros:",JSON.stringify(errors));
 if(!ballots.length)throw new Error("Nenhum B.U. válido foi gerado.");
 const payload={meta:{source:"Tribunal Superior Eleitoral — arquivos de urna",electionYear:2026,turno:1,uf:"MA",codigoMunicipio:MUNICIPIO,municipio:MUNICIPIO_NOME,zona:49,totalBus:ballots.length,totalSecoesRepresentadas:ballots.reduce((s,b)=>s+1+(b.secoesAgregadas?.length||0),0),generatedAt:new Date().toISOString(),configUrl,errors},ballots};
 await fs.writeFile(OUT,JSON.stringify(payload,null,0),"utf8");
 console.log(JSON.stringify(payload.meta));
}
main().catch(e=>{console.error(e);process.exitCode=1});
