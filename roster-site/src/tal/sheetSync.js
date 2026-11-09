// Deterministic, review-before-import merge of the TAL Nov-4 sheet.
// No automatic deletion, role allocation, or changes to confirmed battle drafts.
import {newPlayer} from '../../../src/data/playerSchema.js';
import {newPlan} from './planner.js';

export const TAL_SHEET_ID='1iHHBMYDu2FF3HjNTzas8VoyzUQz7_3L__ZS48EDXMdY';
export const TAL_SHEET_URL='https://docs.google.com/spreadsheets/d/'+TAL_SHEET_ID+'/edit';
const norm=v=>String(v??'').trim();
const validId=id=>/^[1-9]\d{4,14}$/.test(norm(id));
const asBool=v=>v===true || String(v).toLowerCase()==='true';
const asNumber=v=>{const s=norm(v).replace(/,/g,'');return s!=='' && Number.isFinite(Number(s))?Number(s):null;};
const key=v=>norm(v).replace(/\s+/g,'').toLowerCase();
export function talRows(sheet){
  const matrix=sheet?.sheets?.Players?.values||[];
  const headers=matrix[0]||[];
  for(const field of ['Player ID','Username','Selection','Registration'])
    if(!headers.includes(field))throw new Error('Missing expected Players column: '+field);
  const rows=matrix.slice(1).map((cells,i)=>({
    _row:i+2,...Object.fromEntries(headers.map((h,j)=>[String(h),cells[j]??'']))
  })).filter(r=>norm(r['Player ID'])||norm(r.Username));
  const counts={};
  for(const row of rows){const id=norm(row['Player ID']);if(id)counts[id]=(counts[id]||0)+1;}
  const problems=rows.filter(r=>!validId(r['Player ID'])||counts[norm(r['Player ID'])]>1)
    .map(r=>({row:r._row,id:norm(r['Player ID']),name:norm(r.Username),reason:!validId(r['Player ID'])?'Missing or invalid player ID':'Duplicate player ID'}));
  const safe=rows.filter(r=>validId(r['Player ID'])&&counts[norm(r['Player ID'])]===1);
  return {rows,safe,problems};
}
const TIMES=['02:00','07:00','12:00','14:00','19:00'];
const timeValues=row=>TIMES.filter(t=>asBool(row[t+' UTC']));
const sourceRecord=row=>({
  sheetSelection:norm(row.Selection)||'Not specified',
  sheetRegistration:norm(row.Registration)||'Not checked',
  sheetTransfer:norm(row.Transfer)||'Not specified',
  importedSheetRow:row._row,
});
const sheetField=row=>({
  url:TAL_SHEET_URL,row:row._row,fields:Object.fromEntries(Object.entries(row).filter(([k])=>k!=='_row')),
});
const takeFresh=fields=>Object.fromEntries(Object.entries(fields).filter(([,value])=>value!=null && value!==''));
const existingById=players=>new Map(players.filter(p=>p.fid).map(p=>[norm(p.fid),p]));
export function talSheetPreview(data,sheet){
  if(sheet?.spreadsheetId!==TAL_SHEET_ID)throw Error('Unexpected spreadsheet ID. Nothing will be imported.');
  const parsed=talRows(sheet),byId=existingById(data.players||[]);
  const priorRecords=data.talPlan?.records||{},recordsByFid=new Map((data.players||[]).map(p=>[norm(p.fid),priorRecords[p.id]||{}]));
  const changes=[],unchanged=[];
  for(const row of parsed.safe){
    const fid=norm(row['Player ID']),old=byId.get(fid),previous=recordsByFid.get(fid)||{},now=sourceRecord(row);
    const priorSource=old?.importedSheet?.fields || {};
    const differs=(!old)||['Selection','Registration','Assigned Legion','TAL Alliance','Language','Notes',...TIMES.map(t=>t+' UTC')].some(k=>norm(priorSource[k])!==norm(row[k]));
    const registrationChanged=norm(previous.sheetRegistration)!==now.sheetRegistration;
    const selectionChanged=norm(previous.sheetSelection)!==now.sheetSelection;
    const times=timeValues(row);
    const changed=differs||registrationChanged||selectionChanged;
    const entry={fid,name:norm(row.Username),row:row._row,newPlayer:!old,
      sourceLegion:norm(row['Assigned Legion']),sourceAlliance:norm(row['TAL Alliance']),
      selection:now.sheetSelection,registration:now.sheetRegistration,times,
      registrationChanged,selectionChanged};
    (changed?changes:unchanged).push(entry);
  }
  return {spreadsheetId:TAL_SHEET_ID,readAt:sheet.readAt,url:TAL_SHEET_URL,
    total:parsed.rows.length,valid:parsed.safe.length,invalid:parsed.problems,
    newPlayers:changes.filter(x=>x.newPlayer).length,
    changes,unchanged:unchanged.length,
    warning:'Selection, transfer and registration are imported as source evidence. Existing legions, roles, battle attendance and manual profile values are preserved.'};
}
export function applyTalSheetSnapshot(data,sheet,now=new Date().toISOString()){
  const preview=talSheetPreview(data,sheet),parsed=talRows(sheet);
  if(data.talPlan?.locked)throw Error('Unlock the TAL plan before importing spreadsheet changes.');
  const players=[...(data.players||[])],byId=existingById(players);
  const current={...newPlan(),...(data.talPlan||{})};
  const records={...(current.records||{})};
  let added=0,updated=0;
  for(const row of parsed.safe){
    const fid=norm(row['Player ID']),prior=byId.get(fid);
    const p=prior?{...prior}:{...newPlayer({id:'sheet:'+fid,fid,username:norm(row.Username),allianceTag:norm(row['Home Alliance'])})};
    // Only seed fields on new profiles. Never downgrade stronger API or manual observations.
    if(!prior){
      const score=asNumber(row.Power);
      if(score!==null)p.power=score;
      const furnace=norm(row['Furnace level']);if(furnace)p.furnaceLevel=furnace;
      added++;players.push(p);byId.set(fid,p);
    }else updated++;
    p.importedSheet={...p.importedSheet,...sheetField(row),importedAt:now};
    const language=norm(row.Language);
    if(language){
      p.sheetLanguage=language; // Spreadsheet observation, not verified spoken fluency.
      if(!p.languages?.some(x=>key(x)===key(language)))p.languages=[...(p.languages||[]),language];
    }
    if(prior){const index=players.findIndex(v=>v.id===p.id);players[index]=p;}
    const old=records[p.id]||{};
    const evidence=sourceRecord(row),times=timeValues(row);
    records[p.id]={...old,...evidence,sheetAvailability:times, sheetPollStatus:norm(row['Poll status']),
      sheetProposedLegion:norm(row['Assigned Legion']),sheetTalAlliance:norm(row['TAL Alliance']),
      // Never overwrite a manually changed attendance status or time selection.
      ...(!old.status?{status:times.length?'available':'pending',times}:{}),
    };
  }
  const plan={...current,records};
  return {...data,players,talPlan:plan,settings:{...data.settings,stateId:'3573',
    sheetImport:{url:TAL_SHEET_URL,title:'TAL Nov-4',importedAt:now,readAt:sheet.readAt,
      summary:{sourceRows:preview.total,selected:parsed.safe.filter(r=>key(r.Selection)==='selected').length,
      sourceRegistrationsVerified:parsed.safe.filter(r=>key(r.Registration)==='verified').length,
      newPlayers:preview.newPlayers,skipped:preview.invalid.length},
      issues:preview.invalid}}};
}
