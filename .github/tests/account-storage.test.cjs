const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const keyStart=source.indexOf('const BASE_KEY =');
const helpersStart=source.indexOf('const OLD_SHARED_KEY =',keyStart);
const helpersEnd=source.indexOf('const SNAP_KEY =',helpersStart);
const saveStart=source.indexOf('const save = (s, uid) => {',helpersEnd);
const saveEnd=source.indexOf('function parseActualRepsBySet',saveStart);
assert.ok(keyStart>0&&helpersStart>keyStart&&helpersEnd>helpersStart&&saveStart>helpersEnd&&saveEnd>saveStart);
function harness(initial={}){
 const map=new Map(Object.entries(initial));
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size;}};
 const context={localStorage:storage,console,snapshotDaily:()=>{},setLocalSaveStatus:()=>{}};
 vm.createContext(context);
 vm.runInContext(source.slice(keyStart,source.indexOf('const clone =',keyStart))+
   source.slice(helpersStart,helpersEnd)+source.slice(saveStart,saveEnd)+
   '\nthis.read=load;this.write=save;',context);
 return {read:context.read,write:context.write,map};
}
const record=(name,at)=>JSON.stringify({_updatedAt:at,profile:{name},sessions:[],body:[],days:{}});
let h=harness({lifeos_v4_u_A:record('A',1),lifeos_v4_device_backup:record('B',2),lifeos_v4_device_backup_owner:'uid:B'});
assert.equal(h.read('A').profile.name,'A','A não lê cópia de B');
assert.equal(JSON.parse(h.map.get('lifeos_v4_u_A')).profile.name,'A','A não é sobrescrita por B');
h=harness({lifeos_v4_u_A:record('A',1),lifeos_v4_device_backup:record('B',2)});
assert.equal(h.read('A').profile.name,'A','backup antigo sem dono não substitui uma conta existente');
h=harness({lifeos_v4_u_A:record('A',1),lifeos_v4_device_backup:record('A recente',2),lifeos_v4_device_backup_owner:'uid:A'});
assert.equal(h.read('A').profile.name,'A recente','backup da mesma conta recupera versão mais recente');
h=harness({lifeos_v4_u_A:record('A',1),lifeos_v4_device_backup:record('A',2),lifeos_v4_device_backup_owner:'uid:A'});
assert.equal(h.read('B'),null,'conta B nova não herda dados de A');
assert.equal(JSON.parse(h.map.get('lifeos_v4_u_A')).profile.name,'A','conta A permanece intacta');
h=harness({lifeos_v4_device_backup:record('A antiga',10),'lifeos_v4_device_backup_uid%3AB':record('B privada',2)});
assert.equal(h.read('B').profile.name,'B privada','backup sem dono não suplanta backup privado de outra identidade');
h=harness({lifeos_v4_device_backup:record('A antiga',10),'lifeos_v4_device_backup_uid%3AA':record('A privada',2)});
assert.equal(h.read('B'),null,'backup privado A impede que B herde cópia partilhada sem dono');
h=harness({lifeos_v4_local:record('offline',4)});
assert.equal(h.read('A').profile.name,'offline','primeira associação sem outras contas conserva dados locais');
h=harness({lifeos_v4_device_backup:record('legacy',3)});
assert.equal(h.read('A').profile.name,'legacy','primeira migração sem dono e sem outras contas é preservada');
h=harness();
assert.equal(h.write({_updatedAt:9,profile:{name:'A'},days:{}},'A'),true);
assert.equal(JSON.parse(h.map.get('lifeos_v4_device_backup_uid%3AA')).profile.name,'A','backup da conta A é privado');
assert.equal(h.write({_updatedAt:10,profile:{name:'B'},days:{}},'B'),true);
assert.equal(h.read('A').profile.name,'A','alternar contas conserva ambas');
assert.equal(h.read('B').profile.name,'B','B conserva os próprios dados');
assert.equal(JSON.parse(h.map.get('lifeos_v4_device_backup_uid%3AB')).profile.name,'B','backup B preservado');
assert.match(source,/React\.createElement\(Dashboard,\s*\{\s*key: user\?\.uid \|\| "local"/,'troca de uid recria estado do Dashboard');
console.log('Contas isoladas: backup com dono, migração inicial preservada e alternância sem mistura.');
