import { C } from '../../utils/constants.js';
import { vibe } from '../../utils/vibe.js';
import { matchNamesToPlayers, findCloseMatches, parseNames } from '../../utils/nameList.js';
import { noShowStreak, noShowBadge } from '../../services/eventListHelpers.js';

function VerifyRow({ player, activeEvent, events, confirmed, onToggle, lc }) {
  const dn = player.username||player.alias||'Unknown';
  const streak = noShowStreak(player.id, activeEvent.type, activeEvent.id, events);
  const heart = noShowBadge(streak);
  return (
    <div onClick={() => { onToggle(player.id, confirmed); vibe(6); }}
      style={{ background:confirmed?C.green+'14':C.card, borderRadius:12, padding:'18px 20px', marginBottom:12, minHeight:64, display:'flex', alignItems:'center', gap:16, cursor:'pointer', border:`1.5px solid ${confirmed?C.green+'66':(lc?lc+'44':C.border+'44')}`, WebkitTapHighlightColor:'transparent' }}>
      <div style={{ width:38, height:38, borderRadius:'50%', border:`2.5px solid ${confirmed?C.green:C.border}`, background:confirmed?C.green:'none', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {confirmed && <span style={{ fontSize:18, color:C.bg, fontWeight:700 }}>✓</span>}
      </div>
      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ fontSize:18, fontWeight:700, color:confirmed?C.green:C.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{dn}</div>
        {heart && <span title={`${streak} consecutive ${activeEvent.type} no-shows`} style={{ fontSize:13, flexShrink:0 }}>{heart}</span>}
      </div>
    </div>
  );
}

// Props:
//   participantsList, activeEvent, events
//   confirmedIds, setConfirmedIds           – tap-through sub-mode state
//   verifyInputMode, setVerifyInputMode     – 'tap' | 'paste'
//   verifyPasteText, setVerifyPasteText     – paste sub-mode state
//   lc                                      – this event's Legion color
export function VerifyRosterPanel({
  participantsList, activeEvent, events,
  confirmedIds, setConfirmedIds,
  verifyInputMode, setVerifyInputMode,
  verifyPasteText, setVerifyPasteText,
  lc,
}) {
  function toggleConfirmed(playerId, confirmed) {
    setConfirmedIds(prev => {
      const n = new Set(prev);
      confirmed ? n.delete(playerId) : n.add(playerId);
      return n;
    });
  }

  return (
    <>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <button onClick={() => setVerifyInputMode('tap')} style={{ flex:1, height:34, borderRadius:16, background:verifyInputMode==='tap'?C.gold+'22':C.section, border:`1px solid ${verifyInputMode==='tap'?C.gold:C.border}`, color:verifyInputMode==='tap'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>👆 Tap through</button>
        <button onClick={() => setVerifyInputMode('paste')} style={{ flex:1, height:34, borderRadius:16, background:verifyInputMode==='paste'?C.gold+'22':C.section, border:`1px solid ${verifyInputMode==='paste'?C.gold:C.border}`, color:verifyInputMode==='paste'?C.gold:C.muted, fontWeight:600, fontSize:12, cursor:'pointer' }}>📋 Paste to check</button>
      </div>

      {verifyInputMode === 'paste' ? (() => {
        const pastedNames = parseNames(verifyPasteText);
        const { matched, unmatched: exactUnmatched } = matchNamesToPlayers(verifyPasteText, participantsList);
        const matchedIds = new Set(matched.map(p => p.id));
        // Names that didn't exact-match get one more pass against
        // whoever's still unmatched, to catch a likely typo rather
        // than call it a true "extra" name the app has never heard of.
        const remainingPool = participantsList.filter(p => !matchedIds.has(p.id));
        const closeFlags = [];
        const trueExtras = [];
        exactUnmatched.forEach(name => {
          const pool = remainingPool.filter(p => !closeFlags.some(cf => cf.player.id === p.id));
          const close = findCloseMatches(name, pool);
          if (close.length > 0) closeFlags.push({ name, player: close[0].player });
          else trueExtras.push(name);
        });
        const closePlayerIds = new Set(closeFlags.map(cf => cf.player.id));
        const missingFromPaste = remainingPool.filter(p => !closePlayerIds.has(p.id));
        const allClear = pastedNames.length > 0 && missingFromPaste.length === 0 && closeFlags.length === 0 && trueExtras.length === 0;

        return (
          <>
            <div style={{ background:C.gold+'14', border:`1px solid ${C.gold}55`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:C.white }}>
              🔒 Paste the in-game participant list — one name per line or comma separated. Both directions get flagged: who's missing, and who's extra.
            </div>
            <textarea
              value={verifyPasteText}
              onChange={e => setVerifyPasteText(e.target.value)}
              placeholder="Paste the in-game list here…"
              rows={4}
              style={{ width:'100%', background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:14, color:C.white, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical', marginBottom:14 }}
            />
            {allClear && (
              <div style={{ fontSize:13, color:C.green, fontWeight:600 }}>✓ Lists match — no differences found.</div>
            )}
            {missingFromPaste.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.red, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                  ⚠ In app, not seen in-game · {missingFromPaste.length}
                </div>
                {missingFromPaste.map(p => (
                  <div key={p.id} style={{ background:C.red+'14', border:`1px solid ${C.red}44`, borderRadius:10, padding:'12px 16px', marginBottom:8, fontSize:15, fontWeight:600, color:C.white }}>
                    {p.username||p.alias}
                  </div>
                ))}
              </div>
            )}
            {closeFlags.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.gold, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                  ≈ Possible typo · {closeFlags.length}
                </div>
                {closeFlags.map((cf,i) => (
                  <div key={i} style={{ background:C.gold+'14', border:`1px solid ${C.gold}44`, borderRadius:10, padding:'12px 16px', marginBottom:8, fontSize:13, color:C.white }}>
                    "{cf.name}" in your paste looks like <strong>{cf.player.username||cf.player.alias}</strong>
                  </div>
                ))}
              </div>
            )}
            {trueExtras.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.icy, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                  ⚠ In-game, not tracked in app · {trueExtras.length}
                </div>
                {trueExtras.map((n,i) => (
                  <div key={i} style={{ background:C.icy+'14', border:`1px solid ${C.icy}44`, borderRadius:10, padding:'12px 16px', marginBottom:8, fontSize:15, fontWeight:600, color:C.white }}>
                    {n}
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })() : (() => {
        const unconfirmed = participantsList.filter(p => !confirmedIds.has(p.id));
        const confirmedPlayers = participantsList.filter(p => confirmedIds.has(p.id));
        return (
          <>
            <div style={{ background:C.gold+'14', border:`1px solid ${C.gold}55`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:C.white }}>
              🔒 Tap a name as you find them in-game — it moves down to Confirmed.
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
              Unconfirmed · {unconfirmed.length}
            </div>
            {unconfirmed.length === 0
              ? <div style={{ fontSize:13, color:C.green, marginBottom:16 }}>✓ Everyone confirmed.</div>
              : unconfirmed.map(p => <VerifyRow key={p.id} player={p} activeEvent={activeEvent} events={events} confirmed={false} onToggle={toggleConfirmed} lc={lc} />)}
            {confirmedPlayers.length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'0.07em', marginTop:16, marginBottom:8 }}>
                  ✓ Confirmed · {confirmedPlayers.length}
                </div>
                {confirmedPlayers.map(p => <VerifyRow key={p.id} player={p} activeEvent={activeEvent} events={events} confirmed={true} onToggle={toggleConfirmed} lc={lc} />)}
              </>
            )}
          </>
        );
      })()}
    </>
  );
}
