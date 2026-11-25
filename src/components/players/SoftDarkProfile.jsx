import {EVENT_NAMES,attendanceLabel,formatPlannerPower} from '../../services/eventPlanner.js';
import {useEffect, useRef, useState} from 'react';
import {ALLIANCE_RANKS} from '../../utils/constants.js';
import {verifiedMembershipTime} from '../../services/rosterViewService.js';
import {providerField} from '../../services/gameLanguageService.js';
import {latestTroopPowers} from '../../services/rosterExportRows.js';
import {lastProfileLocation} from '../../services/profileLocation.js';
import {PlayerAvatar} from './PlayerAvatar.jsx';
import {CopyPlayerId} from './CopyPlayerId.jsx';
import {ProfileSection, ProfileRow} from './ProfileParts.jsx';
import {ProfileTroops} from './ProfileTroops.jsx';
import {ProfileIdentity} from './ProfileIdentity.jsx';
import {ProfileJoiners} from './ProfileJoiners.jsx';
import {ProfileTeamwork} from './ProfileTeamwork.jsx';
import {ProfileNotes} from './ProfilePlanning.jsx';
import {RecordedActivity} from './RecordedActivity.jsx';
import {PlayerHistorySection} from './PlayerHistorySection.jsx';
import {PlayerEquipmentSection} from './PlayerEquipmentSection.jsx';
import {PlayerRankingsSection} from './PlayerRankingsSection.jsx';
import './SoftDarkProfile.css';

