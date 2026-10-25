const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function node(id){
 const classes=new Set(id==='exterior'?['active']:[]);let html='';
 return {id,dataset:{},value:'',textContent:'',writes:0,hidden:false,disabled:false,
  get innerHTML(){return html},set innerHTML(v){html=v;this.writes++},
  classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c)}},
  setAttribute(){},querySelector(){return null}};
}
function official(area='zz',lula=60,flavio=40,extra={}){
 return {ele:'6258',t:'2',f:'o',tpabr:area==='zz'?'uf':'mu',cdabr:area,dv:'s',and:'p',tf:'n',dg:'25/10/2026',hg:'18:00:00',
  s:{ts:'10',st:'5',pst:'50,00'},e:{te:'200',c:String(lula+flavio+4),a:'15'},v:{vv:String(lula+flavio),vb:'1',tvn:'3'},
  carg:[{cd:'1',agr:[{par:[{sg:'PT',cand:[{n:'13',nmu:'LULA',vap:String(lula),pvap:String(100*lula/(lula+flavio))}]},{sg:'PL',cand:[{n:'22',nmu:'FLAVIO BOLSONARO',vap:String(flavio),pvap:String(100*flavio/(lula+flavio))}]}]}]}],...extra};
}
function harness({noTse=false,cachedSnapshot=null}={}){
 const ids=['exterior','exteriorCountry','exteriorLocality','exteriorHeadline','exteriorStatus','exteriorSummary','exteriorCandidates','exteriorLocations','exteriorCoverage','exteriorUpdated','exteriorLastCheck','exteriorRefreshBtn','exteriorRefreshLabel','exteriorFeedback','exteriorSource','exteriorFullscreenBtn'];
 const nodes=new Map(ids.map(id=>[id,node(id)])),events={},intervals=[],requests=[];
 let now=Date.parse('2026-10-25T21:05:00Z'),offline=false,hold=null;
 const docs=new Map([['zz',official()],['30627',official('30627',60,40)],['29742',official('29742',30,170)],['30198',official('30198',90,10)]]);
 if(noTse)docs.clear();
 const catalog={meta:{official:true},localidades:[{codigo:'30627',nome:'TÓQUIO',pais:'Japão'},{codigo:'29742',nome:'HAMAMATSU',pais:'Japão'},{codigo:'30198',nome:'NAGÓIA',pais:'Japão'},{codigo:'30805',nome:'WELLINGTON',pais:'Nova Zelândia'}]};
 class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
 const context={Date:Clock,AbortController,console:{warn(){},info(){}},navigator:{onLine:true},
  document:{readyState:'loading',visibilityState:'visible',body:node('body'),getElementById:id=>nodes.get(id)||null,addEventListener:(e,fn)=>events[e]=fn},
  addEventListener(){},setTimeout,clearTimeout,setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length},
  scrollY:300,scrollTo(){throw Error('Atualização não pode mover a tela')},location:{reload(){throw Error('Não pode recarregar')}}};
 context.fetch=async url=>{
  requests.push(url);if(hold)await hold;if(offline)throw Error('offline');
  if(url.startsWith('./exterior-localidades.json'))return {ok:true,json:async()=>catalog};
  if(url.startsWith('./resultados-exterior-localidades.json'))return cachedSnapshot?{ok:true,json:async()=>cachedSnapshot}:{ok:false,status:404};
  const key=url.match(/zz(\d{5})?-c0001/)?.[1]||'zz';
  if(!url.startsWith('https://resultados.tse.jus.br/')||!docs.has(key))return {ok:false,status:404};
  return {ok:true,json:async()=>docs.get(key)};
 };
 context.window=context;vm.createContext(context);
 // O renderer real dos cartões presidenciais é compartilhado pelos dois painéis.
 vm.runInContext(fs.readFileSync(path.join(root,'segundo-turno.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'exterior.js'),'utf8'),context);
 events.DOMContentLoaded?.();
 return {context,nodes,docs,requests,async activate(){await context.BUExterior.activate();await flush()},
  async advance(ms){now+=ms;for(const t of intervals)if(ms>=t.ms)t.fn();await flush()},
  fail(){offline=true},hold(p){hold=p},flush};
}

// Quebras cobertas: usar BR no exterior, somar percentuais e aceitar uma fonte de outra eleição.
test('o total do exterior usa exclusivamente ZZ, com Lula vermelho e Flávio azul',async()=>{
 const h=harness();await h.activate();
 const cards=h.nodes.get('exteriorCandidates').innerHTML;
 assert.match(cards,/60 votos válidos/);assert.match(cards,/40 votos válidos/);
 assert.match(cards,/data-candidate-number="13" data-palette="red"/);
 assert.match(cards,/data-candidate-number="22" data-palette="blue"/);
 assert.equal(h.requests.some(url=>url.includes('/br/')),false);
 assert.match(h.nodes.get('exteriorHeadline').textContent,/Exterior/);
});
test('o país soma votos e recalcula percentuais em suas três localidades',async()=>{
 const h=harness();await h.activate();await h.context.BUExterior.selectCountry('Japão');
 const cards=h.nodes.get('exteriorCandidates').innerHTML;
 assert.match(cards,/180 votos válidos/);assert.match(cards,/220 votos válidos/);assert.match(cards,/45,00%/);
 assert.match(h.nodes.get('exteriorCoverage').textContent,/3.*3/);
 assert.match(h.nodes.get('exteriorLocations').innerHTML,/TÓQUIO/);
 await h.context.BUExterior.selectLocality('30627');
 assert.match(h.nodes.get('exteriorHeadline').textContent,/TÓQUIO/);
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/60 votos válidos/);
});
test('localidade indisponível é identificada e não vira um zero ou país completo',async()=>{
 const h=harness();h.docs.delete('30198');await h.activate();await h.context.BUExterior.selectCountry('Japão');
 assert.match(h.nodes.get('exteriorCoverage').textContent,/2.*3/);
 assert.match(h.nodes.get('exteriorCoverage').textContent,/incomplet|indispon/i);
 assert.match(h.nodes.get('exteriorLocations').innerHTML,/Indisponível/);
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/90 votos válidos/);
});
test('simulado, primeiro turno, cargo e abrangência errados não entram no exterior',async()=>{
 for(const extra of [{f:'s'},{ele:'6257',t:'1'},{cdabr:'br'},{carg:[{cd:'3',agr:[]}]}]){
  const h=harness();h.docs.set('zz',official('zz',60,40,extra));await h.activate();
  assert.doesNotMatch(h.nodes.get('exteriorCandidates').innerHTML,/60 votos válidos/);
  assert.match(h.nodes.get('exteriorStatus').textContent,/aguardando|indispon/i);
 }
});
test('arquivo zerado fica aguardando e nunca usa votação do primeiro turno',async()=>{
 const h=harness();h.docs.set('zz',official('zz',0,0,{s:{ts:'10',st:'0',pst:'0,00'}}));await h.activate();
 assert.match(h.nodes.get('exteriorStatus').textContent,/aguardando/i);
 assert.doesNotMatch(h.nodes.get('exteriorCandidates').innerHTML,/NaN|0 votos válidos/);
});
test('cinco segundos atualizam a parcial sem trocar país, rolagem ou tela cheia',async()=>{
 const h=harness();await h.activate();await h.context.BUExterior.selectCountry('Japão');
 const host=h.nodes.get('exterior');h.context.document.fullscreenElement=host;
 h.docs.set('30627',official('30627',100,40,{hg:'18:01:00'}));await h.advance(5000);
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/220 votos válidos/);
 assert.match(h.nodes.get('exteriorHeadline').textContent,/Japão/);
 assert.equal(h.context.scrollY,300);assert.equal(h.context.document.fullscreenElement,host);
});
test('rede falha, arquivo antigo e arquivo zerado preservam a última parcial',async()=>{
 const h=harness();await h.activate();const cards=h.nodes.get('exteriorCandidates'),before=cards.innerHTML;
 h.docs.set('zz',official('zz',20,10,{dg:'24/10/2026'}));await h.context.BUExterior.refresh();assert.equal(cards.innerHTML,before);
 h.docs.set('zz',official('zz',0,0,{s:{ts:'10',st:'0',pst:'0,00'},hg:'18:02:00'}));await h.context.BUExterior.refresh();assert.equal(cards.innerHTML,before);
 h.fail();await h.context.BUExterior.refresh();assert.equal(cards.innerHTML,before);
 assert.match(h.nodes.get('exteriorFeedback').textContent,/última parcial|conexão/i);
});
test('sucesso de ZZ não oculta falha ao atualizar um país ou localidade já consultado',async()=>{
 const h=harness();await h.activate();await h.context.BUExterior.selectCountry('Japão');
 h.docs.delete('30627');h.docs.delete('29742');h.docs.delete('30198');
 await h.context.BUExterior.refresh();
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/180 votos válidos/);
 assert.match(h.nodes.get('exteriorFeedback').textContent,/falha|não foi possível/i);
 assert.match(h.nodes.get('exteriorCoverage').textContent,/última parcial|falha/i);
 assert.match(h.nodes.get('exteriorLocations').innerHTML,/falha na consulta/i);
 await h.context.BUExterior.selectLocality('30627');
 assert.match(h.nodes.get('exteriorFeedback').textContent,/falha|não foi possível/i);
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/60 votos válidos/);
 h.docs.set('30627',official('30627',80,40,{hg:'18:01:00'}));
 await h.context.BUExterior.refresh();
 assert.doesNotMatch(h.nodes.get('exteriorFeedback').textContent,/falha|não foi possível/i);
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/80 votos válidos/);
});
test('não consulta com aba inativa, navegador oculto ou sem conexão',async()=>{
 const h=harness();await h.activate();const count=h.requests.length;
 h.nodes.get('exterior').classList.remove('active');await h.advance(5000);assert.equal(h.requests.length,count);
 h.nodes.get('exterior').classList.add('active');h.context.document.visibilityState='hidden';await h.advance(5000);assert.equal(h.requests.length,count);
 h.context.document.visibilityState='visible';h.context.navigator.onLine=false;await h.advance(5000);assert.equal(h.requests.length,count);
});
test('trocar o país durante consulta lenta preserva o filtro e não sobrepõe leituras',async()=>{
 const h=harness();await h.activate();let release;h.hold(new Promise(resolve=>release=resolve));
 const first=h.context.BUExterior.refresh();await flush();const count=h.requests.length;
 h.context.BUExterior.refresh();h.context.BUExterior.selectCountry('Japão');await flush();assert.equal(h.requests.length,count);
 release();await first;await flush();await flush();
 assert.match(h.nodes.get('exteriorHeadline').textContent,/Japão/);
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/180 votos válidos/);
});

