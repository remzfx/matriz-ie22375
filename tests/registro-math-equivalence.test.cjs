// Synthetic, pure equivalence checks; no storage or external network.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const old=execFileSync('git',['show','7df796b:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function fn(source,name){const m=new RegExp('^\\s*(?:async )?function '+name+'\\(','m').exec(source);assert.ok(m,name);const start=source.indexOf('function '+name+'(',m.index),line=source.slice(start,source.indexOf('\n',start));if(line.trimEnd().endsWith('}'))return line;const indent=source.slice(source.lastIndexOf('\n',start)+1,start);return source.slice(start,source.indexOf('\n'+indent+'}',start)+indent.length+2);}
function setup(){const c=vm.createContext({});c.window=c;vm.runInContext(read('registro-evaluation.js'),c);return c;}
const current=setup(),original=setup();for(const name of ['numToLetter','letterToNum','promedioNums']){vm.runInContext(fn(read('registro.html'),name),current);vm.runInContext(fn(old,name),original);}

test('numeric conversion is equivalent at every eighth-point boundary and for empty/invalid historical scalars',()=>{
 const values=[undefined,null,'',' ',NaN,Infinity,-Infinity,false,true,[],{},'abc','14','17.999','20.01','0x10',-0];
 for(let eighth=-16;eighth<=176;eighth++)values.push(eighth/8);
 for(const value of values){const expected=original.numToLetter(value);assert.equal(current.IERegistroEvaluacion.numToLetter(value),expected);assert.equal(current.numToLetter(value),expected);}
 assert.equal(current.numToLetter(0),'C');assert.equal(current.numToLetter(10.999),'C');assert.equal(current.numToLetter(11),'B');assert.equal(current.numToLetter(14),'A');assert.equal(current.numToLetter(18),'AD');assert.equal(current.numToLetter(20),'AD');
});

test('letter representatives preserve exact mappings, invalid input and absence',()=>{
 for(const value of ['AD','A','B','C','a',' AD ','',null,undefined,'X',0,{},[]]){
  const expected=original.letterToNum(value);assert.equal(current.IERegistroEvaluacion.letterToNum(value),expected);assert.equal(current.letterToNum(value),expected);
 }
 assert.deepEqual(['AD','A','B','C'].map(x=>current.letterToNum(x)),[19,15,12,8]);
});

test('averages preserve empty null, zero, missing entries, rounding and input immutability',()=>{
 const cases=[[],['',null,undefined,NaN,'abc'],[0],[0,'',null],[13,14],[14,15],[8,15,19],[12,12,18],[Infinity],[-Infinity,Infinity],[-0.5],[1,,3]];
 let seed=17;for(let i=0;i<100;i++){const values=[];for(let j=0;j<i%17;j++){seed=(seed*16807)%2147483647;values.push(j%5===0?'':j%7===0?null:(seed%201)/10);}cases.push(values);}
 for(const values of cases){const copy=values.slice(),expected=original.promedioNums(values);assert.equal(current.IERegistroEvaluacion.promedioNums(values),expected);assert.equal(current.promedioNums(values),expected);assert.deepEqual(values,copy);}
 assert.equal(current.promedioNums([]),null);assert.equal(current.promedioNums([0]),0);
 assert.equal(current.promedioNums([0,20,20]),13,'all individual evidence retains its own weight');
});

test('matrices have different out-of-range conversion contracts and are deliberately not consolidated',()=>{
 for(const file of ['primaria.html','secundaria.html']){
  const c=vm.createContext({});vm.runInContext(fn(read(file),'numToLetterMat'),c);
  assert.equal(c.numToLetterMat(21),'AD');assert.equal(original.numToLetter(21),'');
  assert.equal(c.numToLetterMat(-1),'C');assert.equal(original.numToLetter(-1),'');
 }
});

