const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=source.indexOf('async function evolveFitCloudWriteNow(){');
const end=source.indexOf('document.addEventListener("visibilitychange"',start);
assert.ok(start>0&&end>start);
(async()=>{
 let release,clearUid=null,events=0,status=0;
 const gate=new Promise(resolve=>release=resolve);
 const fbAuth={currentUser:{uid:'A'}};
 const ref={};
 const fbDb={collection:()=>({doc:()=>ref}),runTransaction:async callback=>{
   await gate;
   return callback({get:async()=>({exists:false}),set:()=>{}});
 }};
 const local={_updatedAt:3,profile:{name:'A'},days:{},body:[],sessions:[]};
 const pending={uid:'A',state:local,payload:{_json:JSON.stringify(local)},base:{baseA:'a'}};
 const window={__evfPending:pending,__evfBase:{baseA:'a'},evfSetCloudStatus:()=>{status++;},dispatchEvent:()=>{events++;}};
 const context={window,fbAuth,fbDb,clearTimeout:()=>{},normalize:s=>s,toCloud:s=>s,evfFlatten:s=>({profile:s.profile}),
   cloudQueueRead:()=>({payload:pending.payload}),cloudQueueClear:uid=>{clearUid=uid;},
   navigator:{onLine:true},console,CustomEvent:class{},setTimeout:()=>{},evfFlatEqual:()=>true,evfMerge3:()=>{throw Error('não esperado')}};
 vm.createContext(context);
 vm.runInContext(source.slice(start,end)+'\nthis.writeNow=evolveFitCloudWriteNow;',context);
 const writing=context.writeNow();
 fbAuth.currentUser={uid:'B'};
 window.__evfBase={baseB:'b'};
 release();
 assert.equal(await writing,true);
 assert.equal(clearUid,'A','escrita concluída limpa apenas a fila de A');
 assert.equal(window.__evfBase.baseB,'b','conclusão de A não altera base de B');
 assert.equal(events,0,'A não envia fusão de dados ao ecrã B');
 assert.equal(status,0,'A não mostra estado de sincronização em B');
 console.log('Escrita em curso: mudança A→B não altera base, eventos nem estado de B.');
})().catch(e=>{console.error(e);process.exitCode=1});