test('visitante abre Exterior, volta pelo histórico e usa atalho sem acessar o lançamento fiscal',()=>{
 const views=['novo','apurados','resultados','vitorino','segundo-turno','exterior'];
 const sections=views.map(node),tabs=views.map(id=>node(id+'-tab'));
 sections[4].classList.add('active');sections[5].classList.remove('active');
 const events={},windowEvents={},timeouts=[],publicTabs=[node('public-br'),node('public-zz')];
 publicTabs[0].dataset.publicView='segundo-turno';publicTabs[1].dataset.publicView='exterior';
 const doc={body:node('body'),getElementById:id=>sections.find(x=>x.id===id)||null,
  querySelector:s=>s==='.section.active'?sections.find(x=>x.classList.contains('active'))||null:null,
  querySelectorAll:s=>s==='.section'?sections:s==='.tab'?tabs:s==='[data-public-view]'?publicTabs:[],
  addEventListener:(name,fn)=>events[name]=fn};
 const history={state:null,replaceState(s){this.state=s},pushState(s){this.state=s}};
 const context={document:doc,history,location:{href:'https://diw87.github.io/DillResgate/bu2026/?abrir=exterior',search:'?abrir=exterior'},
  sessionStorage:{removeItem(){},setItem(){}},localStorage:{getItem(){return null},setItem(){}},
  navigator:{onLine:false,userAgent:''},console,URLSearchParams,
  addEventListener:(name,fn)=>windowEvents[name]=fn,setTimeout:(fn,ms)=>timeouts.push({fn,ms}),
  matchMedia:()=>({matches:false}),BUSecondRound:{activate(){}},BUExterior:{activate(){}}};
 context.window=context;vm.createContext(context);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 vm.runInContext(html.match(/^function showMain\(.*$/m)[0],context);
 vm.runInContext(fs.readFileSync(path.join(root,'access.js'),'utf8'),context);events.DOMContentLoaded();
 vm.runInContext(fs.readFileSync(path.join(root,'navigation.js'),'utf8'),context);events.DOMContentLoaded();
 context.BUNavigation.go('exterior');assert.equal(doc.querySelector('.section.active').id,'exterior');
 const exteriorState=history.state;context.BUNavigation.go('segundo-turno');
 windowEvents.popstate({state:exteriorState});assert.equal(doc.querySelector('.section.active').id,'exterior');
 context.BUNavigation.go('novo');assert.equal(doc.querySelector('.section.active').id,'segundo-turno');
 vm.runInContext(fs.readFileSync(path.join(root,'pwa.js'),'utf8'),context);events.DOMContentLoaded();
 assert.equal(doc.querySelector('.section.active').id,'segundo-turno');
 assert.equal(publicTabs[0].classList.contains('active'),true);
 context.BUNavigation.go('exterior');
 assert.equal(doc.querySelector('.section.active').id,'exterior');
 assert.equal(publicTabs[1].classList.contains('active'),true);
});

test('mostra votos oficiais do cache local quando a consulta direta ao TSE falha',async()=>{
 const cached={
  eleicao:6258,turno:2,codigoAbrangencia:'30627',fase:'o',divulgacao:'s',
  geradoEm:{data:'25/10/2026',hora:'18:00:00'},
  secoes:{total:10,totalizadas:5,percentual:50},
  eleitores:{total:200,comparecimento:104,abstencao:15},
  votos:{validos:100,brancos:1,nulos:3},
  candidatos:[{numero:'13',nome:'LULA',partido:'PT',votos:60,percentual:60},
              {numero:'22',nome:'FLAVIO BOLSONARO',partido:'PL',votos:40,percentual:40}]
 };
 const h=harness({noTse:true,cachedSnapshot:{meta:{official:true,eleicao:6258,turno:2},results:{'30627':cached}}});
 await h.activate();
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/60 votos válidos/);
 assert.match(h.nodes.get('exteriorStatus').textContent,/soma parcial/i);
 await h.context.BUExterior.selectCountry('Japão');
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/60 votos válidos/);
 assert.match(h.nodes.get('exteriorLocations').innerHTML,/TÓQUIO/);
 assert.match(h.nodes.get('exteriorCoverage').textContent,/incomplet/i);
});

