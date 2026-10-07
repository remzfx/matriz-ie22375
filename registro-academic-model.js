/* Modelo académico compartido. concArea se conserva únicamente como historial. */
function registroAcademico_() {
  // El catálogo coincide con EST_PRIM/EST_SEC del Registro; no concede permisos.
  const catalog = {
    "primaria": {
      "Personal Social": [
        "Construye su Identidad",
        "Convive y participa democráticamente",
        "Construye interpretaciones históricas",
        "Gestiona responsablemente el espacio y el ambiente",
        "Gestiona responsablemente los recursos económicos"
      ],
      "Educación Física": [
        "Se desenvuelve de manera autónoma a través de su motricidad",
        "Asume una vida saludable",
        "Interactúa a través de sus habilidades sociomotrices"
      ],
      "Comunicación": [
        "Se comunica oralmente en su lengua materna",
        "Lee diversos tipos de textos escritos en su lengua materna",
        "Escribe diversos tipos de textos en su lengua materna"
      ],
      "Arte y Cultura": [
        "Aprecia de manera crítica manifestaciones artístico-culturales",
        "Crea proyectos artísticos desde los lenguajes artísticos"
      ],
      "Matemática": [
        "Resuelve problemas de cantidad",
        "Resuelve problemas de regularidad, equivalencia y cambio",
        "Resuelve problemas de forma, movimiento y localización",
        "Resuelve problemas de gestión de datos e incertidumbre"
      ],
      "Ciencia y Tecnología": [
        "Indaga mediante métodos científicos para construir sus conocimientos",
        "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
        "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno"
      ],
      "Educación Religiosa": [
        "Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente, comprendiendo la doctrina de su propia religión, abierto al diálogo con las que le son cercanas",
        "Asume la experiencia el encuentro personal y comunitario con Dios en su proyecto de vida en coherencia con su creencia religiosa"
      ]
    },
    "secundaria": {
      "Desarrollo Personal, Ciudadanía y Cívica": [
        "Construye su identidad",
        "Convive y participa democráticamente en la búsqueda del bien común"
      ],
      "Ciencias Sociales": [
        "Construye interpretaciones históricas",
        "Gestiona responsablemente el espacio y el ambiente",
        "Gestiona responsablemente los recursos económicos"
      ],
      "Educación para el Trabajo (EPT)": [
        "Gestiona proyectos de emprendimiento económico o social"
      ],
      "Educación Física": [
        "Se desenvuelve de manera autónoma a través de su motricidad",
        "Asume una vida saludable",
        "Interactúa a través de sus habilidades sociomotrices"
      ],
      "Comunicación": [
        "Se comunica oralmente en su lengua materna",
        "Lee diversos tipos de textos escritos en su lengua materna",
        "Escribe diversos tipos de textos en su lengua materna"
      ],
      "Arte y Cultura": [
        "Aprecia de manera crítica manifestaciones artístico-culturales",
        "Crea proyectos artísticos desde los lenguajes artísticos"
      ],
      "Inglés": [
        "Se comunica oralmente en inglés como lengua extranjera",
        "Lee diversos tipos de texto en inglés como lengua extranjera",
        "Escribe diversos tipos de textos en inglés como lengua extranjera"
      ],
      "Matemática": [
        "Resuelve problemas de cantidad",
        "Resuelve problemas de regularidad, equivalencia y cambio",
        "Resuelve problemas de forma, movimiento y localización",
        "Resuelve problemas de gestión de datos e incertidumbre"
      ],
      "Ciencia y Tecnología": [
        "Indaga mediante métodos científicos para construir sus conocimientos",
        "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
        "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno"
      ],
      "Educación Religiosa": [
        "Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente, comprendiendo la doctrina de su propia religión, abierto al diálogo con las que le son cercanas",
        "Asume la experiencia el encuentro personal y comunitario con Dios en su proyecto de vida en coherencia con su creencia religiosa"
      ]
    }
  };
  const prefix = c => [c.nivel,c.bim||c.bimestre,c.grado,c.seccion,c.area].join('||')+'||';
  const key = (c,comp,id) => prefix(c)+comp+(id===undefined?'':'||'+id);
  const worked = (p,c,comp) => !p.competenciasEstado || !p.competenciasEstado[key(c,comp)] || p.competenciasEstado[key(c,comp)].trabajada!==false;
  const conclusion = (p,c,comp,id) => {
    const r=(p.concComp||{})[key(c,comp,id)];
    return r&&!r.borrado?String(r.texto||'').trim():'';
  };
  function canonical(p) {
    function clean(x) {
      if(Array.isArray(x))return x.map(clean).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
      if(x&&typeof x==='object') {
        const out={};
        Object.keys(x).sort().filter(k=>!['ts','_ts','registroVersion','docente'].includes(k)).forEach(k=>out[k]=clean(x[k]));
        return out;
      }
      return x;
    }
    // Activada es el valor histórico implícito. Las marcas de tiempo no son contenido editable.
    const state={};
    Object.keys(p.competenciasEstado||{}).sort().forEach(k=>{
      if(p.competenciasEstado[k].trabajada===false)state[k]={trabajada:false};
    });
    const notes=map=>Object.fromEntries(Object.entries(map||{}).filter(([,v])=>!v.borrado).sort().map(([k,v])=>
      [k,v.origen==='letra'?{origen:'letra',nivel:v.nivel}:clean(v)]));
    const conc=Object.fromEntries(Object.entries(p.concComp||{}).filter(([,v])=>!v.borrado&&String(v.texto||'').trim()).sort().map(([k,v])=>[k,{texto:String(v.texto).trim()}]));
    return JSON.stringify(clean({sessions:[],concArea:{},asistencia:{},asisFechas:{},asisFechasEstado:{},capsSel:{},...p,
      modeloAcademico:undefined,ts:undefined,meta:{studentAliases:p.meta&&p.meta.studentAliases||{}},competenciasEstado:state,concComp:conc,grades:notes(p.grades),finales:notes(p.finales)}));
  }
  function validate(p,c) {
    const comps=(catalog[c.nivel]||{})[c.area]||[],pref=prefix(c);
    for(const field of ['competenciasEstado','concComp']) {
      const map=p[field]||{};
      if(typeof map!=='object'||Array.isArray(map))throw Error('Metadata académica inválida.');
      for(const [k,v] of Object.entries(map)) {
        const parts=k.slice(pref.length).split('||');
        if(!k.startsWith(pref)||!comps.includes(parts[0])||parts.length!==(field==='concComp'?2:1)||!v||typeof v!=='object'||Array.isArray(v)||parts.some(x=>!x))
          throw Error('Competencia o contexto académico no autorizado.');
        if(field==='competenciasEstado'&&typeof v.trabajada!=='boolean')throw Error('Estado de competencia inválido.');
        if(field==='concComp'&&(typeof v.texto!=='string'||v.texto.length>2000))throw Error('Conclusión académica inválida.');
        if(field==='concComp')v.texto=v.texto.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
      }
    }
    return p;
  }
  return {catalog,prefix,key,worked,conclusion,canonical,validate};
}
if(typeof window!=='undefined')window.IERegistroAcademico=registroAcademico_();
