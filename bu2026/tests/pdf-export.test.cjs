const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {jsPDF}=require('../jspdf.umd.min.js');
const root=path.resolve(__dirname,'..');
const localBallots=JSON.parse(fs.readFileSync(path.join(root,'_tmp_export_pdf_20261005.json'),'utf8')).map(r=>({...r,uf:'MA',zona:87,enderecoLocal:r.endereco_local,_cloud:true}));
const sectionIds=[1,3,10,12,14,16,18,20,21,23,25,27,29,30,31,32,33,34,35,36,37,41,43,49,50,52,53,54,55,56,67,73,78,143,148,149,150,153,158,180,183,191,192,195,200,206,210,211,215,216,217,222,224];

async function exportPdf(ballots=localBallots,fetchOverride){
 let saved=null;const alerts=[];
 function Pdf(options){const doc=new jsPDF(options);doc.save=()=>{saved=Buffer.from(doc.output('arraybuffer'))};return doc;}
 const context={window:{jspdf:{jsPDF:Pdf}},document:{readyState:'loading',addEventListener(){},querySelectorAll(){return[]}},
  buData:structuredClone(ballots),ODC_OFFICIAL_SECTION_IDS:new Set(sectionIds),
  fetch:fetchOverride||(async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'bu-secoes-oficiais.json'),'utf8'))})),
  alert:message=>alerts.push(message),console:{warn(){},error(){}},AbortController,setTimeout,clearTimeout,num:v=>Number(v||0)};
 vm.createContext(context);
 const aggregate=fs.readFileSync(path.join(root,'index.html'),'utf8').split('\n').find(line=>line.startsWith('function aggregate(k)'));
 vm.runInContext(aggregate,context);
 vm.runInContext(fs.readFileSync(path.join(root,'pdf-export.js'),'utf8'),context);
 await context.window.downloadGeneralBUPdf();
 const text=saved?execFileSync('python',['-c','import sys,io;from pypdf import PdfReader;print("\\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages))'],{input:saved,maxBuffer:4000000}).toString():'';
 return {saved,text,alerts,ballots:context.buData};
}

test('PDF geral inclui as 53 seções quando a central contém somente 47 BUs',async()=>{
 const result=await exportPdf();
 assert.deepEqual(result.alerts,[]);
 assert.ok(result.saved,'O botão precisa gerar um PDF real');
 const found=[...new Set([...result.text.matchAll(/SEÇÃO (\d{3})/g)].map(m=>Number(m[1])))].sort((a,b)=>a-b);
 assert.deepEqual(found,sectionIds,'O arquivo deve conter cada seção de ODC uma única vez, incluindo as seis ausentes da central');
 assert.equal(result.ballots.length,47,'Gerar PDF não deve cadastrar BUs na central ou alterar a lista do fiscal');
 if(process.env.BU_PDF_QA_OUTPUT)fs.writeFileSync(process.env.BU_PDF_QA_OUTPUT,result.saved);
});

test('gera o relatório completo mesmo antes de carregar os BUs da central',async()=>{
 const result=await exportPdf([]);assert.deepEqual(result.alerts,[]);
 const found=new Set([...result.text.matchAll(/SEÇÃO (\d{3})/g)].map(m=>m[1]));
 assert.equal(found.size,53);assert.equal(result.ballots.length,0);
});

test('BUs repetidos, pendentes e de outro município não duplicam nem alteram os totais',async()=>{
 const changed=structuredClone(localBallots[0]);
 Object.values(changed.votes.presidente.cand)[0].votos+=5000;
 const result=await exportPdf([{...changed,_queued:true},{...changed,codigoMunicipio:'00001'},...localBallots,localBallots[0]]);
 assert.deepEqual(result.alerts,[]);
 const summary=result.text.split('SEÇÃO 001')[0];
 assert.ok(/LULA[\s\S]{0,60}7\.830/.test(summary));
 assert.equal([...result.text.matchAll(/SEÇÃO 001\n/g)].length,1);
});

test('não gera PDF quando uma seção não contém todos os cinco cargos',async()=>{
 const incomplete=JSON.parse(fs.readFileSync(path.join(root,'bu-secoes-oficiais.json'),'utf8'));
 delete incomplete.ballots.find(r=>r.secao===43).votes.governador;
 const result=await exportPdf(localBallots,async()=>({ok:true,json:async()=>incomplete}));
 assert.ok(result.saved===null);assert.match(result.alerts.join(' '),/043/);
});

test('resumo geral soma também os votos das seis seções recuperadas',async()=>{
 const {text,alerts}=await exportPdf();assert.deepEqual(alerts,[]);
 const summary=text.split('SEÇÃO 001')[0];
 // Totais conferidos no arquivo municipal do TSE, independentes do exportador.
 for(const [name,votes] of [['ALDIR JUNIOR','3.133'],['LUANNA','2.983'],['FUFUCA','6.710'],['EDUARDO BRAIDE','4.905'],['LULA','7.830']]){
  assert.ok(new RegExp(name+'[\\s\\S]{0,60}'+votes.replace('.','\\.')).test(summary),'Total incompleto para '+name);
 }
});

test('não baixa um PDF incompleto quando os boletins ausentes estão indisponíveis',async()=>{
 const result=await exportPdf(localBallots,async()=>{throw new Error('offline')});
 assert.ok(result.saved===null,'Não pode baixar um arquivo com apenas 47 seções');
 assert.match(result.alerts.join(' '),/043.*055.*150.*191.*195.*210/);
});
