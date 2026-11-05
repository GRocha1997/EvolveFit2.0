const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const start = html.indexOf('function exerciseMarked(x,r){');
const end = html.indexOf('/* --------------------- temporizador e progressão', start);
assert.ok(start > 0 && end > start);
const parseReps = v => Array.isArray(v) ? v : String(v || '').split(/[, /]+/).filter(Boolean).map(Number);
const context = {
  React: {Fragment:'fragment', createElement:(type,props,...children)=>({type,props:props||{},children})},
  useEffect:()=>{},
  isDecisionExcludedExercise:x=>!!x.noDecision,
  isNoLogExercise:x=>!!x.noLog,
  isTimeCutCandidate:()=>false,
  isOptionalSetCandidate:()=>false,
  isUnilateralExercise:()=>false,
  parseActualRepsBySet:parseReps,
  progressionTip:()=>({k:'ok',text:'Regista as séries.'}),
  rirTargetsFor:()=>[2],rirInstruction:()=>'',rirOf:()=>2,rirLabel:v=>String(v),
  repsLbl:x=>String(x.reps),fmtNum:v=>String(v),normDecInput:v=>v,
  I:()=>{},RirChips:()=>{},window:{},console
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
const x = {exerciseId:'exercise-1',name:'Remada',sets:3,reps:8,weight:35};
assert.equal(context.exerciseMarked(x,{repsBySet:'',rir:null}),false);
assert.equal(context.exerciseMarked(x,{exerciseChecked:true,repsBySet:'',rir:null}),true);
assert.equal(context.exerciseMarked(x,{exerciseChecked:false,repsBySet:'8, 8, 8',rir:2}),false,'desmarcar não apaga RIR');
assert.equal(context.exerciseMarked(x,{exerciseChecked:true,cutForTime:true,rir:2}),false,'corte não conta como feito');
assert.equal(context.exerciseMarked(x,{rir:2,repsBySet:'8, 8, 8'}),true,'sessões antigas continuam com check');
const find = (node,predicate) => {
  if (Array.isArray(node)) { for(const child of node){const found=find(child,predicate);if(found)return found;} return null; }
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return find(node.children,predicate);
};
function mount({today=null,canSave=true,exercises=[x,{...x,exerciseId:'exercise-2',name:'Press'}]}={}) {
  const hooks=[]; let cursor=0;
  context.useState = initial => {const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];};
  context.useRef = initial => {const i=cursor++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];};
  const saved=[];
  const props = {history:[],exercises,onSave:(...args)=>saved.push(args),loggedSelected:!!today,sessionDate:'2026-11-12',canSave,today,cycleWeek:2,cycleStart:'2026-11-09',globalWeek:2,dayIdx:0};
  return {render:()=>{cursor=0;return context.WorkoutLogger(props);},saved};
}
const app=mount();
let tree=app.render();
let check=find(tree,n=>n.type==='button'&&n.props['aria-label']==='Marcar exercício feito: Remada');
assert.ok(check,'check é um botão nativo separado');
assert.equal(check.props['aria-pressed'],false);
assert.equal(find(tree,n=>n.type==='button'&&n.props.className==='log-row-btn')?.props['aria-expanded'],true);
const head=find(tree,n=>n.props?.className==='log-head');
assert.deepEqual(head.children.map(child=>child.type),['button','button'],'check e abertura são controlos separados');
check.props.onClick();
tree=app.render();
check=find(tree,n=>n.type==='button'&&n.props['aria-label']==='Desmarcar exercício feito: Remada');
assert.ok(check);
assert.equal(check.props['aria-pressed'],true);
assert.equal(find(tree,n=>n.type==='button'&&n.props.className==='log-row-btn')?.props['aria-expanded'],false,'avança ao próximo exercício');
const save=find(tree,n=>n.type==='button'&&n.props.className?.includes('log-save'));
assert.ok(save,'nova sessão pede guardar explicitamente');
save.props.onClick();
assert.equal(app.saved.length,1);
assert.equal(app.saved[0][0][0].exerciseChecked,true);
assert.equal(app.saved[0][0][0].rir,null,'o check não inventa RIR');
assert.equal(app.saved[0][0][0].repsBySet,'','o check não inventa reps');
check.props.onClick();
tree=app.render();
assert.equal(find(tree,n=>n.type==='button'&&n.props['aria-label']==='Marcar exercício feito: Remada')?.props['aria-pressed'],false);
const legacy=mount({today:{ex:[{exerciseId:x.exerciseId,weight:35,actualRepsBySet:[8,8,8],rir:2}]}});
tree=legacy.render();
check=find(tree,n=>n.type==='button'&&n.props['aria-label']==='Desmarcar exercício feito: Remada');
assert.ok(check,'sessão existente mantém check');
check.props.onClick();
tree=legacy.render();
assert.equal(find(tree,n=>n.type==='button'&&n.props['aria-label']==='Marcar exercício feito: Remada')?.props['aria-pressed'],false);
const future=mount({canSave:false}).render();
assert.equal(find(future,n=>n.type==='button'&&n.props['aria-label']==='Marcar exercício feito: Remada')?.props.disabled,true,'não assinala dias futuros');
// As notas existentes ficam guardadas, mas só ocupam espaço quando abertas.
const noted=mount({exercises:[{...x,notes:'Âncora: apontar a técnica.'},{...x,exerciseId:'exercise-2',name:'Press'}]});
tree=noted.render();
assert.equal(find(tree,n=>n.type==='input'&&n.props.className==='log-note'),null,'nota fechada por defeito');
let noteButton=find(tree,n=>n.type==='button'&&n.props.className==='log-note-toggle has');
assert.ok(noteButton,'nota guardada permanece acessível');
noteButton.props.onClick();
tree=noted.render();
assert.equal(find(tree,n=>n.type==='input'&&n.props.className==='log-note')?.props.value,'Âncora: apontar a técnica.');
find(tree,n=>n.type==='button'&&n.props.className?.includes('log-save')).props.onClick();
assert.equal(noted.saved[0][0][0].notes,'Âncora: apontar a técnica.','guardar não apaga notas ocultas');
console.log('Check independente: assinalar, desmarcar, persistir sem inventar ou apagar séries/RIR.');

