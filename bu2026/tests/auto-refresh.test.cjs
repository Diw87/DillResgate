const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function storage(initial={}){
 const values=new Map(Object.entries(initial));
 return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
function element(id,classes=[]){
 const names=new Set(classes);let html='';
 return {id,dataset:{},textContent:'',writes:0,scrollTop:0,scrollLeft:0,
  get innerHTML(){return html},set innerHTML(value){html=value;this.writes++},
  classList:{contains:n=>names.has(n),add:n=>names.add(n),remove:n=>names.delete(n),toggle(n,on){if(on)names.add(n);else names.delete(n)}},
  setAttribute(){},querySelector(){return null}};
}
function harness(ids=[]){
 const nodes=new Map(ids.map(id=>[id,element(id,id==='segundo-turno'?['active']:[])]));
 const events={},windowEvents={},intervals=[],timeouts=new Map();
 let now=Date.parse('2026-10-25T21:00:00Z'),nextTimer=0;
 class Clock extends Date {constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const document={readyState:'loading',visibilityState:'visible',fullscreenElement:nodes.get('segundo-turno'),body:element('body'),
  getElementById:id=>nodes.get(id)||null,querySelector:selector=>selector==='.section.active'?nodes.get('segundo-turno'):null,
  querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn};
 const context={document,navigator:{onLine:true,userAgent:''},localStorage:storage(),sessionStorage:storage(),Date:Clock,
  AbortController,URL,URLSearchParams,crypto:{randomUUID:()=> 'device-test'},console:{info(){},warn(){},error(){}},
  setInterval:(fn,ms)=>{intervals.push({fn,ms,next:now+ms});return intervals.length},clearInterval(){},
  setTimeout:(fn,ms)=>{timeouts.set(++nextTimer,{fn,ms});return nextTimer},clearTimeout:id=>timeouts.delete(id),
  scrollY:240,scrollX:0,scrollTo({top}){context.scrollY=top},requestAnimationFrame:fn=>fn(),
  matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>windowEvents[name]=fn};
 context.window=context;
 vm.createContext(context);
 return {context,nodes,events,windowEvents,intervals,
  run(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context)},
  async advance(ms){now+=ms;for(const timer of intervals){if(timer.next<=now){timer.next=now+timer.ms;timer.fn()}}await flush()}};
}
function result(votes=60){
 return {fase:'o',divulgacao:'s',geradoEm:{data:'25/10/2026',hora:'18:00:00'},
  secoes:{total:100,totalizadas:20,percentual:20},eleitores:{comparecimento:100},
  votos:{validos:votes+40,brancos:0,nulos:0},candidatos:[
   {numero:'13',nome:'LULA',partido:'PT',votos:votes,percentual:60},
   {numero:'22',nome:'FLAVIO BOLSONARO',partido:'PL',votos:40,percentual:40}]};
}
function secondRound(){
 const h=harness(['segundo-turno','turno2Status','turno2Summary','turno2Candidates','turno2Areas','turno2Headline','turno2Updated','turno2LastCheck','turno2Gap','turno2Progress','turno2AreaPicker','turno2ElectedStatus']);
 let snapshot=result(),requests=0,offline=false;
 h.context.fetch=async url=>{
  if(offline)throw Error('offline');
  if(url.startsWith('./resultados-segundo-turno.json')){requests++;return {ok:true,json:async()=>({results:{presidente_br:snapshot,presidente_ma:snapshot}})}}
  return {ok:false,status:404};
 };
 h.run('segundo-turno.js');
 return {...h,setResult:r=>snapshot=r,get requests(){return requests},fail:()=>offline=true};
}

test('recebe votos novos após cinco segundos e mantém área, tela cheia e rolagem',async()=>{
 const h=secondRound();h.events.DOMContentLoaded();await flush();
 h.context.BUSecondRound.select('ma');
 const host=h.context.document.fullscreenElement;
 h.setResult(result(85));await h.advance(5000);
 assert.equal(h.context.BUSecondRound.results.presidente_ma.candidatos[0].votos,85);
 assert.match(h.nodes.get('turno2Headline').textContent,/Maranhão/);
 assert.match(h.nodes.get('turno2Candidates').innerHTML,/85 votos válidos/);
 assert.equal(h.context.document.fullscreenElement,host);
 assert.equal(host.classList.contains('active'),true);
 assert.equal(h.context.scrollY,240);
 h.setResult(result(90));await h.advance(5000);
 assert.equal(h.context.BUSecondRound.results.presidente_ma.candidatos[0].votos,90);
});

test('consulta sem novidade mantém os cartões e falha de rede conserva a última votação',async()=>{
 const h=secondRound();h.events.DOMContentLoaded();await flush();
 const candidates=h.nodes.get('turno2Candidates'),writes=candidates.writes;
 await h.advance(5000);
 assert.equal(candidates.writes,writes,'A consulta sem mudança não deve reconstruir retratos e cartões');
 h.fail();await h.advance(5000);
 assert.equal(h.context.BUSecondRound.results.presidente_br.candidatos[0].votos,60);
 assert.match(candidates.innerHTML,/60 votos válidos/);
});

test('tempo gasto na resposta não transforma o intervalo de cinco em dez segundos',async()=>{
 const h=secondRound();let release;
 const ready=new Promise(resolve=>release=resolve),fetch=h.context.fetch;
 h.context.fetch=async(...args)=>{await ready;return fetch(...args)};
 h.events.DOMContentLoaded();await h.advance(1000);release();await flush();
 h.setResult(result(85));await h.advance(4000);
 assert.equal(h.context.BUSecondRound.results.presidente_br.candidatos[0].votos,85);
});

test('não consulta a apuração com a aba oculta ou sem conexão',async()=>{
 const h=secondRound();h.events.DOMContentLoaded();await flush();const count=h.requests;
 h.context.document.visibilityState='hidden';await h.advance(5000);assert.equal(h.requests,count);
 h.context.document.visibilityState='visible';h.context.navigator.onLine=false;
 await h.advance(5000);assert.equal(h.requests,count);
});

test('mapa recebe a nova parcial em cinco segundos e conserva o estado selecionado',async()=>{
 const h=harness(['segundo-turno','t2UFDetail']);let snapshot=result(60);
 h.context.fetch=async()=>({ok:true,json:async()=>({meta:{turno:2,eleicao:6258},results:{presidente_ma:snapshot}})});
 h.run('central-apuracao.js');h.events.DOMContentLoaded();await flush();
 h.context.BUCentral.selectUF('MA');await flush();
 snapshot=result(85);await h.advance(5000);
 assert.equal(h.context.BUCentral.stateResults.presidente_ma.candidatos[0].votos,85);
 assert.match(h.nodes.get('t2UFDetail').innerHTML,/Maranhão/);
 assert.match(h.nodes.get('t2UFDetail').innerHTML,/85 votos/);
 assert.equal(h.context.document.fullscreenElement,h.nodes.get('segundo-turno'));
});

test('painel geral atualiza em cinco segundos sem duplicar consultas ou apagar dados na falha',async()=>{
 const h=harness(['gerais']);h.nodes.get('gerais').classList.add('active');
 let current={results:{presidente_br:result(60)}},requests=0,release;
 h.context.fetchOfficialDirect=async()=>{requests++;if(release)await release;return current};
 h.context.fetchOfficialFallback=async()=>null;
 for(const name of ['paintOfficialResults','renderStats','renderResults','renderVitorinoResults'])h.context[name]=()=>{};
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const state=html.match(/^let officialResultsCache=.*$/m)[0];
 vm.runInContext(state+'\n'+html.slice(html.indexOf('async function loadOfficialResults('),html.indexOf('async function openGeneralResultsWindow(')),h.context);
 h.context.renderGeneralResults();await flush();
 let finish;release=new Promise(resolve=>finish=resolve);
 current={results:{presidente_br:result(85)}};
 await h.advance(5000);const concurrent=h.context.loadOfficialResults(true);
 assert.equal(requests,2,'Consulta manual e automática precisam compartilhar a requisição em andamento');
 finish();await concurrent;
 assert.equal(vm.runInContext('officialResultsCache.results.presidente_br.candidatos[0].votos',h.context),85);
 release=null;current=null;await h.advance(5000);
 assert.equal(vm.runInContext('officialResultsCache.results.presidente_br.candidatos[0].votos',h.context),85);
});

test('sincronização lenta não sobrepõe consultas nem desfaz a rolagem feita pelo usuário',async()=>{
 const h=harness(['segundo-turno']);let release,requests=0,redraws=0;
 const response=new Promise(resolve=>release=resolve);
 h.context.fetch=async()=>{requests++;await response;return {ok:true,text:async()=> '[]'}};
 for(const name of ['renderStats','renderBUFilter','renderBUs','renderResults','renderSections'])h.context[name]=()=>redraws++;
 Object.assign(h.context,{buData:[],KEY_BU:'ballots'});
 h.run('cloud.js');
 const first=h.context.BUCloud.softRefresh(),second=h.context.BUCloud.softRefresh();
 await flush();h.context.scrollY=910;release();await Promise.all([first,second]);
 assert.equal(requests,1,'Deve haver uma única leitura com fila vazia e chamadas simultâneas');
 assert.equal(h.context.scrollY,910,'A rolagem atual deve prevalecer sobre a posição anterior à consulta');
 const oldRedraws=redraws;await h.context.BUCloud.softRefresh();
 assert.equal(redraws,oldRedraws,'A central sem alterações não deve redesenhar as telas');
});

test('nova versão e troca do service worker mantêm a página aberta; recarga exige ação manual',async()=>{
 const h=harness(['segundo-turno']);const navigations=[],workerEvents={};
 h.context.location={href:'https://diw87.github.io/DillResgate/bu2026/',search:'',reload:()=>navigations.push('reload'),replace:()=>navigations.push('replace')};
 h.context.localStorage=storage({BU2026_APP_BUILD:'anterior'});
 h.context.caches={keys:async()=>[],delete:async()=>true};
 const registration={update:async()=>{},addEventListener(){}};
 h.context.navigator.serviceWorker={controller:{},register:async()=>registration,addEventListener:(name,fn)=>workerEvents[name]=fn};
 h.context.fetch=async()=>({ok:true,json:async()=>({build:'nova-versao'})});
 h.run('pwa.js');h.events.DOMContentLoaded();await flush();await flush();
 workerEvents.controllerchange?.();
 assert.deepEqual(navigations,[],'Atualização em segundo plano não pode navegar ou sair da tela cheia');
 await h.context.applyPwaUpdate();assert.deepEqual(navigations,['reload']);
});


test('telão mostra diferença real, progresso e abstenção da localidade fixa',async()=>{
 const h=secondRound();h.events.DOMContentLoaded();await flush();
 const r=result(85);r.candidatos[0].percentual=68;r.candidatos[1].percentual=32;r.eleitores.abstencao=12;
 h.setResult(r);await h.advance(5000);h.context.BUSecondRound.select('ma');
 assert.match(h.nodes.get('turno2Gap').textContent,/45 votos/);
 assert.match(h.nodes.get('turno2Gap').textContent,/36,00/);
 assert.match(h.nodes.get('turno2Progress').textContent,/20,00%/);
 assert.match(h.nodes.get('turno2Summary').innerHTML,/Abstenção.*12/);
 assert.equal(h.nodes.get('turno2AreaPicker').value,'ma');
 await h.advance(15000);assert.equal(h.nodes.get('turno2AreaPicker').value,'ma');
});
test('telão distingue ausência de dados, empate e zero oficial',async()=>{
 const h=secondRound();h.context.BUSecondRound.select('vf');
 assert.match(h.nodes.get('turno2Gap').textContent,/Aguardando/);
 h.events.DOMContentLoaded();await flush();
 const r=result(40);r.candidatos.forEach(c=>c.percentual=50);r.eleitores.abstencao=0;
 h.setResult(r);await h.advance(5000);h.context.BUSecondRound.select('br');
 assert.match(h.nodes.get('turno2Gap').textContent,/Empate.*0 votos.*0,00/);
 assert.match(h.nodes.get('turno2Summary').innerHTML,/Abstenção.*0/);
});

test('atalho legado de TV abre telão fixo sem alternar abrangência',async()=>{
 const h=harness(['segundo-turno']);let fullscreen=0,selections=0;
 h.context.BUSecondRound={toggleFullscreen:async()=>fullscreen++,select:()=>selections++};
 h.run('central-apuracao.js');await h.context.BUCentral.toggleTV();
 await h.advance(24000);assert.equal(fullscreen,1);assert.equal(selections,0);
});
test('entrar no telão conserva mapa de cidades e seleção dos candidatos',async()=>{
 const h=secondRound();const map=[];
 h.events.DOMContentLoaded();await flush();h.context.BUSecondRound.select('ma');
 h.context.document.fullscreenElement=null;
 h.context.BUCentral={selectMapMode:mode=>map.push(mode),selectUF:uf=>map.push(uf)};
 await h.context.BUSecondRound.toggleFullscreen();
 assert.deepEqual(map,['second']);
 assert.equal(h.nodes.get('segundo-turno').classList.contains('t2-fullscreen-fallback'),true);
 assert.equal(h.nodes.get('turno2AreaPicker').value,'ma');
});

test('campos de eleitores ausentes no arquivo TSE aparecem sem dados, nunca como zero',async()=>{
 const h=secondRound();
 h.context.fetch=async url=>url.startsWith('https://resultados.tse.jus.br/')?{ok:true,json:async()=>({f:'o',dv:'s',s:{ts:'100',st:'20',pst:'20,00'},v:{vv:'100'},carg:[{agr:[{par:[{sg:'PT',cand:[{n:'13',nmu:'LULA',vap:'60',pvap:'60'}]},{sg:'PL',cand:[{n:'22',nmu:'FLAVIO',vap:'40',pvap:'40'}]}]}]}]})}:{ok:false,status:404};
 h.events.DOMContentLoaded();await flush();
 assert.match(h.nodes.get('turno2Summary').innerHTML,/Abstenção<\/span><strong>—/);
 assert.match(h.nodes.get('turno2Summary').innerHTML,/Comparecimento<\/span><strong>—/);
});

test('mostra ELEITO somente com totalização nacional oficial concluída',async()=>{
 const h=secondRound();
 h.events.DOMContentLoaded();await flush();
 assert.doesNotMatch(h.nodes.get('turno2Candidates').innerHTML,/✓ ELEITO/);
 const partial=result(95);
 partial.candidatos[0].eleito=true;
 h.setResult(partial);await h.advance(5000);
 assert.doesNotMatch(h.nodes.get('turno2Candidates').innerHTML,/✓ ELEITO/,'Liderança parcial não é eleição confirmada');
 const final=result(95);
 final.codigoAbrangencia='br';final.totalizacaoFinal='s';
 final.secoes={total:100,totalizadas:100,percentual:100};
 final.candidatos[0].eleito=true;
 h.setResult(final);await h.advance(5000);
 assert.match(h.nodes.get('turno2Candidates').innerHTML,/✓ ELEITO/);
 assert.match(h.nodes.get('turno2ElectedStatus').textContent,/ELEITO.*LULA/);
 h.context.BUSecondRound.select('ma');
 assert.doesNotMatch(h.nodes.get('turno2Candidates').innerHTML,/✓ ELEITO/,'Vencer em uma UF não significa ser eleito presidente');
 assert.equal(h.nodes.get('turno2ElectedStatus').hidden,true);
});
test('tela fixa usa mapa interativo sem nomes de cidade, com zoom e cores por margem',()=>{
 const h=harness(['segundo-turno']);
 h.run('mapa-municipios.js');
 assert.equal(typeof h.context.BUMunicipios.setZoom,'function');
 assert.equal(typeof h.context.BUMunicipios.toggleLabels,'undefined','rótulos fixos retirados');
 const map=fs.readFileSync(path.join(root,'mapa-municipios.js'),'utf8');
 const central=fs.readFileSync(path.join(root,'central-apuracao.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const tv=fs.readFileSync(path.join(root,'telao-fixo.css'),'utf8');
 const css=fs.readFileSync(path.join(root,'central-apuracao.css'),'utf8');
 assert.doesNotMatch(map,/createElementNS\(NS,"text"\)/);
 assert.match(map,/municipalZoom/);
 assert.match(map,/pointermove/);
 assert.match(map,/previewMapPlace/);
 assert.match(map,/winner\.margin<5/);
 assert.match(css,/margin-close/);
 assert.match(css,/margin-wide/);
 assert.match(central,/BUMunicipios\.setZoom\?\.\(mapZoom\)/);
 assert.match(central,/previewMapPlace/);
 assert.match(html,/t2TVMapSelection/);
 assert.doesNotMatch(html,/t2CityLabelsBtn/);
 assert.match(tv,/pointer-events:auto/);
 assert.match(tv,/t2-map-controls/);
 assert.doesNotMatch(tv,/pointer-events:none;padding:0/);
});
test('zoom do mapa municipal funciona dentro do telão sem sair do modo de TV',()=>{
 const h=harness(['segundo-turno','t2MapZoom']);
 const levels=[];
 h.context.BUMunicipios={isOpen:()=>true,setZoom:value=>levels.push(value)};
 h.run('central-apuracao.js');
 h.context.BUCentral.zoomMap(1.3);
 assert.equal(levels.at(-1),1.3);
 assert.equal(h.nodes.get('t2MapZoom').textContent,'130%');
 h.context.BUCentral.resetMapZoom();
 assert.equal(levels.at(-1),1);
 assert.equal(h.nodes.get('t2MapZoom').textContent,'100%');
});
