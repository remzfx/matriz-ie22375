'use strict';

const secciones=['1A','1B','2A','2B','3A','3B','4A','4B','5U'];
const cursos=['MAT','COM','CYT','CCSS','ING','ART'];

function responsable(curso,indiceSeccion){
 const grupo=Math.floor(indiceSeccion/3);
 // En el último grupo, un docente asume Matemática y Ciencias Sociales.
 // Esas dos áreas nunca coinciden en un mismo tramo dentro del grupo.
 const indice=grupo===2&&curso===3?0:curso;
 return String(indice*3+grupo+1).padStart(2,'0');
}

const horarioDoc=Object.fromEntries(Array.from({length:5},(_,dia)=>[dia,
 Object.fromEntries(Array.from({length:7},(_,tramo)=>[tramo+1,Object.fromEntries(secciones.map((seccion,i)=>{
  const curso=(2*dia+Math.floor(tramo/2)+i)%cursos.length;
  const id=responsable(curso,i);
  return [seccion,{area:cursos[curso],doc:'Docente ficticio '+id,docenteId:'fixture-'+id}];
 }))]))
]));

module.exports=horarioDoc;
