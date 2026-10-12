import {useEffect,useMemo,useRef,useState} from 'react';
import {loadState,saveState,DEFAULT_MSG,COUNTDOWN_DEFAULT,uid,nowEpochSecs} from '../components/svs/rally/rallyRoomHelpers.js';
import {resolveBattleTimers,editBattleTimer,leadersFromPlan,CLOSED} from '../services/battleOperationsService.js';
const DEFAULT={timers:[],archived:[],marchRegistry:[],paused:false,battleStatus:'Planning',switchingDraft:{},audit:[],templates:{},presets:[],calculator:{timingMode:'impact',impactTimeRaw:'',impactEpochSecs:null,countdownSecs:COUNTDOWN_DEFAULT,rallyDuration:3,leaders:[],messageTemplate:DEFAULT_MSG}};
export function useLiveBattleRoom(plan,players) {
 const boot=useRef(null);
 if(!boot.current){try{const data=loadState(DEFAULT,DEFAULT_MSG)||DEFAULT;resolveBattleTimers(data.timers);boot.current={data,blocked:false};}catch{boot.current={data:DEFAULT,blocked:true};}}
 const [state,setState]=useState(boot.current.data);
 const [error,setError]=useState(boot.current.blocked?'Saved data could not be read. Original data is preserved; restore a backup.':'');const loaded=useRef(null);
 useEffect(()=>{const changed=e=>{if(e.key==='svs_live_rally_room_v2'){boot.current.blocked=true;setError('Another tab changed battle data. Reload before editing.');}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 useEffect(()=>{if(!boot.current.blocked&&!saveState(state))setError('Save failed. Keep this screen open and export a backup.');},[state]);
 const mutate=(label,fn)=>setState(prev=>{if(boot.current.blocked)return prev;try{const next=fn(prev);return {...next,audit:[...(prev.audit||[]),{id:uid(),at:nowEpochSecs(),label}].slice(-500)};}catch(e){setError(e.message);return prev;}});
 useEffect(()=>{
   if(!plan||loaded.current===plan.id)return;loaded.current=plan.id;
   setState(prev=>{
     const existing=prev.calculator.leaders;
     // Preserve the current timing setup when reopening the same plan.
     const fresh=leadersFromPlan(plan,prev.marchRegistry,players);
     const leaders=fresh.map(l=>prev.planId===plan.id?{...l,...existing.find(x=>x.slotId===l.slotId),joiners:l.joiners,ratio:l.ratio,troopFillers:l.troopFillers,waveId:l.waveId}:l);
     const assigned=Object.entries(plan.commandAssignments||{}).filter(([,id])=>id).map(([role,id])=>{const p=players.find(p=>p.id===id);return p?{id:`member:${id}`,playerId:id,name:p.username||p.alias,marchSecs:p.leaderProfile?.marchTime??null,role}:null;}).filter(Boolean);
     const registry=[...prev.marchRegistry];for(const l of [...fresh,...assigned]){const id=l.playerId; if(!registry.some(r=>id && r.playerId===id||r.name===l.name))registry.push({id:uid(),playerId:id,name:l.name,marchSecs:l.marchSecs,type:l.type||'Garrison Entry'});}
     return {...prev,planId:plan.id,planName:plan.name,marchRegistry:registry,calculator:{...prev.calculator,utcDate:prev.planId===plan.id?(prev.calculator.utcDate||plan.date):plan.date,leaders}};
   });
 },[plan?.id,players]);
 const timers=useMemo(()=>{try{return resolveBattleTimers(state.timers);}catch(e){return state.timers.map(t=>({...t,review:true,linkError:e.message}));}},[state.timers]);
 function saveTimer(t){mutate('Timer updated',prev=>({...prev,timers:editBattleTimer(prev.timers,t)}));}
 function addTimers(newTimers){mutate('Timers scheduled',prev=>{
   const built=newTimers.map(t=>{const l=prev.calculator.leaders.find(l=>l.id===t.calculatorLeaderId||l.name===t.leaderName);return {...t,status:t.status||'Planned',planId:prev.planId,marchSecs:t.marchSecs??l?.marchSecs,troopFillers:t.troopFillers??l?.troopFillers??[],waveId:t.waveId||l?.waveId||'main',joiners:t.joiners?.length?t.joiners:l?.joiners||[],ratio:t.ratio||l?.ratio||'',leaderId:t.leaderId||l?.playerId||null};});
   return {...prev,timers:resolveBattleTimers([...prev.timers.filter(t=>!built.some(b=>b.id===t.id)),...built])};});}
 function archive(id){mutate('Event archived',prev=>{const t=prev.timers.find(t=>t.id===id);if(!t||!CLOSED.includes(t.status))throw Error('Confirm outcome before archiving');if(prev.timers.some(x=>x.dependency?.parentId===id))throw Error('Keep linked parent until dependent actions are archived');return {...prev,timers:prev.timers.filter(t=>t.id!==id),archived:[...prev.archived,{...t,archivedAt:new Date().toISOString()}]};});}
 function restore(data){if(!data || !Array.isArray(data.timers) || !Array.isArray(data.marchRegistry) || !Array.isArray(data.calculator?.leaders))throw Error('Invalid Live Room backup');resolveBattleTimers(data.timers);boot.current.blocked=false;setState({...DEFAULT,...data});setError('');}
 function preset(){mutate('Timing preset saved',prev=>({...prev,presets:[...(prev.presets||[]),{id:uid(),name:prev.planName||'Timing preset',calculator:structuredClone(prev.calculator),marchRegistry:structuredClone(prev.marchRegistry),switchingDraft:structuredClone(prev.switchingDraft||{})}]}));}
 function loadPreset(id){mutate('Timing preset loaded',prev=>{const p=prev.presets.find(p=>p.id===id);if(!p)return prev;return {...prev,calculator:{...p.calculator,impactEpochSecs:null,impactTimeRaw:''},marchRegistry:p.marchRegistry,switchingDraft:{...p.switchingDraft,counterId:'',counterTime:'',entry:'',enemy:'',departure:''},paused:true};});}
 return {state,setState,mutate,timers,error,saveTimer,addTimers,archive,preset,loadPreset,restore};
}