// A conversão para o Histórico guarda o check sem o confundir com séries/RIR.
const saveStart=html.indexOf('const saveSession = (entries,cardioEntries=[],sessionMeta={}) => update(s => {');
const saveEnd=html.indexOf('const setPlanEx = ',saveStart);
assert.ok(saveStart>0&&saveEnd>saveStart);
const state={profile:{progressionCycleStart:'2026-11-09'},sessions:[],plano:[{name:'Treino A',ex:[{...x}]}]};
Object.assign(context,{
 update:mutate=>mutate(state),
 loggerExercises:[x],selectedDayKey:'2026-11-12',sel:0,
 cycleWeek:2,globalWeek:2,activeCycleStart:'2026-11-09',firstReturnDay:false,
 parseNum:Number,preferredRirFor:()=>2,
 state,window:{},
});
vm.runInContext(html.slice(saveStart,saveEnd)+'\nthis.saveExerciseSession=saveSession;',context);
context.saveExerciseSession([{weight:'35',exerciseChecked:true,repsBySet:'',rir:null}],[],{});
assert.equal(state.sessions.length,1);
assert.equal(state.sessions[0].ex[0].exerciseChecked,true);
assert.equal(state.sessions[0].ex[0].rir,null);
assert.equal(state.sessions[0].ex[0].actualRepsBySet.length,0);
context.saveExerciseSession([{weight:'35',exerciseChecked:false,repsBySet:'8, 8, 8',rir:2}],[],{});
assert.equal(state.sessions.length,1,'atualizar não cria outra sessão');
assert.equal(state.sessions[0].ex[0].exerciseChecked,false);
assert.equal(state.sessions[0].ex[0].rir,2,'desmarcar conserva o RIR');
assert.deepEqual(Array.from(state.sessions[0].ex[0].actualRepsBySet),[8,8,8],'desmarcar conserva séries');
console.log('Histórico: check isolado das séries e do RIR, atualização sem perda de dados.');
