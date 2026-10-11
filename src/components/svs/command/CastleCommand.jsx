import {useState,useMemo} from 'react';
import {useCastleCommand} from '../../../hooks/useCastleCommand.js';
import {uid,resolveEvents} from '../../../services/castleTimingService.js';
import {LiveCommand} from './LiveCommand.jsx';
import {BattlePlanner} from './BattlePlanner.jsx';
import {SwitchingFight} from './SwitchingFight.jsx';
import {BattleRoster} from './BattleRoster.jsx';
import {Button,Field,Warning,row} from './CommandUI.jsx';
export function CastleCommand({onBack,players:hostPlayers}) {
 const cmd=useCastleCommand();const [view,setView]=useState('Live Command'),[selected,setSelected]=useState(''),[editing,setEditing]=useState(null),[editDraft,setEditDraft]=useState(null);
 const {data,now,mutate}=cmd;
 const selectedBattle=data?.battles.find(b=>b.id===selected)||data?.battles[0];
 const resolved=useMemo(()=>selectedBattle?resolveEvents(selectedBattle.events):[],[selectedBattle]);
 if(!data)return <div style={{padding:16}}><Warning>Saved Castle Command data could not be read. It has been preserved. Restore a valid backup before continuing.</Warning><Button onClick={onBack}>Back</Button></div>;
 const battle=data.battles.find(b=>b.id===selected)||data.battles[0];
 const liveBattle={...battle,events:resolved};
 const draft=key=>data.drafts?.[`${battle.id}:${key}`];
 const setDraft=(key,value)=>mutate('Draft updated',d=>({...d,drafts:{...d.drafts,[`${battle.id}:${key}`]:value}}));
 const saveEvent=e=>cmd.saveEvent(battle.id,e);
 function preset(){mutate('Preset saved',d=>({...d,presets:[...d.presets,{id:uid(),name:battle.name,battle:structuredClone(battle),players:structuredClone(d.players)}]}));}
 function loadPreset(id){const p=data.presets.find(p=>p.id===id);if(!p)return;const b=structuredClone(p.battle);b.id=uid();b.name=`${p.name} (preset)`;b.status='Planning';b.paused=true;b.events=b.events.map(e=>({...e,status:'Planned',actualAt:null,reportedAt:null,review:true}));mutate('Preset loaded',d=>({...d,battles:[...d.battles,b],players:p.players}));setSelected(b.id);}
 return <div style={{padding:16,fontSize:16}}><div style={row}><Button onClick={onBack}>← Battle</Button><b>Castle Command</b></div>
 <Field label="Saved battle" value={battle.id} onChange={v=>{setSelected(v);setEditing(null);}}>{data.battles.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</Field>
 <details><summary style={{minHeight:44}}>Battle settings, presets & history</summary><Field label="Battle name" value={battle.name} onChange={v=>cmd.updateBattle(battle.id,{name:v})}/><Field label="UTC battle date" type="date" value={battle.date} onChange={v=>cmd.updateBattle(battle.id,{date:v})}/><Field label="Commander notes" value={battle.notes} onChange={v=>cmd.updateBattle(battle.id,{notes:v})}/><div style={row}><Button onClick={()=>cmd.newBattle('New castle battle')}>New battle</Button><Button onClick={preset}>Save preset</Button><Button onClick={()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='castle-command-backup.json';a.click();URL.revokeObjectURL(url);}}>Export backup</Button></div>
 <Field label="Load preset · review dates before resuming" value="" onChange={loadPreset}><option value="">Choose</option>{data.presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field>
 {['Rally','Garrison','Enemy','Reinforcement'].map(type=><Field key={type} label={`${type} template · {player}, {name}`} value={data.templates[type]||''} onChange={v=>mutate('Template updated',d=>({...d,templates:{...d.templates,[type]:v}}))}/>)}
 <p>Local device only. Shared command room is not connected.</p>{data.audit.slice(-10).reverse().map(a=><div key={a.id}>{new Date(a.at).toISOString()} · {a.label}</div>)}</details>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>{['Live Command','Battle Planner','Switching Fight','Battle Roster'].map(v=><Button key={v} onClick={()=>setView(v)}>{view===v?'● ':''}{v}</Button>)}</div>
 {cmd.error&&<Warning>{cmd.error}</Warning>}
 {editing?<BattlePlanner key={editing.id} battle={battle} players={data.players} now={now} editing={editing} draft={editDraft} onDraft={setEditDraft} onSave={saveEvent} onDone={()=>{setEditing(null);setEditDraft(null);}}/>:
 view==='Live Command'?<LiveCommand battle={liveBattle} players={data.players} templates={data.templates} now={now} onSave={saveEvent} onEdit={e=>{setEditing(e);setEditDraft(null);}} onDuplicate={e=>saveEvent({...e,id:uid(),name:`${e.name} copy`,status:'Planned',actualAt:null,reportedAt:null})} onBattle={patch=>cmd.updateBattle(battle.id,patch)} clockWarning={cmd.clockWarning}/>:
 view==='Battle Planner'?<BattlePlanner battle={battle} players={data.players} now={now} draft={draft('planner')} onDraft={v=>setDraft('planner',v)} onSave={saveEvent}/>:
 view==='Switching Fight'?<SwitchingFight battle={battle} players={data.players} now={now} draft={draft('switch')} onDraft={v=>setDraft('switch',v)} onSequence={seq=>cmd.updateBattle(battle.id,{events:[...battle.events,...seq]})}/>:
 <BattleRoster players={data.players} hostPlayers={hostPlayers} onSave={p=>mutate('Player saved',d=>({...d,players:d.players.some(x=>x.id===p.id)?d.players.map(x=>x.id===p.id?p:x):[...d.players,p]}))}/>}
 </div>;
}
