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
 const photos=new Map([[previous?.isAnonymous?'guest':'local','[{"id":5}]']]);
 const next={uid:'B',isAnonymous:false,email:'b@example.org'};
 const auth={currentUser:previous,signInWithEmailAndPassword:async()=>{auth.currentUser=next;return {user:next};}};
 const window={__evfCurrentUid:currentUid,__evfCurrentState:{profile:{name:'A'},sessions:[{id:'s1'}]},dispatchEvent:()=>{events++;}};
 const context={CLOUD_ENABLED:true,fbAuth:auth,window,clone:obj=>JSON.parse(JSON.stringify(obj)),
  localStorage:{getItem:k=>photos.get(k)??null,setItem:(k,v)=>photos.set(k,v)},
  photoKeyFor:uid=>uid||'local',readPhotos:uid=>JSON.parse(photos.get(uid||'local')||'[]'),
  evolveFitMergeDeviceStateIntoAccount:async()=>{migrations++;},
  cloudQueueWrite:()=>{},toCloud:()=>({}),setTimeout:fn=>fn(),console,CustomEvent:class{}};
 vm.createContext(context);
 vm.runInContext(source.slice(start,end)+'\nthis.signIn=evolveFitAccountAuth;',context);
 await context.signIn('signin','b@example.org','password');
 assert.equal(events,1,'o início de sessão atualiza a interface');
 return {migrations,photos};
}
(async()=>{
 let result=await signIn({uid:'A',isAnonymous:false},'A');
 assert.equal(result.migrations,0,'conta A nunca é fundida automaticamente na conta B');
 assert.equal(result.photos.has('B'),false,'fotos de A nunca são copiadas para B');
 result=await signIn({uid:'guest',isAnonymous:true},'guest');
 assert.equal(result.migrations,1,'dados anónimos podem ser migrados após login');
 assert.equal(result.photos.get('B'),result.photos.get('guest'),'fotos anónimas copiadas sem eliminar a origem');
 result=await signIn(null,null);
 assert.equal(result.migrations,1,'dados locais podem ser migrados após login');
 assert.equal(result.photos.get('B'),result.photos.get('local'),'fotos locais conservadas na conta');
 assert.equal((await signIn(null,'A')).migrations,0,'estado antigo autenticado não é tratado como modo local');
 console.log('Login: alternância A/B isolada; migração local/anónima mantida.');
})().catch(e=>{console.error(e);process.exitCode=1;});
