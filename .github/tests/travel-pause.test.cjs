const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../index.html'), 'utf8');
const start = source.indexOf('// Pausa explícita do bloco de 2026.');
const end = source.indexOf('function trainedOn(state, key)', start);
assert.ok(start > 0 && end > start, 'schedule helpers exist');
const context = {
  iso: d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'),
  addDays: (d, days) => { const next = new Date(d); next.setDate(next.getDate()+days); return next; }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
const { globalProgressionWeekNumber: week, progressionWeekNumber: cycleWeek,
  progressionCycleStartFor: cycleStart, previousProgressionCycleStart: previous } = context;
const travel = '2026-11-10';
for (const [date, expected] of [
  ['2026-11-09',null],['2026-11-10',1],['2026-11-18',1],
  ['2026-11-19',null],['2026-12-04',null],['2026-12-07',null],
  ['2026-12-08',2],['2026-12-14',2],['2026-12-15',3],
  ['2027-01-18',7],['2027-01-19',8],['2027-01-25',8],
  ['2027-01-26',9],['2027-02-01',9],['2027-02-02',10],
  ['2027-03-23',17]
]) assert.equal(week(travel,date),expected, date);
assert.equal(cycleWeek(travel,'2027-01-25'),8);
assert.equal(cycleWeek(travel,'2027-01-26'),1);
assert.equal(cycleStart(travel,'2026-12-07'),null);
assert.equal(cycleStart(travel,'2027-01-25'),travel);
assert.equal(cycleStart(travel,'2027-01-26'),'2027-01-26');
assert.equal(previous(travel,'2027-01-26'),travel);
assert.equal(cycleStart(travel,'2027-03-23'),'2027-03-23');
assert.equal(previous(travel,'2027-03-23'),'2027-01-26');
// Os blocos que não ativaram o calendário da viagem mantêm o cálculo antigo.
assert.equal(week('2026-11-09','2026-11-19'),2);
assert.equal(cycleWeek('2026-11-09','2027-01-04'),1);
console.log('Calendário da pausa: 24 verificações passaram.');

// Regra de progressão real: manutenção e calibração não criam uma sequência
// de "sessões sem progresso" depois da pausa.
Object.assign(context, {
  progressionCategory: () => 'secondary',
  isDecisionExcludedExercise: () => false,
  parseActualRepsBySet: v => Array.isArray(v) ? v : String(v||'').split(/[, /]+/).filter(Boolean).map(Number),
  parseNum: v => Number(v),
  isMachineExercise: () => false,
  progressionLoadStep: () => ({kind:'kg',amount:2.5,unit:'kg'}),
  fmtNum: v => String(v),
  rirLabel: v => String(v)
});
const tipStart = source.indexOf('const progressionTip = (history, exercise, current, sessionDate, cycleWeek, cycleStart, options={}) => {');
const tipEnd = source.indexOf('/* ============================ PROGRESSO CORPO',tipStart);
assert.ok(tipStart > 0 && tipEnd > tipStart);
vm.runInContext(source.slice(tipStart,tipEnd) + '\nthis.tip=progressionTip;',context);
const ex = {name:'DB Row',exerciseId:'test-row',sets:2,reps:6,repsMax:10};
const entry = date => ({date,dayIdx:0,ex:[{...ex,weight:60,rir:2,actualRepsBySet:[8,8]}]});
const current = date => ({date,weight:60,rir:2,repsBySet:[8,8]});
const pause = {...entry('2026-11-25'),maintenance:true};
const opts = {dayIdx:0,globalWeek:2};
const past = [entry('2026-11-18'),pause];
assert.equal(context.tip(past,ex,current('2026-12-08'),'2026-12-08',2,travel,opts).action,'keep');
assert.equal(context.tip([...past,entry('2026-12-08')],ex,current('2026-12-15'),'2026-12-15',3,travel,opts).action,'down10');
assert.equal(context.tip(past,ex,{date:'2026-12-08'},'2026-12-08',2,travel,{...opts,firstReturnDay:true}).action,'skip');
assert.equal(context.tip(past,ex,current('2026-12-08'),'2026-12-08',2,travel,{...opts,firstReturnDay:true}).action,'skip');
assert.equal(context.tip(past,ex,current('2026-11-25'),'2026-11-25',null,travel,opts).action,'skip');
console.log('Progressão: manutenção ignorada, sequência reiniciada e regresso sem recomendação prematura.');

// Registar manutenção não toca em cargas/flags do Plano e usa apenas o Histórico.
const maintenanceStart = source.indexOf('function MaintenanceLogger({state,update,initialDate}){');
const maintenanceEnd = source.indexOf('function WorkoutLogger({',maintenanceStart);
assert.ok(maintenanceStart>0 && maintenanceEnd>maintenanceStart);
Object.assign(context, {
  React:{createElement:(type,props,...children)=>({type,props:props||{},children})},
  useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],
  useEffect:()=>{},
  todayKey:'2026-11-25'
});
vm.runInContext(source.slice(maintenanceStart,maintenanceEnd),context);
const state={sessions:[entry('2026-11-18')],plano:[{ex:[{exerciseId:'test-row',weight:60,techniqueDegraded:false,optionalExtraSetCycleStart:''}]}]};
const before=JSON.stringify(state.plano);
const tree=context.MaintenanceLogger({state,update:mutate=>mutate(state),initialDate:'2026-11-25'});
const find=(node,predicate)=>{
 if(!node||typeof node!=='object')return null;
 if(predicate(node))return node;
 for(const child of node.children||[]){const found=find(child,predicate);if(found)return found;}
 return null;
};
const save=find(tree,node=>node.type==='button'&&node.children.includes('Guardar manutenção'));
assert.ok(save,'botão de guardar manutenção');
save.props.onClick();
assert.equal(JSON.stringify(state.plano),before,'cargas e opções mantidas');
assert.equal(state.sessions.length,2,'histórico original preservado');
assert.equal(state.sessions[1].maintenance,true);
assert.equal(state.sessions[1].cycleWeek,null);
assert.equal(state.sessions[1].ex.length,4);
assert.ok(state.sessions[1].ex.every(ex=>ex.noDecision));
save.props.onClick();
assert.equal(state.sessions.length,2,'guardar novamente atualiza, sem duplicar');
console.log('Manutenção: Histórico isolado e Plano intacto.');
