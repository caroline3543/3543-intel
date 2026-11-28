import { createBulkCandidateSearch, normaliseBulkName } from '../components/bulkImportModel.js';
import { eventAssignments, isParticipant, plannerSlot, prepareEventRoles, suspiciousPowerChange } from '../../../src/services/eventPlanner.js';

export const roleName = role => ({ join: 'Combatant', sub: 'Substitute', out: 'Not participating', '': 'Unassigned' })[role] ?? 'Unassigned';
export const assignmentLabel = assignment => assignment
  ? [assignment.alliance, 'Legion ' + assignment.legion, roleName(assignment.role)].join(' · ')
  : 'Unassigned';

const exactName = value => String(value ?? '').replace(/[\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu, '').trim().normalize('NFC');
const nicknamesOf = player => [...new Set([player.nickname, player.alias, ...(Array.isArray(player.ocrAliases) ? player.ocrAliases : [])].filter(value => typeof value === 'string' && value.trim()))];
const playerFields = player => [player.name, ...nicknamesOf(player), player.playerId, player.fid, player.id, ...(player.searchFields ?? [])];

const spacingKey=value=>exactName(value).normalize('NFKC').toLowerCase().replace(/\s/gu,'');
const visualKey=value=>normaliseBulkName(exactName(value)).replace(/0/g,'o').replace(/[1l]/g,'i');
// OCR-specific equivalences are evidence for review, never independent identity proof.
const decorativeKey=value=>normaliseBulkName(exactName(value).normalize('NFKC').replace(/[Ξξ=]/gu,'e').replace(/ı/gu,'i').replace(/[¥]/gu,'y'));
export function createScreenshotMatcher(players,alliance,preferredIds=[],registeredIds=[]){
  const preferred=new Set(preferredIds),registered=new Set(registeredIds);
  const eligible=p=>p.alliance===alliance||preferred.has(p.id)||registered.has(p.id);
  const local=players.filter(p=>preferred.has(p.id)||p.alliance===alliance);
  const rank=p=>registered.has(p.id)?0:preferred.has(p.id)?1:p.alliance===alliance?2:3;
  // Collapse identity evidence only when the destination record is unambiguous.
  // Never use a game FID as a writable workspace record ID.
  const groups=new Map();
  for(const p of players){
    const fid=String(p.fid??'').trim();
    if(!/^\d+$/.test(fid)||/^0+$/.test(fid))continue;
    if(!groups.has(fid))groups.set(fid,[]);
    groups.get(fid).push(p);
  }
  const representatives=new Map();
  for(const group of groups.values()){
    const eligible=group.filter(p=>p.alliance===alliance||preferred.has(p.id)||registered.has(p.id));
    if(eligible.length===1)for(const p of group)representatives.set(p.id,eligible[0]);
  }
  const indexes=[new Map(),new Map(),new Map(),new Map(),new Map(),new Map(),new Map()];
  const add=(map,key,p)=>{if(!key)return; if(!map.has(key))map.set(key,new Map());const target=representatives.get(p.id)??p;map.get(key).set(target.id,target);};
  for(const p of players){
    for(const field of playerFields(p)){add(indexes[0],exactName(field),p);add(indexes[1],normaliseBulkName(exactName(field)),p);add(indexes[2],visualKey(field),p);}
    add(indexes[3],spacingKey(p.name),p);
    add(indexes[4],normaliseBulkName(exactName(p.name)),p);
    add(indexes[5],visualKey(p.name),p);
    add(indexes[6],decorativeKey(p.name),p);
  }
  const get=(i,key)=>[...(indexes[i].get(key)?.values()??[])];
  const nicknameIndex=new Map();
  const decorativeNicknameIndex=new Map();
  for(const p of players)for(const alias of nicknamesOf(p)){add(nicknameIndex,spacingKey(alias),p);add(decorativeNicknameIndex,decorativeKey(alias),p);}
  const cache=new Map();
  // Most imports are exact. Build the suggestion indexes only when review needs them.
  let findLocal,findWider;
  return function match(name,{fid,source='screenshot'}={}){
    name=exactName(name);
    if(fid){
      const records=groups.get(String(fid))??[];
      const destinations=[...new Map(records.map(p=>{const target=representatives.get(p.id)??p;return [target.id,target];})).values()];
      const byName=match(name,{source});
      const candidate=destinations.length===1&&eligible(destinations[0])?destinations[0]:null;
      // Require corroboration when explicit ID and name provide conflicting or incomplete evidence.
      const player=candidate&&byName.player?.id===candidate.id?candidate:null;
      return {player,suggested:null,candidates:[...new Map([...destinations,...byName.candidates].map(p=>[p.id,p])).values()].slice(0,8),idConflict:!player};
    }
    if(!name)return {candidates:[],player:null};
    const cacheKey=source+'\0'+name;
    if(cache.has(cacheKey))return cache.get(cacheKey);
    const exact=get(0,exactName(name)),equivalent=get(1,normaliseBulkName(name)),lookalikes=get(2,visualKey(name)),strict=get(3,spacingKey(name));
    const selected=exact.length===1?exact[0]:exact.length===0&&strict.length===1?strict[0]:null;
    const current=strict.length===1?strict[0]:null;
    const nicknameCollision=p=>nicknamesOf(p).some(alias=>[exactName,normaliseBulkName,visualKey,spacingKey,decorativeKey].some(key=>key(alias)&&key(alias)===key(name)));
    const currentSafe=current&&eligible(current)&&get(4,normaliseBulkName(name)).length===1&&get(5,visualKey(name)).length===1&&[...exact,...equivalent,...lookalikes].every(p=>p.id===current.id||(!eligible(p)&&!nicknameCollision(p)));
    const legacySafe=selected&&(selected.alliance===alliance||preferred.has(selected.id)||registered.has(selected.id))&&equivalent.length===1&&equivalent[0].id===selected.id&&lookalikes.length===1;
    const decorative=[...new Map([...get(6,decorativeKey(name)),...(decorativeNicknameIndex.get(decorativeKey(name))?.values()??[])].map(p=>[p.id,p])).values()];
    const nicknames=[...(nicknameIndex.get(spacingKey(name))?.values()??[])];
    const nickname=nicknames.length===1&&eligible(nicknames[0])&&[...exact,...equivalent,...lookalikes,...strict,...decorative].every(p=>p.id===nicknames[0].id)?nicknames[0]:null;
    const proposed=currentSafe?current:legacySafe?selected:nickname;
    const automatic=proposed&&decorative.every(p=>p.id===proposed.id)&&nicknames.every(p=>p.id===proposed.id)?proposed:null;
    const safe=!!automatic;
    const wider=safe?[]:(findWider??=createBulkCandidateSearch(players,alliance))(name);
    const localSuggestions=safe?[]:(local.length===players.length?[...wider]:(findLocal??=createBulkCandidateSearch(local,alliance))(name)).sort((a,b)=>rank(a)-rank(b));
    const candidates=[...new Map([...(automatic?[automatic]:[]),...exact,...strict,...nicknames,...decorative,...equivalent,...lookalikes,...localSuggestions,...wider].map(p=>[p.id,p])).values()].slice(0,8);
    const suggested=source!=='paste'&&!safe&&equivalent.length===1&&lookalikes.length===1&&equivalent[0].id===lookalikes[0].id&&preferred.has(equivalent[0].id)&&normaliseBulkName(name).length>=4?equivalent[0]:null;
    const result={candidates,player:automatic,suggested};cache.set(cacheKey,result);return result;
  };
}
export function screenshotMatches(name,players,alliance){return createScreenshotMatcher(players,alliance)(name);}

export { suspiciousPowerChange };

export function prepareScreenshotImport(storage, context, rows, mode) {
  const { kind, alliance, legion, expectedOccurrenceId } = context;
  const target = plannerSlot(storage, kind, alliance, legion);
  if (target.occurrenceId !== expectedOccurrenceId) return { error: 'The selected event changed. Scan again for the current event.' };
  if (!['powers', 'roles', 'both'].includes(mode)) return { error: 'Choose an import mode.' };
  if (new Set(rows.map(row => row.id)).size !== rows.length) return { error: 'Each player can be confirmed once per legion.' };
  const assignments = eventAssignments(storage, kind);
  const powers = [], roleChanges = [], changes = [];
  for (const row of rows) {
    if (mode !== 'roles' && row.power !== null) {
      if (!Number.isSafeInteger(row.power) || row.power < 0) return { error: 'Enter a valid troop power.' };
      const previousPower = target.powerByPlayer?.[row.id] ?? row.previousPower;
      if (suspiciousPowerChange(previousPower, row.power) && (row.powerApproval?.previous !== previousPower || row.powerApproval?.next !== row.power)) return { error: 'Confirm the unusually large troop power change before importing.' };
      if (previousPower !== row.power) {
        powers.push({ id: row.id, value: row.power, ...(row.powerApproval ? {powerApproval:row.powerApproval} : {}) });
        changes.push({ id: row.id, name: row.name, power: row.power, previousPower });
      }
    }
    const expectedRole = target.registrations[row.id] || '';
    if (mode === 'powers' || row.role == null || row.role === expectedRole) continue;
    const elsewhere = (assignments.get(row.id) ?? []).filter(item => item.alliance !== alliance || item.legion !== legion);
    const moveFrom = isParticipant(row.role) ? elsewhere[0] : undefined;
    const before = moveFrom ?? (expectedRole ? { alliance, legion, role: expectedRole } : null);
    const after = { alliance, legion, role: row.role };
    roleChanges.push({ id: row.id, role: row.role, expectedRole, ...(moveFrom ? { moveFrom } : {}) });
    changes.push({ id: row.id, name: row.name, before, after, destructive: Boolean(moveFrom || !row.role || (row.alliance && row.alliance !== alliance)) });
  }
  if (roleChanges.length) {
    const { error } = prepareEventRoles(storage, context, roleChanges);
    if (error) return { error };
  }
  if (!powers.length && !roleChanges.length) return { error: 'Choose at least one change to import.' };
  return { changes, action: { ...context, powers, ...(roleChanges.length ? { roleChanges } : {}), screenshotImport: true } };
}

export function proposeScreenshotRegistration({row,player,here,elsewhere,alliance,edit={},mode}){
  const detectedRole={combatant:'join',substitute:'sub'}[row.registration];
  const safeNew=player&&player.alliance===alliance&&detectedRole&&!here&&!elsewhere&&!row.conflict;
  const safeUnchanged=player&&!row.conflict&&((detectedRole&&here===detectedRole&&!elsewhere)||(row.registration==='other-legion'&&!here)||(row.registration==='unassigned'&&!here));
  const proposedRole=edit.registrationReviewed||edit.role!=null ? (edit.role==='remove'?'':edit.role||null) : safeNew?detectedRole:null;
  return {proposedRole,registrationPending:mode!=='powers'&&!edit.registrationReviewed&&(!safeNew&&!safeUnchanged||!!edit.role)};
}
