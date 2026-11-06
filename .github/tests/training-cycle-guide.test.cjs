const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('function TrainingCycleGuide(){');
const end=html.indexOf('function PlanDayCard({',start);
assert(start>0&&end>start);
const ctx={React:{createElement:(type,props,...children)=>({type,props:props||{},children})}};
vm.createContext(ctx);
vm.runInContext(html.slice(start,end)+'\nthis.render=TrainingCycleGuide;',ctx);
const guide=ctx.render();
const nodes=(node,match)=>{
 if(Array.isArray(node))return node.flatMap(child=>nodes(child,match));
 if(!node||typeof node!=='object')return [];
 return (match(node)?[node]:[]).concat(nodes(node.children,match));
};
const text=node=>{
 if(Array.isArray(node))return node.map(text).join(' ');
 if(node==null||typeof node==='boolean')return '';
 return typeof node==='object'?text(node.children):String(node);
};
const copy=text(guide);
assert.equal(guide.type,'section');
assert.equal(nodes(guide,n=>n.type==='ol').length,1,'começa com os três passos de registo e leitura');
assert.equal(nodes(guide,n=>n.props.className==='training-cycle-stage').length,4,'quatro fases do bloco');
assert.equal(nodes(guide,n=>n.props.className==='training-cycle-outcome').length,4,'quatro resultados possíveis');
const details=nodes(guide,n=>n.type==='details');
assert.equal(details.length,7,'regras completas separadas por assunto');
assert(details.every(n=>n.props.open===undefined),'regras extensas ficam fechadas por defeito');
for(const expected of [
 'reps de cada série','RIR da última','junto do exercício','não altera o Plano',
 'Só no bloco 1','1–3','4–7','Semana 8',
 'SUBIR ×2','qualquer série ultrapassar','DESCER 5%','DESCER 10%',
 'RIR ≥4','≥3 no secundário','≥2 no isolamento','Técnica degradada','incrementos',
 '19 nov–6 dez','7 dez','18–24 jan','25 jan','22 mar','17 mai','12 jul',
 '14 dias','corte','dor','3×30 min','10 000 passos','2 600–2 700','2 300','2 100',
])assert(copy.includes(expected),`a regra «${expected}» mantém-se disponível`);
console.log('Guia de progressão: resumo, fases, decisões e exceções consultáveis sem perder regras.');
