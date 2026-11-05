const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'),'utf8');
const start = html.indexOf('function CoachBlockGuide({state}){');
const end = html.indexOf('function Coach2027({ state, update, onNavigate })',start);
assert.ok(start>0&&end>start,'guia no Coach');
assert.match(html.slice(end),/React\.createElement\(CoachBlockGuide,\{state\}\)/,'guia ligado ao menu Coach');
const context={React:{createElement:(type,props,...children)=>({type,props:props||{},children})},isTravelCycle:start=>start==='2026-11-09'};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
function text(node){
 if(Array.isArray(node))return node.map(text).join(' ');
 if(node==null||node===false)return '';
 if(typeof node!=='object')return String(node);
 return text(node.children);
}
const state={profile:{progressionCycleStart:'2026-11-09',proteinTarget:180},sessions:[{id:'original'}],body:[{date:'2026-10-30',weight:93}]};
const before=JSON.stringify(state);
const tree=context.CoachBlockGuide({state});
assert.equal(tree.type,'details','guia fechado por defeito para não sobrecarregar o Coach');
assert.equal(tree.props.open,undefined);
const copy=text(tree);
for(const phrase of ['Semana 1 · só no bloco 1','Semanas 2–4 · bloco 1','Semanas 5–7 · bloco 1','Semana 8','9–18 nov 2026','19 nov–6 dez','7 dez','18–24 jan 2027','25 jan','SUBIR ×2','DESCER 10%','RIR final','2 600–2 700','2 300','2 100','180 g','7 dias seguintes','≤82 kg','≤15%','decisão explícita','3×30 min','10 000 passos']){
 assert.ok(copy.includes(phrase),`guia explica ${phrase}`);
}
assert.equal(JSON.stringify(state),before,'renderizar o guia não altera dados nem metas');
const inactive=text(context.CoachBlockGuide({state:{profile:{},sessions:[]}}));
assert.ok(inactive.includes('Se ativares o calendário da viagem'),'não afirma que o calendário está ativo sem o estar');
console.log('Coach: guia consultável, completo e sem alterar dados ou metas personalizadas.');