test('aceita codigo de abrangencia TSE com prefixo ZZ por localidade e exibe na aba correta',async()=>{
 const h=harness();
 h.docs.set('30627',official('zz30627',75,25));
 await h.activate();
 await h.context.BUExterior.selectCountry('Japão');
 await h.context.BUExterior.selectLocality('30627');
 assert.match(h.nodes.get('exteriorCandidates').innerHTML,/75 votos válidos/);
 assert.match(h.nodes.get('exteriorHeadline').textContent,/TÓQUIO/);
 assert.match(h.nodes.get('exteriorSummary').innerHTML,/100/);
});

test('mostra tabela por país diretamente na aba Exterior e permite consultar por país',async()=>{
 const h=harness();await h.activate();
 assert.match(h.nodes.get('exteriorLocations').innerHTML,/Votos separados por país/);
 assert.match(h.nodes.get('exteriorLocations').innerHTML,/data-country="Japão"/);
 await h.context.BUExterior.selectCountry('Japão');
 await h.context.BUExterior.selectCountry('');
 const table=h.nodes.get('exteriorLocations').innerHTML;
 assert.match(table,/Japão/);
 assert.match(table,/180/);
 assert.match(table,/220/);
 assert.match(table,/agrupados pela DW Tech/);
});

test('o atalho antigo do Exterior nao toma a tela inicial Brasil e exterior',()=>{
 const pwa=fs.readFileSync(path.join(root,'pwa.js'),'utf8');
 assert.match(pwa,/abrir==="exterior"/);
 assert.match(pwa,/q\.delete\("abrir"\)/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const countries=html.indexOf('id="exteriorLocations"');
 const total=html.indexOf('id="exteriorCandidates"');
 assert.ok(countries>0 && countries<total,'países devem aparecer antes dos cartões do total geral');
 assert.match(html,/public-result-tab active[^>]*>◉ Brasil \+ exterior/);
});
