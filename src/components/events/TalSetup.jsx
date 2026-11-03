import { C } from '../../utils/constants.js';
import { Field } from '../common/Primitives.jsx';
import { AlliancePicker } from '../common/AlliancePicker.jsx';
import { talConfig } from '../../services/talPlanner.js';
export function TalSetup({ ev, onChange, tags }) {
  const config = talConfig(ev);
  const update = patch => onChange({ ...ev, tal:{ ...config, ...patch } });
  return <>
    <Field label="Who is this event for?">
      <div style={{ display:'flex', gap:8 }}>{[['state','State Alliance'],['solo','Solo Alliance']].map(([mode,label]) => <button key={mode} onClick={() => update({ mode, hostTags:config.hostTags.slice(0,mode==='solo'?1:3), teams:[] })} style={{ flex:1, minHeight:48, fontSize:16, borderRadius:12, background:C.section, color:config.mode===mode?C.gold:C.icy, border:`1px solid ${config.mode===mode?C.gold:C.border}` }}>{label}</button>)}</div>
      <p style={{ color:C.icy, fontSize:14 }}>{config.mode==='state'?'Choose players from any home alliance in this state. Host alliances are where they register in game.':'Only players in the chosen alliance can be selected.'}</p>
    </Field>
    <Field label={config.mode==='state'?'Host alliances · choose up to 3':'Participating alliance · choose 1'} hint="Each host can register Legion 1 and, if unlocked in game, Legion 2. Changing hosts clears the draft teams.">
      <AlliancePicker multi value={config.hostTags} existingTags={tags} onChange={hostTags => update({ hostTags:hostTags.slice(0,config.mode==='solo'?1:3), teams:[] })} />
    </Field>
  </>;
}
