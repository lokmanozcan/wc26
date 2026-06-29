import React, { useMemo, useState, useCallback } from "react";
import { PROB_METRICS, getTeamTrendSeries } from "./probabilityHistory";

const METRIC_COLORS = {
  r32: "#059669",
  r16: "#0284c7",
  qf: "#d97706",
  sf: "#dc2626",
  f: "#7c3aed",
  champion: "#b45309",
};

const TEAM_PALETTE = [
  "#b45309", "#059669", "#2563eb", "#dc2626", "#7c3aed",
  "#db2777", "#0d9488", "#ea580c", "#4f46e5", "#65a30d",
];

function toggleInSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) {
    if (next.size > 1) next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function smoothPath(points, tension = 0.3) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function computeYDomain(allValues) {
  if (!allValues.length) return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  const span = max - min;
  const pad = span < 3 ? 2 : Math.max(1.5, span * 0.1);
  min = Math.max(0, Math.floor((min - pad) * 2) / 2);
  max = Math.min(100, Math.ceil((max + pad) * 2) / 2);
  if (max - min < 4) {
    const mid = (min + max) / 2;
    min = Math.max(0, Math.round((mid - 2) * 2) / 2);
    max = Math.min(100, Math.round((mid + 2) * 2) / 2);
  }
  const step = max - min <= 10 ? 2 : max - min <= 25 ? 5 : 10;
  const ticks = [];
  for (let t = min; t <= max + 0.01; t += step) ticks.push(Math.round(t * 10) / 10);
  if (!ticks.includes(max)) ticks.push(max);
  return { min, max, ticks };
}

export default function ProbabilityTrend({ snapshots, teams, getFlagUrl }) {
  const teamIds = useMemo(() => Object.keys(teams), [teams]);
  const [selectedTeams, setSelectedTeams] = useState(() => new Set(["ARG"]));
  const [selectedMetrics, setSelectedMetrics] = useState(() => new Set(["champion"]));
  const [hoverIdx, setHoverIdx] = useState(null);

  const sortedSnaps = useMemo(
    () => [...snapshots].sort((a, b) => a.recordedAt - b.recordedAt),
    [snapshots]
  );

  const activeSeries = useMemo(() => {
    const list = [];
    let colorIdx = 0;
    [...selectedTeams].forEach((teamId) => {
      [...selectedMetrics].forEach((metricKey) => {
        const raw = getTeamTrendSeries(sortedSnaps, teamId, metricKey);
        const metricLabel = PROB_METRICS.find((m) => m.key === metricKey)?.label || metricKey;
        const multiTeam = selectedTeams.size > 1;
        const multiMetric = selectedMetrics.size > 1;
        const color = multiTeam && !multiMetric
          ? TEAM_PALETTE[colorIdx % TEAM_PALETTE.length]
          : multiMetric && !multiTeam
            ? METRIC_COLORS[metricKey]
            : TEAM_PALETTE[colorIdx % TEAM_PALETTE.length];
        list.push({
          id: `${teamId}_${metricKey}`,
          teamId,
          metricKey,
          metricLabel,
          label: `${teams[teamId]?.name} · ${metricLabel}`,
          color,
          points: raw,
        });
        colorIdx++;
      });
    });
    return list;
  }, [selectedTeams, selectedMetrics, sortedSnaps, teams]);

  const W = 800;
  const H = 260;
  const pad = { top: 16, right: 16, bottom: 36, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const baseY = pad.top + innerH;

  const snapToX = useCallback(
    (i, total) => {
      if (total <= 1) return pad.left + innerW / 2;
      return pad.left + (i / (total - 1)) * innerW;
    },
    [pad.left, innerW]
  );

  const rawMapped = useMemo(() => {
    const n = sortedSnaps.length;
    return activeSeries.map((s) => ({
      ...s,
      mapped: sortedSnaps.map((snap, i) => {
        const pt = s.points.find((p) => p.id === snap.id);
        const value = pt?.value ?? null;
        return { snapId: snap.id, label: snap.label, value, snapIdx: i, x: snapToX(i, n) };
      }).filter((p) => p.value !== null),
    }));
  }, [activeSeries, sortedSnaps, snapToX]);

  const yDomain = useMemo(() => {
    const vals = rawMapped.flatMap((s) => s.mapped.map((p) => p.value));
    return computeYDomain(vals);
  }, [rawMapped]);

  const valueToY = useCallback(
    (v) => {
      const { min, max } = yDomain;
      const range = max - min || 1;
      return pad.top + innerH - ((v - min) / range) * innerH;
    },
    [yDomain, pad.top, innerH]
  );

  const chartSeries = useMemo(() => {
    return rawMapped.map((s) => {
      const mapped = s.mapped.map((p) => ({ ...p, y: valueToY(p.value) }));
      const linePath = smoothPath(mapped);
      return { ...s, mapped, linePath };
    });
  }, [rawMapped, valueToY]);

  const hasData = chartSeries.some((s) => s.mapped.length > 0);
  const hoverSnap = hoverIdx !== null ? sortedSnaps[hoverIdx] : null;
  const hoverX = hoverIdx !== null ? snapToX(hoverIdx, sortedSnaps.length) : null;

  const chipBtn = (active, color, children, onClick) => (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer",
        fontSize: 10.5, fontWeight: 700,
        background: active ? color : "#f1f5f9",
        color: active ? "#fff" : "#64748b",
        transition: "all 0.12s",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 12, padding: "14px 18px", border: "1px solid rgba(16,185,129,0.15)" }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#10b981", letterSpacing: "0.05em" }}>OLASILIK TRENDİ</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", marginTop: 2 }}>
          {snapshots.length} kayıt · otomatik ölçek
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "monospace" }}>TAKIMLAR</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 72, overflowY: "auto", marginBottom: 12 }}>
          {teamIds.map((id, ti) => chipBtn(
            selectedTeams.has(id),
            TEAM_PALETTE[ti % TEAM_PALETTE.length],
            (<><img src={getFlagUrl(teams[id]?.iso)} style={{ width: 14, height: 10, borderRadius: 2, objectFit: "cover" }} alt="" />{teams[id]?.name}</>),
            () => setSelectedTeams((p) => toggleInSet(p, id))
          ))}
        </div>

        <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "monospace" }}>TUR</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {PROB_METRICS.map((m) => chipBtn(
            selectedMetrics.has(m.key),
            METRIC_COLORS[m.key],
            m.label,
            () => setSelectedMetrics((p) => toggleInSet(p, m.key))
          ))}
        </div>

        {!hasData ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Henüz veri yok.</div>
        ) : (
          <>
            <div
              style={{ position: "relative", borderRadius: 10, background: "#fafbfc", border: "1px solid #f1f5f9", overflow: "hidden" }}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: "100%", height: "auto", maxHeight: 280, display: "block" }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = ((e.clientX - rect.left) / rect.width) * W;
                  const n = sortedSnaps.length;
                  if (n <= 1) { setHoverIdx(0); return; }
                  const ratio = (relX - pad.left) / innerW;
                  setHoverIdx(Math.round(Math.max(0, Math.min(1, ratio)) * (n - 1)));
                }}
              >
                {yDomain.ticks.map((tick) => {
                  const y = valueToY(tick);
                  return (
                    <g key={tick}>
                      <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                      <text x={pad.left - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{tick}%</text>
                    </g>
                  );
                })}

                {chartSeries.map((s) => s.linePath && (
                  <path key={s.id} d={s.linePath} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinecap="round" opacity={hoverIdx !== null ? 0.45 : 1} />
                ))}

                {hoverIdx !== null && chartSeries.map((s) => {
                  const pt = s.mapped.find((p) => p.snapIdx === hoverIdx);
                  if (!pt) return null;
                  return (
                    <path key={`hl-${s.id}`} d={s.linePath} fill="none" stroke={s.color} strokeWidth={2.8} strokeLinecap="round" />
                  );
                })}

                {hoverX !== null && (
                  <line x1={hoverX} y1={pad.top} x2={hoverX} y2={baseY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
                )}

                {hoverIdx !== null && chartSeries.map((s) => {
                  const pt = s.mapped.find((p) => p.snapIdx === hoverIdx);
                  if (!pt) return null;
                  return (
                    <circle key={`dot-${s.id}`} cx={pt.x} cy={pt.y} r={5} fill="#fff" stroke={s.color} strokeWidth={2.5} />
                  );
                })}

                {sortedSnaps.map((snap, i) => (
                  <text
                    key={snap.id}
                    x={snapToX(i, sortedSnaps.length)}
                    y={H - 10}
                    textAnchor="middle"
                    fontSize={8}
                    fill={hoverIdx === i ? "#0f172a" : "#94a3b8"}
                    fontFamily="monospace"
                    fontWeight={hoverIdx === i ? 700 : 500}
                  >
                    {snap.label.length > 12 ? snap.label.slice(0, 10) + "…" : snap.label}
                  </text>
                ))}
              </svg>
            </div>

            {/* Hover detay paneli — her zaman grafik altında, sabit yer */}
            <div style={{
              marginTop: 10,
              minHeight: hoverSnap ? "auto" : 36,
              padding: hoverSnap ? "10px 12px" : "8px 12px",
              borderRadius: 8,
              background: hoverSnap ? "#f0fdf4" : "#f8fafc",
              border: `1px solid ${hoverSnap ? "#bbf7d0" : "#e2e8f0"}`,
              transition: "background 0.15s",
            }}>
              {!hoverSnap ? (
                <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", fontFamily: "monospace" }}>
                  Değerleri görmek için grafiğin üzerine gelin
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#065f46", marginBottom: 8, fontFamily: "monospace" }}>
                    {hoverSnap.label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {chartSeries.map((s) => {
                      const pt = s.mapped.find((p) => p.snapIdx === hoverIdx);
                      if (!pt) return null;
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                            <img src={getFlagUrl(teams[s.teamId]?.iso)} style={{ width: 16, height: 11, borderRadius: 2, flexShrink: 0 }} alt="" />
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {teams[s.teamId]?.name}
                            </span>
                            <span style={{ fontSize: 10, color: "#64748b" }}>· {s.metricLabel}</span>
                          </div>
                          <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 13, color: s.color, flexShrink: 0 }}>
                            {pt.value.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Kompakt legend */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
              {chartSeries.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#475569" }}>
                  <span style={{ width: 16, height: 3, borderRadius: 2, background: s.color }} />
                  <span style={{ fontWeight: 600 }}>{s.label}</span>
                  {s.mapped.length > 0 && (
                    <span style={{ fontFamily: "monospace", fontWeight: 800, color: s.color }}>
                      {s.mapped[s.mapped.length - 1].value.toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
