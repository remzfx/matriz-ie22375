'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const grading=require('../registro-grading.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const c=vm.createContext({});c.window=c;vm.runInContext(read('registro-evaluation.js'),c);const math=c.IERegistroEvaluacion;
test('pure calculation accepts frozen evidence without mutating it',()=>{
 const records=Object.freeze([Object.freeze({nivel:'A'}),Object.freeze({nota20:12}),null]);
 assert.deepEqual(grading.calculated(records,math),{nota:14,letra:'A'});
 assert.deepEqual(grading.calculated(records,math),{nota:14,letra:'A'});
 assert.deepEqual(records,[{nivel:'A'},{nota20:12},null]);
});
test('explicit session context filters without modifying or deduplicating sessions',()=>{
 const context=Object.freeze({nivel:'primaria',grado:3,seccion:'A',bim:'II',area:'Ficticia'});
 const session=Object.freeze({...context,grado:'3',comp:'C1'}),other=Object.freeze({...session,bim:'III'});
 const sessions=Object.freeze([session,session,other]);
 assert.deepEqual(grading.sessionsFor(sessions,context,'C1'),[session,session]);
 assert.deepEqual(grading.sessionsFor(sessions,context,'C2'),[]);
});
test('direct priority and inactive competencies do not inspect calculated evidence',()=>{
 const inaccessible=new Proxy({},{get(){throw Error('Unexpected evidence read');}});
 assert.deepEqual(grading.effective(false,null,inaccessible,null),{nota:'',letra:'',src:''});
 assert.deepEqual(grading.effective(true,{nota:'',letra:'B'},inaccessible,math),{nota:12,letra:'B',src:'P'});
});
test('empty evidence, numeric zero and letter representatives keep their meaning',()=>{
 assert.deepEqual(grading.calculated([],math),{nota:'',letra:''});
 assert.deepEqual(grading.direct({nota20:0},math),{nota:0,letra:'C'});
 for(const [letra,nota]of [['AD',19],['A',15],['B',12],['C',8]])assert.deepEqual(grading.calculated([{nivel:letra}],math),{nota,letra});
});
test('browser module has no ambient DOM, storage, transport or global math dependency',()=>{
 const isolated={};isolated.window=isolated;
 for(const name of ['document','localStorage','sessionStorage','fetch','store','numToLetter'])Object.defineProperty(isolated,name,{get(){throw Error('Forbidden ambient access: '+name);}});
 vm.runInNewContext(read('registro-grading.js'),isolated);
 const api=isolated.IERegistroGrading;
 assert.deepEqual(Object.keys(api),Object.keys(grading));
 assert.equal(api.calculated([{nota20:15}],math).letra,'A');
 assert.equal(api.direct({nivel:'B'},math).letra,'B');
});
