/* Calendar rules shared by the AIP editor, preview and monthly planner. */
(function(root){
  'use strict';
  const levels=['pri','sec'];
  const modes=['diario','semanal','rotativo','personalizado'];
  const dayMs=86400000;
  function calendarDay(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date=new Date(value+'T12:00:00');
    if(!Number.isFinite(date.getTime())) return null;
    const [year,month,day]=value.split('-').map(Number);
    if(date.getFullYear()!==year||date.getMonth()+1!==month||date.getDate()!==day) return null;
    // Project the local calendar components onto a day count without daylight-saving offsets.
    return {date,number:Date.UTC(year,month-1,day)/dayMs,weekday:(date.getDay()+6)%7};
  }
  function validate(rule, slots){
    if(!rule||typeof rule!=='object'||typeof rule.id!=='string'||!/^[\w-]{1,80}$/.test(rule.id)||
       typeof rule.name!=='string'||!rule.name.trim()||rule.name.length>100||
       !modes.includes(rule.mode)||typeof rule.active!=='boolean'||
       !Array.isArray(rule.levels)||!rule.levels.length||new Set(rule.levels).size!==rule.levels.length||
       rule.levels.some(level=>!levels.includes(level))) return 'Revisa el nombre, la modalidad y el nivel.';
    const start=calendarDay(rule.start),end=calendarDay(rule.end);
    if(!start||!end||end.number<start.number||end.number-start.number>3660) return 'Indica un periodo válido de hasta diez años.';
    if(!Number.isInteger(rule.day)||rule.day<0||rule.day>4) return 'Elige un día de lunes a viernes.';
    for(const key of ['include','exclude']){
      if(!Array.isArray(rule[key])||rule[key].some(value=>{
        const d=calendarDay(value);
        return !d||d.weekday>4||d.number<start.number||d.number>end.number;
      })) return 'Las fechas específicas deben ser días hábiles dentro del periodo.';
    }
    for(const level of rule.levels){
      const rows=rule.hours?.[level];
      if(!rows||Array.isArray(rows)||typeof rows!=='object') return 'Selecciona horas para cada nivel.';
      const byDay=['0','1','2','3','4'];
      const allowed=rule.mode==='personalizado'?[...byDay,'extra']:rule.mode==='semanal'||Object.hasOwn(rows,'all')?['all']:byDay;
      if(Object.entries(rows).some(([key,hours])=>!allowed.includes(key)||!Array.isArray(hours)||
          hours.some(h=>!Number.isInteger(h)||h<1||h>50||(slots&&!slots[level].some(([number])=>number===h))))) return 'Selecciona únicamente horas pedagógicas disponibles.';
      const times=rule.times?.[level];
      if(times!==undefined&&(!times||typeof times!=='object'||Array.isArray(times)||Object.entries(times).some(([hour,range])=>
         !/^[1-9][0-9]?$/.test(hour)||typeof range!=='string'||!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(range)))) return 'Los tramos horarios no tienen un formato válido.';
      if(!Object.entries(rows).some(([key,hours])=>hours.length&&(key!=='extra'||rule.include.length))) return 'Selecciona horas para cada nivel.';
      if(rule.mode==='personalizado'&&rule.include.length&&!rows.extra?.length) return 'Selecciona horas para las fechas adicionales en cada nivel.';
    }
    return '';
  }
  function read(value){
    if(!Array.isArray(value)||value.some(rule=>validate(rule))||new Set(value.map(rule=>rule.id)).size!==value.length) return null;
    return value;
  }
  function hoursOn(rule,fecha,nivel){
    if(!rule.levels.includes(nivel)||fecha<rule.start||fecha>rule.end||rule.exclude.includes(fecha)) return [];
    const day=calendarDay(fecha);
    if(!day||day.weekday>4) return [];
    const hours=rule.hours[nivel];
    if(rule.mode==='diario') return hours[day.weekday]||hours.all||[];
    if(rule.mode==='semanal') return day.weekday===rule.day?hours.all||[]:[];
    if(rule.mode==='rotativo'){
      const start=calendarDay(rule.start);
      const week=Math.floor((day.number-start.number+start.weekday)/7);
      return day.weekday===(rule.day+week)%5?hours[day.weekday]||hours.all||[]:[];
    }
    return [...new Set([...(hours[day.weekday]||[]),...(rule.include.includes(fecha)?hours.extra||[]:[])])];
  }
  function dates(rule){
    const start=calendarDay(rule.start),end=calendarDay(rule.end),out=[];
    if(!start||!end||end.number-start.number>3660) return out;
    for(const date=new Date(start.date);date<=end.date;date.setDate(date.getDate()+1)){
      const day=date.getDay();
      if(day>=1&&day<=5) out.push([date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'));
    }
    return out;
  }
  root.IEAipColegiado={levels,modes,calendarDay,validate,read,hoursOn,dates};
  if(typeof module!=='undefined'&&module.exports) module.exports=root.IEAipColegiado;
})(typeof window==='undefined'?globalThis:window);
