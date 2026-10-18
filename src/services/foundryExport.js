import { C } from '../utils/constants.js';
import { TEAM_COLORS } from '../data/foundry.js';
import { battleSheet } from './foundryService.js';
// SVG contains text and vector geometry only: Unicode remains text until rasterization.
export async function foundryImage(svgMarkup,plan,players,phaseLabel) {
  await document.fonts.ready;
  const image=new Image();const svgUrl=URL.createObjectURL(new Blob([svgMarkup],{type:'image/svg+xml;charset=utf-8'}));
  try { await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Map could not be rendered'));image.src=svgUrl;});
    const canvas=document.createElement('canvas');canvas.width=2000;
    const ctx=canvas.getContext('2d');ctx.font='24px system-ui';
    const wrap=(text,width)=>{const lines=[];let line='';for(const char of text){if(ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}lines.push(line);return lines;};
    const lines=battleSheet(plan,players).split('\n').flatMap(l=>wrap(l,940));
    canvas.height=Math.max(1160,150+lines.length*34);ctx.fillStyle=C.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=C.icy;ctx.font='bold 36px system-ui';wrap(plan.title,940).forEach((l,i)=>ctx.fillText(l,32,52+i*42));
    ctx.font='24px system-ui';ctx.fillText(`Legion ${plan.legion} · ${plan.date} ${plan.time} UTC`,32,135);
    ctx.fillText(`Map phase: ${phaseLabel}`,32,168);
    ctx.drawImage(image,24,180,920,960);
    let y=50;for(const line of lines){const t=plan.teams.find(t=>line===t.name.toUpperCase());if(t){ctx.fillStyle=TEAM_COLORS[t.colorIndex];ctx.fillRect(1010,y-25,8,32);}ctx.fillStyle=t?TEAM_COLORS[t.colorIndex]:C.white;ctx.fillText(line,1040,y);y+=34;}
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image export failed')),'image/png'));
  } finally { URL.revokeObjectURL(svgUrl); }
}
export function downloadFoundry(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
