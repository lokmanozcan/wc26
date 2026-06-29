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

/** Çoklu takımda net ayırt edilebilir renkler */
const DISTINCT_COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#be185d",
  "#4f46e5",
  "#0d9488",
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

function straightPath(points) {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
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

  const selectedTeamsArr = useMemo(() => [...selectedTeams], [selectedTeams]);

  const sortedSnaps = useMemo(
    () => [...snapshots].sort((a, b) => a.recordedAt - b.recordedAt),
    [snapshots]
  );

  const activeSeries = useMemo(() => {
    const list = [];
    let colorIdx = 0;
    const multiMetric = selectedMetrics.size > 1;
    [...selectedTeams].forEach((teamId) => {
      [...selectedMetrics].forEach((metricKey) => {
        const raw = getTeamTrendSeries(sortedSnaps, teamId, metricKey);
        const metricLabel = PROB_METRICS.find((m) => m.key === metricKey)?.label || metricKey;
        const color = multiMetric
          ? METRIC_COLORS[metricKey] || DISTINCT_COLORS[colorIdx % DISTINCT_COLORS.length]
          : DISTINCT_COLORS[selectedTeamsArr.indexOf(teamId) % DISTINCT_COLORS.length];
        list.push({
          id: `${teamId}_${metricKey}`,
          teamId,
          metricKey,
          metricLabel,
          teamName: teams[teamId]?.name || teamId,
          label: multiMetric
            ? `${teams[teamId]?.name} · ${metricLabel}`
            : teams[teamId]?.name || teamId,
          color,
          points: raw,
        });
        colorIdx++;
      });
    });
    return list;
  }, [selectedTeams, selectedMetrics, selectedTeamsArr, sortedSnaps, teams]);

  const W = 800;
  const H = 280;
  const pad = { top: 28, right: 88, bottom: 32, left: 44 };
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
      return { ...s, mapped, linePath: straightPath(mapped) };
    });
  }, [rawMapped, valueToY]);

  const endLabels = useMemo(() => {
    const items = chartSeries
      .filter((s) => s.mapped.length > 0)
      .map((s) => {
        const last = s.mapped[s.mapped.length - 1];
        return { ...s, last, labelY: last.y };
      })
      .sort((a, b) => a.last.y - b.last.y);

    const minGap = 20;
    for (let i = 1; i < items.length; i++) {
      if (items[i].labelY - items[i - 1].labelY < minGap) {
        items[i].labelY = items[i - 1].labelY + minGap;
      }
    }
    return items;
  }, [chartSeries]);

  const hasData = chartSeries.some((s) => s.mapped.length > 0);
  const hoverX = hoverIdx !== null ? snapToX(hoverIdx, sortedSnaps.length) : null;

  const chipBtn = (active, color, children, onClick) => (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 7, border: active ? `2px solid ${color}` : "2px solid transparent",
        cursor: "pointer", fontSize: 10.5, fontWeight: 700,
        background: active ? color : "#f1f5f9",
        color: active ? "#fff" : "#64748b",
        boxShadow: active ? `0 2px 8px ${color}55` : "none",
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
          {teamIds.map((id) => {
            const active = selectedTeams.has(id);
            const c = DISTINCT_COLORS[selectedTeamsArr.indexOf(id) % DISTINCT_COLORS.length];
            const chipColor = active ? c : "#94a3b8";
            return chipBtn(
              active,
              chipColor,
              (<><img src={getFlagUrl(teams[id]?.iso)} style={{ width: 14, height: 10, borderRadius: 2, objectFit: "cover" }} alt="" />{teams[id]?.name}</>),
              () => setSelectedTeams((p) => toggleInSet(p, id))
            );
          })}
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
                style={{ width: "100%", height: "auto", maxHeight: 300, display: "block" }}
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
                  <path
                    key={s.id}
                    d={s.linePath}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={hoverIdx !== null ? 2 : 2.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={hoverIdx !== null ? 0.35 : 1}
                  />
                ))}

                {hoverIdx !== null && chartSeries.map((s) => {
                  const pt = s.mapped.find((p) => p.snapIdx === hoverIdx);
                  if (!pt) return null;
                  return (
                    <path key={`hl-${s.id}`} d={s.linePath} fill="none" stroke={s.color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
                  );
                })}

                {hoverX !== null && (
                  <line x1={hoverX} y1={pad.top} x2={hoverX} y2={baseY} stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                )}

                {hoverIdx !== null && chartSeries.map((s) => {
                  const pt = s.mapped.find((p) => p.snapIdx === hoverIdx);
                  if (!pt) return null;
                  const textW = 52;
                  const tx = Math.min(pt.x + 8, W - pad.right - textW);
                  return (
                    <g key={`hover-${s.id}`}>
                      <circle cx={pt.x} cy={pt.y} r={5.5} fill="#fff" stroke={s.color} strokeWidth={3} />
                      <rect x={tx - 2} y={pt.y - 20} width={textW} height={18} rx={4} fill={s.color} />
                      <text x={tx + textW / 2 - 2} y={pt.y - 7} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="bold" fontFamily="monospace">
                        {pt.value.toFixed(1)}%
                      </text>
                    </g>
                  );
                })}

                {/* Çizgi sonu takım etiketleri — isim + % aynı satırda */}
                {endLabels.map((item) => {
                  const ly = item.labelY ?? item.last.y;
                  const lx = Math.min(item.last.x + 6, W - pad.right - 4);
                  const name = item.teamName.length > 12 ? item.teamName.slice(0, 10) + "…" : item.teamName;
                  const pct = `${item.last.value.toFixed(1)}%`;
                  const labelH = 18;
                  const tw = Math.max(78, (name.length + pct.length) * 5.4 + 14);
                  const boxY = ly - labelH / 2 - 2;
                  return (
                    <g key={`end-${item.id}`}>
                      <line x1={item.last.x} y1={item.last.y} x2={lx} y2={ly} stroke={item.color} strokeWidth={1.2} opacity={0.45} />
                      <rect x={lx} y={boxY} width={tw} height={labelH} rx={5} fill={item.color} />
                      <text x={lx + 7} y={boxY + 12.5} fontSize={9.5} fill="#fff" fontWeight="bold">
                        <tspan>{name}</tspan>
                        <tspan dx={5} fontFamily="monospace" fontWeight="900" fontSize={10}>{pct}</tspan>
                      </text>
                    </g>
                  );
                })}

                {sortedSnaps.map((snap, i) => (
                  <text
                    key={snap.id}
                    x={snapToX(i, sortedSnaps.length)}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize={7.5}
                    fill={hoverIdx === i ? "#64748b" : "#cbd5e1"}
                    fontFamily="monospace"
                  >
                    {snap.label.length > 11 ? snap.label.slice(0, 9) + "…" : snap.label}
                  </text>
                ))}
              </svg>
            </div>

            {/* Hover: büyük olasılık kartları */}
            <div style={{
              marginTop: 10,
              minHeight: 40,
              padding: "10px 12px",
              borderRadius: 8,
              background: hoverIdx !== null ? "#fff" : "#f8fafc",
              border: `1px solid ${hoverIdx !== null ? "#e2e8f0" : "#e2e8f0"}`,
            }}>
              {hoverIdx === null ? (
                <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", fontFamily: "monospace" }}>
                  Olasılıkları görmek için grafiğin üzerine gelin
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {chartSeries.map((s) => {
                    const pt = s.mapped.find((p) => p.snapIdx === hoverIdx);
                    if (!pt) return null;
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 14px", borderRadius: 8,
                          background: `${s.color}14`,
                          border: `2px solid ${s.color}`,
                        }}
                      >
                        <img src={getFlagUrl(teams[s.teamId]?.iso)} style={{ width: 20, height: 13, borderRadius: 2 }} alt="" />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>{s.teamName}</div>
                          {selectedMetrics.size > 1 && (
                            <div style={{ fontSize: 9, color: "#64748b" }}>{s.metricLabel}</div>
                          )}
                        </div>
                        <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 18, color: s.color }}>
                          {pt.value.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
