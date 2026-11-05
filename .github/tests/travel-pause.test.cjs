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
vm.runInContext(source.slice(start, end) + '\nthis.inBlock2Maintenance=inBlock2Maintenance;this.inBlock2Deficit=inBlock2Deficit;this.travelWeightCheckpoint=travelWeightCheckpoint;', context);
const { globalProgressionWeekNumber: week, progressionWeekNumber: cycleWeek,
  progressionCycleStartFor: cycleStart, previousProgressionCycleStart: previous } = context;
const travel = '2026-11-09';
for (const [date, expected] of [
  ['2026-11-08',null],['2026-11-09',1],['2026-11-18',1],
  ['2026-11-19',null],['2026-12-04',null],['2026-12-06',null],
  ['2026-12-07',2],['2026-12-13',2],['2026-12-14',3],
  ['2027-01-17',7],['2027-01-18',8],['2027-01-24',8],
  ['2027-01-25',9],['2027-01-31',9],['2027-02-01',10],
  ['2027-03-22',17]
]) assert.equal(week(travel,date),expected, date);
assert.equal(cycleWeek(travel,'2027-01-24'),8);
assert.equal(cycleWeek(travel,'2027-01-25'),2);
assert.equal(cycleStart(travel,'2026-12-06'),null);
assert.equal(cycleStart(travel,'2027-01-24'),travel);
assert.equal(cycleStart(travel,'2027-01-25'),'2027-01-25');
assert.equal(previous(travel,'2027-01-25'),travel);
assert.equal(cycleStart(travel,'2027-03-22'),'2027-03-22');
assert.equal(previous(travel,'2027-03-22'),'2027-01-25');
// Os blocos que não ativaram o calendário da viagem mantêm o cálculo antigo.
assert.equal(week('2026-11-16','2026-11-19'),1);
assert.equal(cycleWeek('2026-11-16','2027-01-11'),1);
console.log('Calendário da pausa e bloco 2 validado.');

