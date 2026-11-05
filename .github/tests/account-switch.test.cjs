const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=source.indexOf('async function evolveFitAccountAuth(');
const end=source.indexOf('const EVOLVEFIT_CLOUD_QUEUE_KEY',start);
assert.ok(start>0&&end>start);
async function signIn(previous,currentUid){
 let migrations=0,events=0;
 const next={uid:'B',isAnonymous:false,email:'b@example.org'};
 const auth={currentUser:previous,signInWithEmailAndPassword:async()=>{auth.currentUser=next;return {user:next};}};
 const window={__evfCurrentUid:currentUid,__evfCurrentState:{profile:{name:'A'},sessions:[{id:'s1'}]},dispatchEvent:()=>{events++;}};
 const context={CLOUD_ENABLED:true,fbAuth:auth,window,clone:obj=>JSON.parse(JSON.stringify(obj)),
  evolveFitMergeDeviceStateIntoAccount:async()=>{migrations++;},
  cloudQueueWrite:()=>{},toCloud:()=>({}),setTimeout:fn=>fn(),console,CustomEvent:class{}};
 vm.createContext(context);
 vm.runInContext(source.slice(start,end)+'\nthis.signIn=evolveFitAccountAuth;',context);
 await context.signIn('signin','b@example.org','password');
 assert.equal(events,1,'o início de sessão atualiza a interface');
 return migrations;
}
(async()=>{
 assert.equal(await signIn({uid:'A',isAnonymous:false},'A'),0,'conta A nunca é fundida automaticamente na conta B');
 assert.equal(await signIn({uid:'guest',isAnonymous:true},'guest'),1,'dados anónimos podem ser migrados após login');
 assert.equal(await signIn(null,null),1,'dados locais podem ser migrados após login');
 assert.equal(await signIn(null,'A'),0,'estado antigo autenticado não é tratado como modo local');
 console.log('Login: alternância A/B isolada; migração local/anónima mantida.');
})().catch(e=>{console.error(e);process.exitCode=1;});
