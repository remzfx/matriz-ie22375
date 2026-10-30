'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{create}=require('./registro-inline-modules.cjs').load('registro-connection.js');
test('shared scope deadline is not renewed by navigation, and forced checks stay explicit',async()=>{
 let time=0,key='owner|token|A',allowed=true,remote=0;const forces=[],c=create({now:()=>time,binding:()=>key,owner:()=> 'owner|token',authorized:()=>true,allowed:()=>allowed,setTimeout:()=>1,clearTimeout(){},verify:async({force})=>{forces.push(force);if(force){remote++;return {ok:true};}return {ok:true,validUntil:150000};}});
 await c.check();assert.equal(c.snapshot().validUntil,150000);time=100000;key='owner|token|B';c.select();await c.check();assert.equal(c.snapshot().validUntil,150000);assert.equal(remote,0);
 await c.check(false,true);assert.equal(remote,1);assert.equal(forces.at(-1),true);assert.equal(c.snapshot().validUntil,250000);
 allowed=false;c.select();assert.equal(c.canEdit(),false);c.dispose();
});
test('expired shared authorization cannot open a new context or extend its deadline',async()=>{
 let time=151000;const c=create({now:()=>time,binding:()=> 'owner|token|C',authorized:()=>true,setTimeout:()=>1,clearTimeout(){},verify:async()=>({ok:true,validUntil:150000})});
 assert.equal(await c.check(),false);assert.equal(c.canEdit(),false);assert.equal(c.snapshot().state,'checking');c.dispose();
});
test('late shared-scope verification from a previous context cannot grant the visible context',async()=>{
 let key='A',release;const c=create({binding:()=>key,authorized:()=>true,setTimeout:()=>1,clearTimeout(){},verify:()=>new Promise(r=>release=r)});
 const task=c.check();key='B';release({ok:true,validUntil:Date.now()+150000});assert.equal(await task,false);assert.equal(c.canEdit(),false);c.dispose();
});
