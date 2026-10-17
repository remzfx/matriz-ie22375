// Historical goldens exclude only the exact, independently tested empty-input guards.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const hashes={recolectarPantalla:'05755171c9ea44b4fd3f8cd597e3b122a273880f5002230cfc1c41ec052c9e7d',guardarFinales:'188baeebdd613112b2a792959f7fa5af67a1ca310ad0273450336a1c60b0408d'},base='96829312848251fdea6cdb787dfe2a75da2b1314';let previous;
const fn=(s,n)=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};
module.exports=s=>{s=s.replace(/\r\n/g,'\n');if(!s.includes('!previo || previo.borrado || previo.origen'))return s;
 if(!previous)previous=execFileSync('git',['show',base+':registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 for(const [name,hash]of Object.entries(hashes)){const value=fn(s,name);assert.equal(crypto.createHash('sha256').update(value).digest('hex'),hash,'Exact empty input correction: '+name);s=s.replace(value,fn(previous,name));}return s;
};
