import React, { useMemo, useState, useCallback } from "react";
import { PROB_METRICS, getTeamTrendSeries } from "./probabilityHistory";

const METRIC_COLORS = {
  r32: "#34d399",
  r16: "#38bdf8",
  qf: "#fbbf24",
  sf: "#fb7185",
  f: "#c4b5fd",
  champion: "#f59e0b",
};

const TEAM_PALETTE = [
  "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a78bfa",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
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

/** Catmull-Rom → cubic Bézier — pürüzsüz eğri */
function smoothPath(points, tension = 0.28) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function areaPath(linePath, points, baseY) {
  if (!linePath || points.length < 2) return "";
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePath} L ${last.x.toFixed(2)} ${baseY} L ${first.x.toFixed(2)} ${baseY} Z`;
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
          label: `${teams[teamId]?.name} · ${metricLabel}`,
          color,
          points: raw,
        });
        colorIdx++;
      });
    });
    return list;
  }, [selectedTeams, selectedMetrics, sortedSnaps, teams]);

  const W = 1100;
  const H = 480;
  const pad = { top: 36, right: 28, bottom: 64, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const baseY = pad.top + innerH;
  const yTicks = [0, 20, 40, 60, 80, 100];

  const valueToY = useCallback(
    (v) => pad.top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH,
    [pad.top, innerH]
  );

  const snapToX = useCallback(
    (i, total) => {
      if (total <= 1) return pad.left + innerW / 2;
      return pad.left + (i / (total - 1)) * innerW;
    },
    [pad.left, innerW]
  );

  const chartSeries = useMemo(() => {
    const n = sortedSnaps.length;
    return activeSeries.map((s) => {
      const mapped = sortedSnaps.map((snap, i) => {
        const pt = s.points.find((p) => p.id === snap.id);
        const value = pt?.value ?? null;
        return {
          snapId: snap.id,
          label: snap.label,
          value,
          x: snapToX(i, n),
          y: value !== null ? valueToY(value) : null,
        };
      }).filter((p) => p.value !== null);
      const linePath = smoothPath(mapped);
      return { ...s, mapped, linePath, areaD: areaPath(linePath, mapped, baseY) };
    });
  }, [activeSeries, sortedSnaps, snapToX, valueToY, baseY]);

  const hoverX = hoverIdx !== null && sortedSnaps.length > 1
    ? snapToX(hoverIdx, sortedSnaps.length)
  : hoverIdx === 0 && sortedSnaps.length === 1
    ? snapToX(0, 1)
    : null;

  const chipBtn = (active, color, children, onClick) => (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 11px",
        borderRadius: 8,
        border: active ? `1.5px solid ${color}` : "1.5px solid transparent",
        cursor: "pointer",
        fontSize: 10.5,
        fontWeight: 700,
        background: active ? `${color}22` : "rgba(255,255,255,0.06)",
        color: active ? color : "rgba(255,255,255,0.55)",
        boxShadow: active ? `0 0 12px ${color}33` : "none",
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );

  const hasData = chartSeries.some((s) => s.mapped.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        background: "linear-gradient(135deg,#0a0f1e 0%,#111827 50%,#0f172a 100%)",
        borderRadius: 16,
        padding: "18px 22px",
        border: "1px solid rgba(16,185,129,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#10b981", letterSpacing: "0.06em", marginBottom: 4 }}>
          OLASILIK TRENDİ
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
          Çoklu takım & tur · {snapshots.length} kayıt · ölçek 0–100%
        </div>
      </div>

      <div style={{
        background: "linear-gradient(180deg,#0c1222 0%,#0a0f1e 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 18,
        padding: "20px 22px 16px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "monospace" }}>
            TAKIMLAR (çoklu seçim)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 110, overflowY: "auto" }}>
            {teamIds.map((id, ti) => {
              const active = selectedTeams.has(id);
              const c = TEAM_PALETTE[ti % TEAM_PALETTE.length];
              return chipBtn(active, c, (
                <>
                  <img src={getFlagUrl(teams[id]?.iso)} style={{ width: 15, height: 10, borderRadius: 2, objectFit: "cover" }} alt="" />
                  {teams[id]?.name}
                </>
              ), () => setSelectedTeams((prev) => toggleInSet(prev, id)));
            })}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "monospace" }}>
            TUR İHTİMALLERİ (çoklu seçim)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PROB_METRICS.map((m) => {
              const c = METRIC_COLORS[m.key];
              const active = selectedMetrics.has(m.key);
              return chipBtn(active, c, m.label, () => setSelectedMetrics((prev) => toggleInSet(prev, m.key)));
            })}
          </div>
        </div>

        {/* Legend */}
        {chartSeries.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {chartSeries.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
                <span style={{ width: 22, height: 3, borderRadius: 2, background: s.color, boxShadow: `0 0 8px ${s.color}88` }} />
                <img src={getFlagUrl(teams[s.teamId]?.iso)} style={{ width: 14, height: 10, borderRadius: 2 }} alt="" />
                {s.label}
                {s.mapped.length > 0 && (
                  <span style={{ fontFamily: "monospace", color: s.color, fontWeight: 800 }}>
                    {s.mapped[s.mapped.length - 1].value.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!hasData ? (
          <div style={{ padding: 80, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
            Henüz veri yok. Güncelle ile kayıt ekleyin.
          </div>
        ) : (
          <div
            style={{ width: "100%", position: "relative" }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", height: "auto", minHeight: 420, display: "block" }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = ((e.clientX - rect.left) / rect.width) * W;
                const n = sortedSnaps.length;
                if (n <= 1) { setHoverIdx(0); return; }
                const ratio = (relX - pad.left) / innerW;
                const idx = Math.round(Math.max(0, Math.min(1, ratio)) * (n - 1));
                setHoverIdx(idx);
              }}
            >
              <defs>
                {chartSeries.map((s) => (
                  <linearGradient key={`grad-${s.id}`} id={`area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                ))}
                <linearGradient id="chart-bg-glow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.04)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </linearGradient>
              </defs>

              <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="url(#chart-bg-glow)" rx={8} />

              {yTicks.map((tick) => {
                const y = valueToY(tick);
                return (
                  <g key={tick}>
                    <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                    <text x={pad.left - 10} y={y + 4} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.35)" fontFamily="'JetBrains Mono',monospace" fontWeight={600}>
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {chartSeries.map((s) => s.areaD && (
                <path key={`area-${s.id}`} d={s.areaD} fill={`url(#area-${s.id})`} />
              ))}

              {chartSeries.map((s) => s.linePath && (
                <path
                  key={`line-${s.id}`}
                  d={s.linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 6px ${s.color}66)` }}
                />
              ))}

              {hoverX !== null && (
                <line x1={hoverX} y1={pad.top} x2={hoverX} y2={baseY} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 4" />
              )}

              {sortedSnaps.map((snap, i) => (
                <text
                  key={snap.id}
                  x={snapToX(i, sortedSnaps.length)}
                  y={H - 18}
                  textAnchor="middle"
                  fontSize={9}
                  fill={hoverIdx === i ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)"}
                  fontFamily="monospace"
                  fontWeight={hoverIdx === i ? 700 : 500}
                  transform={sortedSnaps.length > 8 ? `rotate(-24, ${snapToX(i, sortedSnaps.length)}, ${H - 18})` : undefined}
                >
                  {snap.label.length > 16 ? snap.label.slice(0, 14) + "…" : snap.label}
                </text>
              ))}
            </svg>

            {hoverIdx !== null && sortedSnaps[hoverIdx] && (
              <div style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "rgba(15,23,42,0.92)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "12px 14px",
                minWidth: 200,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                pointerEvents: "none",
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", marginBottom: 8, fontWeight: 600 }}>
                  {sortedSnaps[hoverIdx].label}
                </div>
                {chartSeries.map((s) => {
                  const pt = s.mapped.find((p) => p.snapId === sortedSnaps[hoverIdx].id);
                  if (!pt) return null;
                  return (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                        <span style={{ width: 14, height: 2, borderRadius: 1, background: s.color }} />
                        {teams[s.teamId]?.name}
                      </div>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 12, color: s.color }}>
                        {pt.value.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
