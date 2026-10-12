const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','vendor/qrcodejs.min.js'),'utf8');
test('QR library renders 25 Spanish accented IDs without overflow',()=>{
 const c=vm.createContext({navigator:{userAgent:'Synthetic'},document:{documentElement:{tagName:'HTML'}}});
 vm.runInContext(src,c);
 for(let i=0;i<25;i++){
  const payload='IE22375|primaria|1|Única|ESTUDIANTE SINTÉTICO JOSÉ PEÑA '+i;
  const box={title:'',innerHTML:'',childNodes:[{offsetWidth:192,offsetHeight:192,style:{}}]};
  assert.doesNotThrow(()=>new c.QRCode(box,{text:payload,width:192,height:192,correctLevel:c.QRCode.CorrectLevel.M}));
  assert.equal(box.title,payload);
  assert.match(box.innerHTML,/<table/);
 }
});