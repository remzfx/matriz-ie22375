// Exact explanatory UI delta only; old A1/identity/CAS snapshots remain strict.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
module.exports=s=>{s=s.replace(/\r\n/g,'\n');if(!s.includes("explanation.className='academic-conflict-explanation'"))return s;
 assert.equal(crypto.createHash('sha256').update(s).digest('hex'),'b90891f50059dcc774f145d38be27da661870e4838021b486e037f775881ea35','Exact reviewed explanation-only module');
 return execFileSync('git',['show','86e06835c6a42ce90f439d91ca8e39d1cfc8400e:registro-reconcile.js'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
};