const compact = new Intl.NumberFormat('en', {notation:'compact', maximumFractionDigits:1});
const whole = new Intl.NumberFormat('en', {maximumFractionDigits:0});
const shortDate = new Intl.DateTimeFormat('en-NZ', {day:'numeric', month:'short', timeZone:'UTC'});
const movementDate = new Intl.DateTimeFormat('en-NZ', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function profileAge(raw, now = Date.now()) {
  const time = typeof raw === 'number' ? raw : Date.parse(raw || '');
  if (!Number.isFinite(time) || time <= 0 || time > now) return '';
  const seconds = Math.floor((now - time) / 1000);
  for (const [unit, duration] of [['day',86400], ['hour',3600], ['minute',60]]) {
    const count = Math.floor(seconds / duration);
    if (count) return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

function Stats({items, events = false}) {
  return <div className={`soft-profile-stats${events ? ' event-stats' : ''}`}>
    {items.map(([label, raw, timestamp]) => {
      const value = number(raw);
      const rank = label === 'Lab rank';
      const formatter = rank || label === 'Lab score' ? whole : compact;
      return <div key={label}>
        <span>{label}</span>
        <strong data-missing={value === null || undefined} title={value === null ? undefined : String(value)}>
          {value === null ? 'Not recorded' : events ? formatPlannerPower(value,label==='Canyon Clash'?'canyon':'foundry') : (rank ? '#' : '') + formatter.format(value)}
        </strong>
        {events && value !== null && <small>{profileAge(timestamp) || 'Date not recorded'}</small>}
      </div>;
    })}
  </div>;
}

function eventPowers(player, events, talRecord) {
  const latest = latestTroopPowers(player, events);
  const savedTalPower = player.lastTalTroopPower ?? player.lastTALTroopPower;
  const savedTalTime = player.lastTalTroopPowerAt ?? player.lastTALTroopPowerAt;
  const planTalTime = talRecord?.troopPowerRecordedAt;
  const usePlan = number(talRecord?.troopPower) !== null && (number(savedTalPower) === null ||
    (Date.parse(planTalTime) || 0) > (Date.parse(savedTalTime) || 0));
  return [
    ['Foundry','foundry',player.lastFoundryTroopPower,player.lastFoundryTroopPowerAt],
    ['TAL','tal',usePlan ? talRecord.troopPower : savedTalPower,usePlan ? planTalTime : savedTalTime],
    ['Canyon Clash','canyon',player.lastCanyonClashTroopPower ?? player.lastCanyonTroopPower,player.lastCanyonClashTroopPowerAt ?? player.lastCanyonTroopPowerAt],
  ].map(([label, key, value, at]) => {
    const record = latest[key];
    const directTime = Date.parse(at || '');
    return record && (number(value) === null || !Number.isFinite(directTime) || record.time > directTime)
      ? [label, record.power, record.time] : [label, value, at];
  });
}

function Location({location}) {
  const [feedback,setFeedback] = useState('');
  const available = number(location?.x) !== null && number(location?.y) !== null;
  const coordinates = available ? `X: ${Number(location.x)} · Y: ${Number(location.y)}` : '';
  const age = profileAge(location?.observedAt);
  async function copy() {
    try {await navigator.clipboard.writeText(coordinates);setFeedback('Copied');}
    catch {setFeedback('Copy unavailable. Select the coordinates to copy.');}
  }
  return <ProfileSection title="Last known location">
    {available ? <div className="soft-profile-row"><div><strong>{coordinates}</strong><p className="soft-profile-muted">{age ? 'Seen ' + age : 'Observation time not recorded'}</p></div><button type="button" className="soft-profile-button" aria-label="Copy coordinates" onClick={copy}>Copy</button></div>
      : <p className="soft-profile-muted">Not recorded</p>}
    {feedback && <p className="soft-profile-muted" role="status">{feedback}</p>}
  </ProfileSection>;
}

function Movements({history = []}) {
  const moves = history.filter(move => move && move.from !== move.to)
    .sort((a,b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).slice(0,4);
  return <ProfileSection title="Last 4 alliance movements">
    {moves.length ? moves.map((move,index) => {
      const date = new Date(move.at || NaN);
      const valid = Number.isFinite(date.getTime());
      return <div className="soft-profile-row soft-profile-divider" key={move.id || index}>
        <span>{move.from || 'No Alliance'} → {move.to || 'No Alliance'}</span>
        <time dateTime={valid ? date.toISOString() : undefined} title={valid ? movementDate.format(date) : undefined}>{valid ? shortDate.format(date) : 'Date not recorded'}</time>
      </div>;
    }) : <p className="soft-profile-muted">Not recorded</p>}
  </ProfileSection>;
}

function More({player,onSave,canFetchEquipment}) {
  const activity = providerField(player,'last_active_at');
  const ranks = {...player.providerRankings};
  const details = {...player.providerDetails?.ranks};
  delete ranks.labyrinth;
  delete details.labyrinth;
  delete details.labyrinth_rank;
  const readings=Object.values(player.plannerPowerReadings||{}).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  const attendance=Object.values(player.plannerAttendance||{}).sort((a,b)=>b.startAt.localeCompare(a.startAt));
  const utc=at=>Number.isFinite(Date.parse(at))?new Date(at).toISOString().slice(0,16).replace('T',' ')+' UTC':'Date not recorded';
  return <ProfileSection title="More">
    <details><summary>Power history</summary><PlayerHistorySection player={player}/>
      {readings.map((row,index)=><ProfileRow key={index} label={EVENT_NAMES[row.kind]+' · '+utc(row.at)} value={formatPlannerPower(row.value,row.kind)}/>)}
    </details>
    {attendance.length>0&&<details><summary>Event attendance</summary>{attendance.map((row,index)=><div key={index} className="soft-profile-row soft-profile-divider">
      <span>{EVENT_NAMES[row.kind]} · {row.alliance} · Legion {row.legion}<br/><small>{utc(row.startAt)}</small></span>
      <span>{row.role==='sub'?'Substitute':'Combatant'}<br/>{attendanceLabel(row.result)}</span>
    </div>)}</details>}
    <details><summary>Kills &amp; activity</summary>
      <ProfileRow label="Kills" value={number(player.kills ?? player.providerStats?.kills)?.toLocaleString() ?? 'Not recorded'}/>
      {activity != null ? <RecordedActivity value={activity}/> : <ProfileRow label="Last known activity" value="Not recorded"/>}
    </details>
    <details><summary>Heroes &amp; gear</summary>
      {[
        ['Total hero power', player.totalHeroPower ?? player.heroesTotalPower ?? providerField(player,'heroes_total_power')],
        ['Total pet power', player.totalPetPower ?? providerField(player,'pet_total_power')],
        ['Total expert power', player.totalExpertPower ?? providerField(player,'expert_total_power')],
      ].map(([name,raw]) => <ProfileRow key={name} label={name} value={number(raw)?.toLocaleString() ?? 'Not recorded'}/>)}
      <fieldset disabled={!onSave}><PlayerEquipmentSection player={player} onSave={canFetchEquipment ? onSave : undefined}/></fieldset>
    </details>
    <details><summary>Other rankings</summary><PlayerRankingsSection player={{...player,providerRankings:ranks,providerDetails:{...player.providerDetails,ranks:details}}}/></details>
  </ProfileSection>;
}

export function SoftDarkProfile({player,onClose,events = [],onSave,players,teamworkPreferences,onSaveTeamworkPreferences,canFetchEquipment=true,talRecord}) {
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const sheet = panel.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet.focus({preventScroll:true});
    function handleKey(event) {
      if (event.key === 'Escape') {event.preventDefault();close.current();}
      if (event.key !== 'Tab') return;
      const controls = [...sheet.querySelectorAll('button,input,select,textarea,summary,a[href]')]
        .filter(el => !el.matches(':disabled') && el.getClientRects().length && !el.closest('details:not([open]) :not(summary)'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && [first,sheet].includes(document.activeElement)) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
    }
    sheet.addEventListener('keydown',handleKey);
    return () => {
      document.body.style.overflow = overflow;
      sheet.removeEventListener('keydown',handleKey);
      previous?.focus();
    };
  },[]);
  const name = player.username || player.alias || 'Unknown';
  const verified = profileAge(verifiedMembershipTime(player));
  const lab = player.providerRankings?.labyrinth;
  return <div className="soft-profile-backdrop" onClick={onClose}>
    <section className="soft-profile" role="dialog" aria-modal="true" aria-label={`Player profile: ${name}`} ref={panel} tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header className="soft-profile-header">
        <PlayerAvatar player={player} size={37} color="#a7cdfa"/>
        <div className="soft-profile-name"><h2>{name}</h2><span>{[player.allianceTag || (verified ? 'No Alliance' : ''),player.furnaceLevel].filter(Boolean).join(' · ')}</span></div>
        <CopyPlayerId fid={player.fid} compact/>
        <button type="button" className="soft-profile-close" aria-label="Close profile" onClick={onClose}>×</button>
        <p className="soft-profile-muted">{verified ? 'Membership verified ' + verified : 'Membership not verified'}</p>
      </header>
      <div className="soft-profile-body">
        <ProfileTroops player={player} onSave={onSave} softDark tierAge={profileAge(player.troopTiersChangedAt)}/>
        <ProfileSection title="Quick stats"><Stats items={[
          ['City power', player.power ?? player.cityPower ?? player.providerStats?.power],
          ['Lab score', lab?.score ?? player.providerDetails?.ranks?.labyrinth],
          ['Lab rank', lab?.rank ?? player.providerDetails?.ranks?.labyrinth_rank],
        ]}/></ProfileSection>
        <ProfileSection title="Last recorded event power"><Stats events items={eventPowers(player,events,talRecord)}/></ProfileSection>
        <Location location={lastProfileLocation(player)}/>
        <ProfileSection title="Alliance rank">
          <div className="soft-profile-ranks">{ALLIANCE_RANKS.map(rank => <button key={rank} type="button" className="soft-profile-button" aria-pressed={player.allianceRank === rank} disabled={!onSave} onClick={() => onSave({...player,allianceRank:player.allianceRank === rank ? null : rank})}>{rank}</button>)}</div>
        </ProfileSection>
        <Movements history={player.allianceHistory}/>
        <ProfileIdentity player={player} onSave={onSave} softDark/>
        <ProfileJoiners player={player} onSave={onSave} softDark/>
        <ProfileTeamwork player={player} players={players} preferences={teamworkPreferences} onSavePreferences={onSaveTeamworkPreferences} softDark/>
        <ProfileNotes player={player} onSave={onSave} softDark/>
        <More player={player} onSave={onSave} canFetchEquipment={canFetchEquipment}/>
      </div>
    </section>
  </div>;
}
