const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const storageStart=source.indexOf('const BASE_KEY =');
const helpersStart=source.indexOf('const OLD_SHARED_KEY =',storageStart);
const helpersEnd=source.indexOf('const setLocalSaveStatus',helpersStart);
const eraseStart=source.indexOf(' const eraseRecords=()=>{');
const eraseEnd=source.indexOf(' const saveTargets=',eraseStart);
assert.ok(storageStart>0&&helpersStart>0&&helpersEnd>0&&eraseStart>0&&eraseEnd>eraseStart);
function harness(initial={},uid='A',allowErase=true){
 const map=new Map(Object.entries(initial));const events=[];
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size;}};
 const state={days:{today:{tasks:{}}},body:[{date:'today'}],sessions:[{id:'s1'}],trainingCompleted:{today:true},profile:{proteinTarget:170,coachBaseline:2,planAdjustments:['x']}};
 const context={localStorage:storage,console,uid,window:{confirm:()=>allowErase,dispatchEvent:e=>events.push(e),__evfSyncMode:'local'},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},setSnapshots:()=>{},setDataMessage:()=>{},update:fn=>fn(state)};
 vm.createContext(context);
 vm.runInContext(source.slice(storageStart,source.indexOf('const clone =',storageStart))+
  source.slice(helpersStart,helpersEnd)+source.slice(eraseStart,eraseEnd)+
  '\nthis.photos=readPhotos;this.erase=eraseRecords;',context);
 return {map,state,events,photos:context.photos,erase:context.erase};
}
let h=harness({'lifeos_v4_u_A':'{}','evolvefit_progress_photos_v1':'[{"id":1}]'});
assert.equal(h.photos('A')[0].id,1,'a conta única recupera fotos antigas');
assert.equal(h.map.get('evolvefit_progress_photos_v1_legacy_owner'),'uid:A');
assert.equal(h.photos('B').length,0,'B não vê fotos antigas atribuídas a A');
h=harness({'lifeos_v4_u_A':'{}','lifeos_v4_u_B':'{}','evolvefit_progress_photos_v1':'[{"id":1}]'});
assert.equal(h.photos('B').length,0,'fotos antigas ambíguas não são atribuídas automaticamente');
assert.equal(h.map.has('evolvefit_progress_photos_v1'),true,'fotos antigas continuam guardadas');
const snapshots=JSON.stringify([{owner:'A',day:'2026-11-05',json:'{}'},{owner:'B',day:'2026-11-05',json:'{}'}]);
h=harness({lifeos_v4_snapshots:snapshots,lifeos_v4_snapshots_day_A:'2026-11-05',lifeos_v4_snapshots_day_B:'2026-11-05',
 'evolvefit_progress_photos_v1_uid%3AA':'[{"id":1}]','evolvefit_progress_photos_v1_uid%3AB':'[{"id":2}]',
 'evolvefit_progress_photos_v1':'[{"id":1}]','evolvefit_progress_photos_v1_legacy_owner':'uid:A'});
const denied=harness(Object.fromEntries(h.map), 'A', false);
denied.erase();
assert.equal(JSON.parse(denied.map.get('lifeos_v4_snapshots')).length,2,'cancelar não apaga cópias');
assert.equal(denied.state.body.length,1,'cancelar não apaga registos');
h.erase();
assert.deepEqual(JSON.parse(h.map.get('lifeos_v4_snapshots')).map(x=>x.owner),['B'],'cópias B preservadas');
assert.equal(h.map.has('lifeos_v4_snapshots_day_B'),true,'marcador diário B preservado');
assert.equal(h.map.has('lifeos_v4_snapshots_day_A'),false);
assert.equal(h.map.has('evolvefit_progress_photos_v1_uid%3AB'),true,'fotos B preservadas');
assert.equal(h.map.has('evolvefit_progress_photos_v1_uid%3AA'),false);
assert.equal(h.map.has('evolvefit_progress_photos_v1'),false,'cópia antiga da própria A removida após confirmação');
assert.equal(h.events[0].detail.uid,'A','notificação de eliminação só para A');
assert.equal(h.state.body.length,0);assert.equal(h.state.sessions.length,0);
assert.equal(h.state.profile.proteinTarget,170,'metas mantidas');
console.log('Fotografias e eliminação: migração sem mistura, cópias/fotos da outra conta intactas.');
