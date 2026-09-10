import { useState } from 'react';
import { C } from '../../utils/constants.js';

/**
 * AlliancePicker
 *
 * Shared component for selecting or typing an alliance tag.
 * Used in: PlayerSheet, BatchAddSheet, EventSheet.
 *
 * Props:
 *   value          — current alliance tag string (multi=false), or
 *                    array of tags (multi=true)
 *   onChange       — (tag: string) => void  (multi=false)
 *                    (tags: string[]) => void  (multi=true)
 *   existingTags   — array of tags already in the roster/events (shown as chips)
 *   placeholder    — input placeholder text
 *   multi          — false (default): single-select, tapping a chip
 *                    replaces the value, exactly the original behavior.
 *                    true: multi-select — tapping a chip toggles it in
 *                    or out of the array, and typing a custom tag needs
 *                    an explicit Add (there's no single "current value"
 *                    to just overwrite by typing). Only EventSheet uses
 *                    multi so far — PlayerSheet and BatchAddSheet are
 *                    unaffected since they don't pass this prop.
 */

// Default quick-select chips — shown when no existing tags are available
const DEFAULT_CHIPS = [];

export function AlliancePicker({ value, onChange, existingTags = [], placeholder = 'Or type a custom tag…', multi = false }) {
  const [inputVal, setInputVal] = useState('');
  const selectedArr = multi ? (value || []) : [];

  // Merge default chips with any existing tags from the roster, PLUS
  // (multi mode only) any already-selected custom tags that aren't in
  // existingTags yet — so a freshly-typed alliance shows as a selected
  // chip immediately instead of only existing as raw array data.
  const allChips = [...new Set([...DEFAULT_CHIPS, ...existingTags, ...selectedArr])].filter(Boolean);

  function select(tag) {
    if (multi) {
      onChange(selectedArr.includes(tag) ? selectedArr.filter(t => t !== tag) : [...selectedArr, tag]);
      return;
    }
    // Tapping the selected chip deselects it
    onChange(value === tag ? '' : tag);
  }

  function handleInput(v) {
    setInputVal(v);
    if (!multi) onChange(v.toUpperCase());
  }

  function commitCustomTag() {
    const tag = inputVal.trim().toUpperCase();
    if (!tag) return;
    if (!selectedArr.includes(tag)) onChange([...selectedArr, tag]);
    setInputVal('');
  }

  return (
    <div>
      {/* Quick-select chips — sized up (was 40px min) since these are
          easy to mis-tap on a phone, especially now that multi-select
          means several taps in a row instead of one. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {allChips.map(tag => {
          const selected = multi ? selectedArr.includes(tag) : value === tag;
          return (
            <button
              key={tag}
              onClick={() => { select(tag); if (!multi) setInputVal(''); }}
              style={{
                padding: '10px 16px',
                borderRadius: 20,
                minHeight: 44,
                border: `1px solid ${selected ? C.gold : C.border}`,
                background: selected ? C.gold + '22' : C.section,
                color: selected ? C.gold : C.muted,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {selected ? '✓ ' : ''}{tag}
            </button>
          );
        })}
      </div>

      {/* Free-text entry for custom tags. Multi mode needs an explicit
          Add action (Enter or the button) since there's no single
          "current value" for typing to just overwrite. */}
      {multi ? (
        <div style={{ display:'flex', gap:8 }}>
          <input
            value={inputVal}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitCustomTag(); } }}
            placeholder={placeholder}
            maxLength={8}
            style={{ flex:1, height:44, background:C.section, border:`1px solid ${C.border}`, borderRadius:10, padding:'0 14px', fontSize:16, color:C.white, boxSizing:'border-box', fontFamily:'inherit' }}
          />
          <button
            onClick={commitCustomTag}
            disabled={!inputVal.trim()}
            style={{ height:44, minWidth:64, padding:'0 16px', borderRadius:10, background:inputVal.trim()?C.gold:C.section, border:`1px solid ${inputVal.trim()?C.gold:C.border}`, color:inputVal.trim()?C.bg:C.muted, fontWeight:700, fontSize:14, cursor:inputVal.trim()?'pointer':'default' }}
          >
            Add
          </button>
        </div>
      ) : (
        <input
          value={inputVal || (allChips.includes(value) ? '' : value)}
          onChange={e => handleInput(e.target.value)}
          placeholder={placeholder}
          maxLength={8}
          style={{
            width: '100%',
            background: C.section,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 16,
            color: C.white,
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      )}
      {!multi && value && !allChips.includes(value) && (
        <div style={{ fontSize: 12, color: C.gold, marginTop: 6 }}>
          ✓ Custom tag: [{value}]
        </div>
      )}
      {multi && selectedArr.length > 0 && (
        <div style={{ fontSize: 12, color: C.gold, marginTop: 6 }}>
          ✓ Selected: {selectedArr.map(t => `[${t}]`).join(' ')}
        </div>
      )}
    </div>
  );
}