// Regra de progressão real: manutenção e calibração não criam uma sequência
// de "sessões sem progresso" depois da pausa.
Object.assign(context, {
  progressionCategory: x => x.anchor ? 'anchor' : 'secondary',
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
assert.equal(context.tip(past,ex,current('2026-12-07'),'2026-12-07',2,travel,opts).action,'keep');
assert.equal(context.tip([...past,entry('2026-12-07')],ex,current('2026-12-14'),'2026-12-14',3,travel,opts).action,'down10');
assert.equal(context.tip(past,ex,{date:'2026-12-07'},'2026-12-07',2,travel,{...opts,firstReturnDay:true}).action,'skip');
assert.equal(context.tip(past,ex,current('2026-12-07'),'2026-12-07',2,travel,{...opts,firstReturnDay:true}).action,'skip');
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

// O bloco 2 não repete a calibração: linear em 9–11, dupla em 12–15, deload em 16.
for(const [date,phase] of [
 ['2027-01-25',2],['2027-02-01',3],['2027-02-08',4],
 ['2027-02-15',5],['2027-02-22',6],['2027-03-01',7],
 ['2027-03-08',7],['2027-03-15',8],['2027-03-21',8],['2027-03-22',2]
])assert.equal(cycleWeek(travel,date),phase, date);
assert.equal(context.inBlock2Maintenance(travel,'2027-01-24'),false);
assert.equal(context.inBlock2Maintenance(travel,'2027-01-25'),true);
assert.equal(context.inBlock2Maintenance(travel,'2027-02-07'),true);
assert.equal(context.inBlock2Maintenance(travel,'2027-02-08'),false);
assert.equal(context.inBlock2Deficit(travel,'2027-02-08'),true);
const anchor=(exerciseId,weight)=>({exerciseId,sets:2,weight,rir:2,actualRepsBySet:[8,8]});
const plan={profile:{progressionCycleStart:travel},plano:[{ex:['a','b','c'].map(exerciseId=>({exerciseId,anchor:true,name:'Barbell Bench Press'}))}],sessions:[
 {date:'2026-11-09',dayIdx:0,durationMinutes:50,painFlag:false,ex:['a','b','c'].map(id=>anchor(id,50))},
 {date:'2027-01-11',dayIdx:0,durationMinutes:55,painFlag:false,ex:['a','b','c'].map(id=>anchor(id,55))}
]};
assert.equal(context.block1ExtraSetEligibility(plan).eligible,true);
const missingDuration=structuredClone(plan);delete missingDuration.sessions[0].durationMinutes;
assert.equal(context.block1ExtraSetEligibility(missingDuration).eligible,false);
const withPain=structuredClone(plan);withPain.sessions[0].ex[0].painFlag=true;
assert.equal(context.block1ExtraSetEligibility(withPain).eligible,false);
const noProgress=structuredClone(plan);noProgress.sessions[1].ex[0].weight=50;
assert.equal(context.block1ExtraSetEligibility(noProgress).eligible,false);
const optionalStart=source.indexOf('const OPTIONAL_EXTRA_SET_IDS=');
const optionalEnd=source.indexOf('function defaultProgressionStep(',optionalStart);
assert.ok(optionalStart>0&&optionalEnd>optionalStart);
vm.runInContext(source.slice(optionalStart,optionalEnd),context);
const row={exerciseId:'v5-mon-row',sets:3};
assert.equal(context.effectiveSetCount(row,2,'2027-01-25',{globalWeek:9,exerciseIndex:1,block2Extra:false}),3);
assert.equal(context.effectiveSetCount(row,2,'2027-01-25',{globalWeek:9,exerciseIndex:1,block2Extra:true}),4);
assert.equal(context.effectiveSetCount(row,7,'2027-01-25',{globalWeek:15,exerciseIndex:2,block2Extra:true}),4);
assert.equal(context.effectiveSetCount(row,8,'2027-01-25',{globalWeek:16,exerciseIndex:1,block2Extra:true}),2);
assert.equal(context.effectiveSetCount(row,7,'2027-01-25',{globalWeek:15,exerciseIndex:0,block2Extra:true}),3);
assert.equal(context.tip([], {...ex,anchor:true}, current('2027-01-25'),'2027-01-25',2,travel,{dayIdx:0,globalWeek:9}).action,'linear-up');
assert.equal(context.tip([], {...ex,anchor:true}, current('2027-01-25'),'2027-01-25',2,travel,{dayIdx:0,globalWeek:9,block2Start:true}).action,'skip');
const pulldown={name:'Lat Pulldown',exerciseId:'pulldown',sets:4,reps:5,repsMax:8};
assert.equal(context.tip([],pulldown,{date:'2027-02-15',weight:80,rir:2,repsBySet:[8,8,8,8]},'2027-02-15',5,travel,{dayIdx:2,globalWeek:12}).action,'proposal');
const review={profile:{progressionCycleStart:travel},plano:[{ex:[{exerciseId:'bench',name:'Barbell Bench Press'}]}],sessions:[
 ...['2027-01-25','2027-02-01','2027-02-08','2027-02-15'].map(date=>({date,ex:[{...anchor('bench',60),actualRepsBySet:[8,8]}]}))
]};
assert.equal(context.week17ReviewItems(review)[0].name,'Barbell Bench Press');
assert.match(context.week17ReviewItems(review)[0].alternative,/halteres neutros/);
console.log('Bloco 2: elegibilidade, fases, RIR, séries, deload, elevações e revisão validados.');

// Reiniciar apenas preferências de progressão no início real do bloco 2.
const resetState={profile:{progressionCycleStart:travel,block2ExtraSetEnabled:true},
  plano:[{ex:[{exerciseId:'bench',weight:67.5,techniqueDegraded:true,optionalExtraSetCycleStart:travel}]}],
  sessions:[entry('2026-11-09')],body:[{date:'2026-10-30',weight:94}]};
const stored=JSON.stringify({sessions:resetState.sessions,body:resetState.body});
assert.equal(context.resetSecondBlockPreferences(resetState),true);
assert.equal(resetState.profile.block2ExtraSetEnabled,false);
assert.equal(resetState.plano[0].ex[0].techniqueDegraded,false);
assert.equal(resetState.plano[0].ex[0].optionalExtraSetCycleStart,'');
assert.equal(resetState.plano[0].ex[0].weight,67.5);
assert.equal(JSON.stringify({sessions:resetState.sessions,body:resetState.body}),stored);
resetState.plano[0].ex[0].techniqueDegraded=true;
assert.equal(context.resetSecondBlockPreferences(resetState),false,'não apaga escolhas feitas depois do reset');
assert.equal(resetState.plano[0].ex[0].techniqueDegraded,true);
console.log('Reset do bloco 2: flags limpas uma vez, cargas e registos intactos.');

const painReview=structuredClone(review);
painReview.sessions=[{date:'2027-03-15',ex:[{...anchor('bench',60),painFlag:true}]}];
assert.match(context.week17ReviewItems(painReview)[0].reason,/dor/);
assert.equal(context.tip([],pulldown,{date:'2027-03-22',weight:80,rir:2,repsBySet:[8,8,8,8]},'2027-03-22',1,travel,{dayIdx:2,globalWeek:17,reviewWeek:true}).action,'proposal');
assert.equal(context.tip([],pulldown,{date:'2027-03-15',weight:80,rir:2,repsBySet:[8,8,8,8]},'2027-03-15',8,travel,{dayIdx:2,globalWeek:16}).action,'proposal');
console.log('Semana 17: dor sinalizada e proposta de elevações sem substituição automática.');

const opted={profile:{progressionCycleStart:travel,block2ExtraSetEnabled:true,block2ExtraSetEnabledAt:'2027-01-27'},sessions:[
 {date:'2027-01-27',dayIdx:0,ex:[{exerciseId:'v5-mon-row',sets:3}]},
 {date:'2027-01-28',dayIdx:0,ex:[{exerciseId:'v5-mon-row',sets:4}]}
]};
assert.equal(context.shouldUseBlock2Extra(opted,'2027-01-26',0,row),false);
assert.equal(context.shouldUseBlock2Extra(opted,'2027-01-27',0,row),false,'sessão antiga mantém 3 séries');
assert.equal(context.shouldUseBlock2Extra(opted,'2027-01-28',0,row),true,'sessão já guardada com +1 mantém 4 séries');
assert.equal(context.shouldUseBlock2Extra(opted,'2027-02-01',0,row),true,'sessão nova após consentimento');
console.log('Série extra: opt-in sem alteração retroativa das sessões guardadas.');

// Blocos 3+ seguem sem semana de calibração global. A revisão não rouba a primeira semana.
for (const [date,global,phase,nutrition] of [
 ['2027-03-22',17,2,'maintenance'],['2027-03-29',18,3,'maintenance'],
 ['2027-04-05',19,4,'deficit'],['2027-04-12',20,5,'deficit'],
 ['2027-04-19',21,6,'deficit'],['2027-04-26',22,7,'deficit'],
 ['2027-05-03',23,7,'deficit'],['2027-05-10',24,8,'deficit'],
 ['2027-05-17',25,2,'maintenance'],['2027-05-31',27,4,'deficit']
]) {
 assert.equal(week(travel,date),global,date);
 assert.equal(cycleWeek(travel,date),phase,date);
 assert.equal(context.nutritionPhase({profile:{progressionCycleStart:travel},body:[]},date),nutrition,date);
}
assert.equal(context.nutritionPhase({profile:{progressionCycleStart:travel},body:[]},'2027-01-24'),null);
assert.equal(context.tip([], {...ex,anchor:true},current('2027-03-22'),'2027-03-22',2,travel,{dayIdx:0,globalWeek:17,reviewWeek:true}).action,'linear-up','a revisão não bloqueia a regra linear');
assert.equal(context.tip([], {...ex,anchor:true},current('2027-04-05'),'2027-04-05',4,travel,{dayIdx:0,globalWeek:19}).action,'linear-up','a semana 3 do bloco continua linear');
assert.equal(context.effectiveSetCount(row,5,'2027-03-22',{globalWeek:19,exerciseIndex:1,block2Extra:true}),4);
assert.equal(context.effectiveSetCount(row,2,'2027-03-22',{globalWeek:17,exerciseIndex:1,block2Extra:true}),4);
assert.equal(context.effectiveSetCount(row,8,'2027-03-22',{globalWeek:24,exerciseIndex:1,block2Extra:true}),2);
const futureReset=structuredClone(resetState);
futureReset.profile.lastResetCycleStart='2027-01-25';
futureReset.profile.block2ExtraSetEnabled=true;
futureReset.plano[0].ex[0].techniqueDegraded=true;
const dataBefore=JSON.stringify({sessions:futureReset.sessions,body:futureReset.body});
assert.equal(context.resetNextBlockPreferences(futureReset,'2027-03-22'),true);
assert.equal(context.resetNextBlockPreferences(futureReset,'2027-03-22'),false);
assert.equal(futureReset.profile.block2ExtraSetEnabled,false);
assert.equal(futureReset.plano[0].ex[0].techniqueDegraded,false);
assert.equal(JSON.stringify({sessions:futureReset.sessions,body:futureReset.body}),dataBefore);
console.log('Blocos seguintes: três lineares, quatro duplas, deload, reset e alimentação cíclica.');

// Só medições reais completas disparam a manutenção longa; mantém-se após o deload.
const lowWeights=Array.from({length:7},(_,i)=>({date:`2027-04-${String(i+5).padStart(2,'0')}`,weight:81.9}));
const lowState={profile:{progressionCycleStart:travel},body:lowWeights};
assert.equal(context.longMaintenanceThreshold(lowWeights.slice(0,6)),null,'seis pesagens não bastam');
assert.equal(context.longMaintenanceThreshold([...lowWeights.slice(0,6),{date:'2027-04-12',weight:81.9}]),null,'sem um dos dias também não basta');
assert.equal(context.longMaintenanceThreshold(lowWeights).date,'2027-04-11');
assert.equal(context.nutritionPhase(lowState,'2027-04-10'),'deficit');
assert.equal(context.nutritionPhase(lowState,'2027-04-11'),'longMaintenance');
assert.equal(context.nutritionPhase(lowState,'2027-05-17'),'longMaintenance');
assert.equal(context.longMaintenanceThreshold([{date:'2027-02-28',bodyFat:14.9},{date:'2027-03-07',bodyFat:14.9}]),null,'gordura sem pesagem não chega');
const twoFat=[{date:'2027-02-28',weight:87,bodyFat:15},{date:'2027-03-07',weight:86,bodyFat:14.8}];
assert.equal(context.longMaintenanceThreshold(twoFat).date,'2027-03-07');
assert.equal(context.longMaintenanceThreshold([{...twoFat[0],bodyFat:16},twoFat[1]]),null);
assert.equal(context.nutritionPhase({profile:{progressionCycleStart:travel,longMaintenanceSince:'2027-03-07'},body:[]},'2027-04-05'),'longMaintenance','paragem confirmada não volta ao défice');
console.log('Paragem do défice: sete dias reais ou duas pesagens consecutivas ≤15%.');

// Revisão repetida, com alternativa escolhida pelo utilizador e histórico intocado.
Object.assign(context,{isAnchorExerciseName:()=>false,defaultProgressionStep:()=>({amount:2,kind:'kg',unit:'kg/mão'})});
const nextReview={profile:{progressionCycleStart:travel},plano:[{ex:[{exerciseId:'bench',name:'Barbell Bench Press',sets:3,weight:65,techniqueDegraded:false}]}],sessions:
 ['2027-03-22','2027-03-29','2027-04-05','2027-04-12'].map(date=>({date,ex:[{...anchor('bench',65),actualRepsBySet:[8,8]}]}))};
const item=context.blockReviewItems(nextReview,25)[0];
assert.equal(item.exerciseId,'bench');
assert.equal(item.dayIdx,0);
const original=JSON.stringify(nextReview.sessions);
assert.equal(context.acceptReviewSwap(nextReview,item,'2027-05-17','Supino com halteres neutros',1),true);
assert.equal(nextReview.plano[0].ex[0].weight,0,'carga nova não inventada');
assert.equal(nextReview.plano[0].ex[0].calibrationPending,true);
assert.equal(nextReview.profile.blockReviewPrevious[nextReview.plano[0].ex[0].exerciseId].weight,65);
assert.equal(JSON.stringify(nextReview.sessions),original);
assert.equal(context.tip([],{...ex,exerciseId:nextReview.plano[0].ex[0].exerciseId},current('2027-05-17'),'2027-05-17',2,travel,{exerciseCalibration:true}).action,'skip');
console.log('Revisão de cada bloco: decisão explícita, troca preservada e calibração só do novo exercício.');
// A normalização não pode reconstruir por engano o Plano depois de uma troca aceite.
const normPart=source.slice(source.indexOf(' const planNameKey=name=>',source.indexOf('function normalize(s)')),source.indexOf(' if (!Array.isArray(s.plano) || !s.plano.length)',source.indexOf('function normalize(s)')));
vm.runInContext('this.planIsCurrent=(s,PLAN)=>{'+normPart+'return planStructureIsCurrent();}',context);
nextReview.plano[0].day="Segunda";
const copiedOriginal=nextReview.profile.blockReviewPrevious[nextReview.plano[0].ex[0].exerciseId];
assert.equal(context.planIsCurrent(nextReview,[{day:'Segunda',ex:[{exerciseId:copiedOriginal.exerciseId,name:copiedOriginal.name}]}]),true,'troca aceite preservada ao normalizar');
const noProof=structuredClone(nextReview);noProof.profile.blockReviewPrevious={};
assert.equal(context.planIsCurrent(noProof,[{day:'Segunda',ex:[{exerciseId:copiedOriginal.exerciseId,name:copiedOriginal.name}]}]),false,'sem decisão a reparação do Plano continua ativa');
console.log('Normalização: troca aceite não é restaurada ao exercício original.');
// Uma sequência de DESCER do bloco anterior não contamina a primeira semana linear nova.
const priorBlockFailures=[{date:'2027-03-01',dayIdx:0,ex:[{...ex,rir:2,weight:60,actualRepsBySet:[5,5]}]},{date:'2027-03-08',dayIdx:0,ex:[{...ex,rir:2,weight:60,actualRepsBySet:[5,5]}]}];
assert.equal(context.tip(priorBlockFailures,ex,{date:'2027-03-22',weight:60,rir:2,repsBySet:[5,5]},'2027-03-22',2,travel,{dayIdx:0,globalWeek:17}).action,'down5');
console.log('Estagnação: contadores reiniciados no arranque de cada bloco.');

// Calendário corrigido: cada deload termina domingo e o bloco seguinte abre segunda.
for(const [end,next,number] of [
 ['2027-01-24','2027-01-25',9],['2027-03-21','2027-03-22',17],
 ['2027-05-16','2027-05-17',25],['2027-07-11','2027-07-12',33]
]){
 assert.equal(context.isBlockCheckpointDate(travel,end),true,end);
 assert.equal(week(travel,next),number,next);
 assert.equal(cycleWeek(travel,next),2,'primeira semana do bloco é linear');
 assert.equal(cycleStart(travel,next),next);
 assert.equal(context.nutritionPhase({profile:{progressionCycleStart:travel},body:[]},next),'maintenance');
}
assert.equal(context.isBlockCheckpointDate(travel,'2027-03-20'),false);
assert.equal(context.isBlockCheckpointDate('2026-11-16','2027-03-21'),false);
assert.equal(cycleWeek(travel,'2027-07-26'),4,'a terceira semana é linear');
assert.equal(cycleWeek(travel,'2027-08-02'),5,'a quarta semana é dupla');
console.log('Transição automática: blocos 2–5 nas datas combinadas, check-in a cada deload.');

const pulldownEntry={name:'Lat Pulldown',exerciseId:'v5-wed-pulldown',sets:4,weight:80,rir:2,actualRepsBySet:[8,8,8,8]};
const pullState={profile:{progressionCycleStart:travel},sessions:[{date:'2027-03-08',dayIdx:2,ex:[pulldownEntry]}]};
assert.equal(context.pulldownMilestoneReached(pullState,17),true);
assert.equal(context.pulldownMilestoneReached(pullState,25),false,'marco de outro bloco não transita');
const pullCut=structuredClone(pullState);pullCut.sessions[0].ex[0].cutForTime=true;
assert.equal(context.pulldownMilestoneReached(pullCut,17),false);
const pullNotAll=structuredClone(pullState);pullNotAll.sessions[0].ex[0].actualRepsBySet=[8,8,8,7];
assert.equal(context.pulldownMilestoneReached(pullNotAll,17),false);
console.log('Lat Pulldown: proposta de elevações apenas após 80 kg × 8 em todas as séries válidas.');

const orderedLoads=[{date:'2027-05-03',ex:[{...anchor('bench',70),cutForTime:true}]},
 {date:'2027-04-26',ex:[anchor('bench',65)]},
 {date:'2027-04-19',ex:[anchor('bench',60)]},
 {date:'2027-05-06',maintenance:true,ex:[anchor('bench',100)]}];
assert.equal(context.lastValidBlockExercise(orderedLoads,'bench').weight,65,'sem semana 7 válida: última válida antes do deload');
orderedLoads[0].ex[0].cutForTime=false;
assert.equal(context.lastValidBlockExercise(orderedLoads,'bench').weight,70,'semana 7 válida prevalece');
orderedLoads[0].ex[0].actualRepsBySet=[];
assert.equal(context.lastValidBlockExercise(orderedLoads,'bench').weight,65,'semana 7 incompleta não vira carga de partida');
console.log('Cargas: semana 7 válida, senão sessão válida anterior; manutenção isolada.');

const sleepReview={profile:{progressionCycleStart:travel},plano:[{ex:[{exerciseId:'bench',name:'Barbell Bench Press'}]}],sessions:
 ['2027-03-22','2027-03-29','2027-04-05','2027-04-12','2027-05-03'].map((date,i)=>({date,sleepRecoveryMode:i===4,ex:[anchor('bench',65)]}))};
assert.equal(context.blockReviewItems(sleepReview,25).length,0,'sono baixo quebra série de estagnação e não gera troca');
sleepReview.sessions[4].ex[0].painFlag=true;
assert.match(context.blockReviewItems(sleepReview,25)[0].reason,/dor/,'dor continua a gerar revisão mesmo com sono baixo');
console.log('Revisão: sem propostas por estagnação com sono baixo; dor continua visível.');
const twoSparse={...review,sessions:[review.sessions[0],review.sessions[3]]};
assert.equal(context.blockReviewItems(twoSparse,17).length,0,'duas sessões isoladas não provam estagnação durante 3 semanas');
const afterReset=structuredClone(opted);
afterReset.profile.block2ExtraSetEnabled=false;
assert.equal(context.shouldUseBlock2Extra(afterReset,'2027-01-28',0,row),true,'editar treino antigo após reset mantém as quatro séries');
assert.equal(context.shouldUseBlock2Extra(afterReset,'2027-02-01',0,row),false,'o novo bloco não herda o opt-in');
console.log('Histórico: séries anteriores preservadas após reset; revisão exige pelo menos três sessões válidas.');

// Calendário real seg–dom; semana 1 estendida só até qua 18 antes da pausa.
for(const [first,last,number] of [
 ['2026-11-09','2026-11-15',1],['2026-12-07','2026-12-13',2],
 ['2026-12-14','2026-12-20',3],['2027-01-11','2027-01-17',7],
 ['2027-01-18','2027-01-24',8],['2027-01-25','2027-01-31',9],
 ['2027-03-15','2027-03-21',16],['2027-03-22','2027-03-28',17],
 ['2027-05-10','2027-05-16',24],['2027-05-17','2027-05-23',25],
 ['2027-07-05','2027-07-11',32],['2027-07-12','2027-07-18',33]
]){
 assert.equal(new Date(first+'T12:00:00Z').getUTCDay(),1,first+' é segunda');
 assert.equal(new Date(last+'T12:00:00Z').getUTCDay(),0,last+' é domingo');
 assert.equal(week(travel,first),number,first);
 assert.equal(week(travel,last),number,last);
}
for(const date of ['2026-11-16','2026-11-17','2026-11-18']) assert.equal(cycleWeek(travel,date),1,date+' ainda é calibração');
for(const date of ['2026-11-19','2026-12-04','2026-12-06']) assert.equal(week(travel,date),null,date+' ainda é pausa');
assert.equal(context.inBlock2Maintenance(travel,'2027-01-25'),true);
assert.equal(context.inBlock2Maintenance(travel,'2027-02-07'),true);
assert.equal(context.inBlock2Deficit(travel,'2027-02-08'),true);
assert.equal(context.travelWeightCheckpoint(travel,'2026-12-20'),'91–92 kg');
assert.equal(context.travelWeightCheckpoint(travel,'2027-01-10'),'89,5–90,5 kg');
assert.equal(context.travelWeightCheckpoint(travel,'2027-01-24'),'88,5–89,5 kg');
assert.equal(context.travelWeightCheckpoint('2026-11-16','2027-01-24'),null);
console.log('Calendário corrigido: semanas seg–dom, pausa, manutenção e checkpoints certos.');

// Quem já ativou 10 nov mantém as datas reais das sessões e medidas.
const migrationStart=source.indexOf('function migrateTravelCalendarProfile(');
const migrationEnd=source.indexOf('function normalize(s)',migrationStart);
assert.ok(migrationStart>0&&migrationEnd>migrationStart);
vm.runInContext(source.slice(migrationStart,migrationEnd),context);
const legacy={profile:{progressionCycleStart:'2026-11-10',lastResetCycleStart:'2027-01-26',blockExtraSetCycleStart:'2027-01-26',progressionWeek7Loads:{'2026-11-10':{bench:{weight:70}}}},
 sessions:[{date:'2026-11-10',dayIdx:1,ex:[anchor('bench',50)]},{date:'2026-12-07',maintenance:true,ex:[anchor('bench',35)]}],body:[{date:'2026-10-30',weight:94}]};
const oldData=JSON.stringify({sessions:legacy.sessions,body:legacy.body});
assert.equal(context.migrateTravelCalendarProfile(legacy.profile),true);
assert.equal(legacy.profile.progressionCycleStart,travel);
assert.equal(legacy.profile.progressionWeek7Loads[travel].bench.weight,70);
assert.equal(legacy.profile.progressionWeek7Loads['2026-11-10'].bench.weight,70,'chave antiga preservada');
assert.equal(legacy.profile.lastResetCycleStart,'2027-01-25');
assert.equal(legacy.profile.blockExtraSetCycleStart,'2027-01-25');
assert.equal(JSON.stringify({sessions:legacy.sessions,body:legacy.body}),oldData,'datas e dados reais intactos');
assert.equal(legacy.sessions[1].maintenance,true,'manutenção antiga de 7 dez continua isolada no Histórico');
assert.equal(context.migrateTravelCalendarProfile(legacy.profile),false,'migração única');
console.log('Migração automática: início antigo corrigido sem deslocar registos.');