test('numeric entry rounding differs from direct conversion and remains a separate operation',()=>{
 assert.equal(current.numToLetter(13.5),'B');assert.equal(current.IERegistroEvaluacion.valor({modo:'num',valor:13.5}).nivel,'A');
 assert.equal(current.IERegistroEvaluacion.valor({modo:'num',valor:''}),null);
});

test('all three global helpers delegate to the existing evaluation instance without a parallel calculation',()=>{
 const c=setup();for(const name of ['numToLetter','letterToNum','promedioNums'])vm.runInContext(fn(read('registro.html'),name),c);
 for(const [name,input]of [['numToLetter',14],['letterToNum','A'],['promedioNums',[0,20,20]]]){
  let calls=0;const marker={synthetic:true};c.IERegistroEvaluacion[name]=value=>{assert.equal(value,input);calls++;return marker;};
  assert.equal(c[name](input),marker);assert.equal(calls,1);
 }
});

test('historical comparison resolves delegated helpers equally on LF and Windows CRLF',()=>{
 const {historicalContent}=require('./registro-script-fixture.cjs'),source=read('registro.html');
 assert.equal(historicalContent(source.replace(/\n/g,'\r\n')),historicalContent(source));
});

test('absence validation and curricular conclusion rules remain distinct from pure numeric conversion',()=>{
 const c=setup();vm.runInContext(read('registro-academic-model.js'),c);
 assert.equal(c.IERegistroEvaluacion.numToLetter(''),'C','legacy scalar conversion is unchanged');
 assert.equal(c.IERegistroEvaluacion.valor({modo:'num',valor:''}),null,'empty entry still is not a grade');
 assert.equal(c.IERegistroAcademico.requiresConclusion('primaria','B'),true);
 assert.equal(c.IERegistroAcademico.requiresConclusion('secundaria','B'),false);
 for(const level of ['primaria','secundaria'])assert.equal(c.IERegistroAcademico.requiresConclusion(level,'C'),true);
});

test('session calculation and transversal results differ on malformed historical evidence; neither is rewritten',()=>{
 const c=setup(),ctx={nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Área ficticia'},s={...ctx,comp:'tic',capacidad:'Capacidad ficticia',fecha:'2026-10-12'};
 Object.assign(c,{ctxBase:()=>ctx,identidadAlumno:x=>x,leerNota:(map,key)=>map[key],store:{sessions:[s],grades:{}}});
 for(const name of ['numToLetter','letterToNum','promedioNums','notaDesdeSesiones'])vm.runInContext(fn(old,name),c);
 const key=[ctx.nivel,ctx.bim,ctx.grado,ctx.seccion,ctx.area,s.comp,s.capacidad,s.fecha,'synthetic'].join('||'),grade={nota20:'ilegible',nivel:'A'};
 c.store.grades[key]=grade;const evidence={sessions:[s],grades:{[c.IERegistroEvaluacion.sessionKey(s)]:{synthetic:grade}}};
 assert.equal(c.notaDesdeSesiones('tic','synthetic').letra,'A');
 assert.equal(c.IERegistroEvaluacion.resultados(evidence,['synthetic']).valores.synthetic.tic,undefined);
});

test('priority, evidence weighting, direct notes and referential calculation functions remain unchanged',()=>{
 for(const name of ['notaDesdeSesiones','notaDirectaAlumno','notaCompAlumno','promGeneralAlumno','promReferencialAlumno'])assert.equal(fn(read('registro.html'),name),fn(old,name),name);
 const c=setup();Object.assign(c,{competenciaTrabajada:()=>true,notaDirectaAlumno:()=>({nota:12,letra:'B'}),notaDesdeSesiones:()=>({nota:19,letra:'AD'}),letterToNum:c.IERegistroEvaluacion.letterToNum});
 vm.runInContext(fn(read('registro.html'),'notaCompAlumno'),c);assert.equal(c.notaCompAlumno('ficticia','synthetic').letra,'B');
});
