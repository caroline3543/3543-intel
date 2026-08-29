import { C } from '../../utils/constants.js';

// ── TroopPowerChart ──────────────────────────────────────────────
// Small hand-rolled SVG line chart — no charting library, consistent
// with this project's "no external UI libraries" rule. Shows one
// player's troop power across events over time.
//
// Props:
//   points – [{ label, value }], already sorted oldest -> newest
export function TroopPowerChart({ points = [] }) {
  if (points.length === 0) return null;

  const W = 320, H = 130, PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 26;
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;

  const values = points.map(p => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values, 0); // always include 0 as a floor for honest scale
  const range = max - min || 1;

  const x = i => PAD_L + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = v => PAD_T + plotH - ((v - min) / range) * plotH;

  const linePoints = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const fmt = v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : String(v);

  const single = points.length === 1;
  const trendUp = !single && points[points.length-1].value >= points[0].value;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
        {/* Y-axis gridlines + labels (min/mid/max) */}
        {[min, min + range/2, max].map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W-PAD_R} y1={y(v)} y2={y(v)} stroke={C.border} strokeWidth="1" opacity="0.4"/>
            <text x={PAD_L-6} y={y(v)+3} fontSize="9" fill={C.muted} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}

        {/* Line */}
        {!single && <polyline points={linePoints} fill="none" stroke={trendUp?C.green:C.red} strokeWidth="2"/>}

        {/* Points + x labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="3.5" fill={single?C.gold:(trendUp?C.green:C.red)}/>
            <text x={x(i)} y={H-6} fontSize="8" fill={C.muted} textAnchor="middle">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
