import {newPlayer} from '../src/data/playerSchema.js';
import {newPlan,createTeam} from '../roster-site/src/tal/planner.js';
import {sharedData,validateWorkspace} from '../roster-site/shared/workspace.js';
const URL='https://docs.google.com/spreadsheets/d/1iHHBMYDu2FF3HjNTzas8VoyzUQz7_3L__ZS48EDXMdY/edit';
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase();
const number=v=>{const n=Number(clean(v).replaceAll(',',''));return clean(v)&&Number.isFinite(n)?n:null;};
const troop=v=>{const m=clean(v).match(/^FC(\d+)(?:T(10|11))?$/i);return m?(m[2]==='11'?'Helios FC':'FC')+m[1]:null;};
const language=v=>({english:'English',korean:'Korean',german:'German',french:'French','chinese(malid)':'Chinese'})[norm(v)]||clean(v);
export function importTalPlanningSheet(input,existing={},at=new Date().toISOString()){
 const data=sharedData(existing),players=[...data.players],byFid=new Map(players.filter(p=>p.fid).map(p=>[String(p.fid),p]));
 const plan={...newPlan(),...data.talPlan,records:{...data.talPlan?.records},teams:(data.talPlan?.teams||[]).map(t=>({...t,members:[...t.members],candidates:[...(t.candidates||[])]}))};
 const state=(input.sheets['State Roster']?.values||[]).slice(1),sources=(input.sheets['Data Sources']?.values||[]).slice(1);
 const teamDefinitions=[['HOT',1,['12:00','14:00','19:00']],['ARC',2,['02:00','07:00','19:00']],['RKG',3,['14:00','19:00']]];
 for(const [host,n,slots] of teamDefinitions)if(!plan.teams.some(t=>t.id===`${host}:${n}`))plan.teams.push({...createTeam(host,n),slots,importedSource:{url:URL,label:`Legion${n}`,confirmGameLegion:n>1,primaryTimesUnconfirmed:true,notes:n===2?'Overview lists 02:00, 07:00, 19:00; Sheet6 lists 12:00, 14:00, 19:00. Confirm primary times.':n===3?'Overview lists 14:00 and 19:00 only. The third time and in-game legion number need confirmation.':'Primary times copied from Overview; confirm in game.'}});
 plan.name=plan.name==='State 3573 TAL'?'State 3573 TAL · November 2026':plan.name;plan.step='legions';plan.locked=false;plan.timesConfirmed=false;
 const fidCounts=new Map();for(const row of input.players){const id=clean(row['Player ID']);if(id)fidCounts.set(id,(fidCounts.get(id)||0)+1);}
 const summary={sourceRows:input.players.length,added:0,updated:0,selected:0,proposed:0,withdrawn:0,missingIDs:[],identityCorrections:[],rolesPending:0,sourceRegistrationsVerified:0,confirmedRegistrations:0};
 const knownMain=new Set((input.sheets['HOT - Legion 1']?.values||[]).slice(1).filter(r=>/main\s*roost?er/i.test(clean(r[8]))).map(r=>clean(r[1])));
 for(const row of input.players){
  const originalFID=clean(row['Player ID']),name=clean(row.Username),home=clean(row['Home Alliance']);let fid=originalFID,identityNote='';
  if(!fid){const matches=state.filter(r=>norm(r[2])===norm(name)&&norm(r[1])===norm(home)&&/^\d{5,15}$/.test(clean(r[3])));if(matches.length===1){fid=clean(matches[0][3]);identityNote=`Recovered player ID ${fid} from the exact name and home-alliance match in State Roster.`;}}
  // Resolve duplicated IDs only when independent name, home and rank evidence identifies one source roster entry.
  if(fidCounts.get(fid)>1){
   const matches=state.filter(r=>{const actual=norm(r[2]),tag=norm(r[1]),base=tag&&actual.endsWith(tag)?actual.slice(0,-tag.length):actual;return norm(home)===tag&&(actual===norm(name)||base===norm(name))&&(!clean(r[7])||!clean(row['Labyrinth rank'])||clean(r[7])===clean(row['Labyrinth rank']));});
   if(matches.length===1&&clean(matches[0][3])!==fid){fid=clean(matches[0][3]);identityNote=`Corrected spreadsheet ID ${originalFID} to ${fid}: State Roster independently matches ${name}, home alliance ${home} and the recorded Labyrinth rank. The original ID is also used by another row; both source rows are retained.`;}
  }
  if(identityNote)summary.identityCorrections.push({row:row._row,name,originalFID,fid,reason:identityNote});
  if(!/^\d{5,15}$/.test(fid)){fid='';identityNote=identityNote||'Player ID is missing. Kept as a name-only planning profile; verify the ID before game lookups.';summary.missingIDs.push({row:row._row,name});}
  const old=fid?byFid.get(fid):players.find(p=>p.id===`sheet-row:${row._row}`),p=old?structuredClone(old):newPlayer({id:fid?`sheet:${fid}`:`sheet-row:${row._row}`,fid,username:name,allianceTag:home});
  p.pastUsernames=p.pastUsernames||[];p.notes=p.notes||'';p.joinerHeroes=p.joinerHeroes||[];
  const details=sources.filter(r=>clean(r[1])===originalFID||clean(r[1])===fid);
  p.importedSheet={url:URL,row:row._row,importedAt:at,originalFID,identityNote,fields:Object.fromEntries(Object.entries(row).filter(([key])=>key!=='_row')),sourceNotes:details};
  if(!old){summary.added++;if(number(row.Power)!=null)p.power=number(row.Power);if(row['Furnace level'])p.furnaceLevel=clean(row['Furnace level']);}
  else{summary.updated++;if(p.username!==name&&!p.pastUsernames.includes(name))p.pastUsernames.push(name);}
  p.troops={...p.troops};for(const [field,key] of [['Infantry','infantry'],['Lancer','lancer'],['Marksman','marksman']]){const value=troop(row[field]);if(value&&!p.troops[key])p.troops[key]=value;}
  if(clean(row.Language))p.languages=[...new Set([...(p.languages||[]),language(row.Language)])];
  if(clean(row.Notes)&&!p.notes.includes(clean(row.Notes)))p.notes=[p.notes,clean(row.Notes)].filter(Boolean).join('\n');
  if(identityNote&&!p.notes.includes(identityNote))p.notes=[p.notes,identityNote].filter(Boolean).join('\n');
  const hero=clean(row['Joiner heroes']).match(/^(.*?)\s+(\d+)★$/u);if(hero&&!p.joinerHeroes.some(h=>norm(h.hero)===norm(hero[1])))p.joinerHeroes.push({hero:clean(hero[1]),stars:Number(hero[2]),skillLevel:null,verified:false,source:'Planning spreadsheet; skill not recorded'});
  const rank=number(row['Labyrinth rank']),score=number(row['Labyrinth score']);if(rank!=null&&!p.providerRankings?.labyrinth)p.providerRankings={...p.providerRankings,labyrinth:{stateId:'3573',rank,score,source:'Planning spreadsheet · historical WoS Oracle record',retrievedAt:null,importedAt:at}};
  if(!old){players.push(p);if(fid)byFid.set(fid,p);}else{players[players.findIndex(v=>v.id===p.id)]=p;if(fid)byFid.set(fid,p);}
  const times=plan.times.filter(t=>String(row[t+' UTC']).toUpperCase()==='TRUE'),declined=norm(row['Assigned Legion'])==='unavailable'||norm(row.Selection)==='withdrawn';
  const note=[clean(row.Notes),clean(row['Availability notes']),clean(row['Poll status'])==='Awaiting reply'?'Sheet poll status: Awaiting reply. Checkbox times retained as recorded.':''].filter(Boolean).join('\n');
  const previous=plan.records[p.id];
  plan.records[p.id]={status:declined?'declined':times.length?'available':'pending',times,homeAlliance:home,note,troopPower:'',excludeFromSuggestions:['underreview','withdrawn','notselected','reserve'].includes(norm(row.Selection)),...previous,sheetSelection:clean(row.Selection)||'Not specified',sheetRegistration:clean(row.Registration)||'Not checked',sheetTransfer:clean(row.Transfer),importedSheetRow:row._row};
  const match=clean(row['Assigned Legion']).match(/^Legion\s*(\d+)$/i),team=match?plan.teams.find(t=>t.host===clean(row['TAL Alliance'])&&t.number===Number(match[1])):null;
  if(!team)continue;
  plan.records[p.id].proposedTeamId=team.id;
  if(clean(row.Registration)==='Verified')summary.sourceRegistrationsVerified++;
  const assigned=plan.teams.find(t=>t.members.some(m=>m.id===p.id));
  if(norm(row.Selection)==='selected'){
   if(!assigned){const role=team.host==='HOT'&&knownMain.has(fid)?'combatant':'pending';const registered=role!=='pending'&&clean(row.Registration)==='Verified';team.members.push({id:p.id,role,registered});summary.selected++;if(role==='pending')summary.rolesPending++;if(registered)summary.confirmedRegistrations++;}
  }else{plan.records[p.id].excludeFromSuggestions=true;if(!team.candidates.some(c=>c.id===p.id)&&!assigned)team.candidates.push({id:p.id,status:clean(row.Selection)||'Needs review',sourceRow:row._row});if(norm(row.Selection)==='withdrawn')summary.withdrawn++;else summary.proposed++;}
 }
 const result={...data,players,talPlan:plan,settings:{...data.settings,stateId:'3573',sheetImport:{url:URL,title:'TAL Nov-4',importedAt:at,summary,primaryTimesWarning:'Overview and move-list headings disagree for some legions. Confirm the three primary times in game.',datedAvailability:input.sheets['Dated Availability']?.values||[],sourceHeaders:Object.keys(input.players[0]||{}).filter(k=>k!=='_row')}}};
 validateWorkspace(result);return {data:result,summary};
}
