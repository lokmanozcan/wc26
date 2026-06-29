import React, { useMemo, useState } from "react";
import { PROB_METRICS, getTeamTrendSeries } from "./probabilityHistory";

const METRIC_COLORS = {
  r32: "#10b981",
  r16: "#0284c7",
  qf: "#f59e0b",
  sf: "#ef4444",
  f: "#a78bfa",
  champion: "#d97706",
};

export default function ProbabilityTrend({ snapshots, teams, getFlagUrl }) {
  const teamIds = useMemo(() => Object.keys(teams), [teams]);
  const [selectedTeam, setSelectedTeam] = useState("ARG");
  const [selectedMetric, setSelectedMetric] = useState("champion");

  const series = useMemo(
    () => getTeamTrendSeries(snapshots, selectedTeam, selectedMetric),
    [snapshots, selectedTeam, selectedMetric]
  );

  const color = METRIC_COLORS[selectedMetric] || "#10b981";
  const metricLabel = PROB_METRICS.find((m) => m.key === selectedMetric)?.label || selectedMetric;

  const W = 720;
  const H = 280;
  const pad = { top: 24, right: 20, bottom: 52, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const { points, yTicks } = useMemo(() => {
    if (!series.length) return { points: [], yTicks: [0, 25, 50, 75, 100] };
    const vals = series.map((p) => p.value);
    const maxV = Math.min(100, Math.max(10, Math.ceil(Math.max(...vals) / 10) * 10 + 5));
    const minV = 0;
    const pts = series.map((p, i) => {
      const x = pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
      const y = pad.top + innerH - ((p.value - minV) / (maxV - minV)) * innerH;
      return { ...p, x, y };
    });
    const ticks = [];
    for (let t = 0; t <= maxV; t += maxV <= 30 ? 5 : 10) ticks.push(t);
    return { points: pts, yTicks: ticks.length ? ticks : [0, 25, 50, 75, 100] };
  }, [series, innerW, innerH, pad.left, pad.top]);

  const pathD = points.length > 1
    ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
    : "";

  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${pad.top + innerH} L ${points[0].x.toFixed(1)} ${pad.top + innerH} Z`
    : "";

  const [hoverIdx, setHoverIdx] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 14, padding: "16px 20px", border: "1px solid rgba(16,185,129,0.2)" }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#10b981", letterSpacing: "0.05em", marginBottom: 4 }}>📈 OLASILIK TRENDİ</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
          Her Güncelle tıklamasında matris değerleri kaydedilir · {snapshots.length} veri noktası
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 8, fontFamily: "monospace" }}>TAKIM</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxHeight: 120, overflowY: "auto", marginBottom: 14 }}>
          {teamIds.map((id) => (
            <button
              key={id}
              onClick={() => setSelectedTeam(id)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 10.5, fontWeight: 700,
                background: selectedTeam === id ? "linear-gradient(135deg,#10b981,#059669)" : "#f1f5f9",
                color: selectedTeam === id ? "#fff" : "#475569",
              }}
            >
              <img src={getFlagUrl(teams[id]?.iso)} style={{ width: 14, height: 10, borderRadius: 2, objectFit: "cover" }} alt="" />
              {teams[id]?.name}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 8, fontFamily: "monospace" }}>TUR İHTİMALİ</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
          {PROB_METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              style={{
                padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 10.5, fontWeight: 800, fontFamily: "monospace",
                background: selectedMetric === m.key ? (METRIC_COLORS[m.key] || "#10b981") : "#f1f5f9",
                color: selectedMetric === m.key ? "#fff" : "#64748b",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <img src={getFlagUrl(teams[selectedTeam]?.iso)} style={{ width: 28, height: 19, borderRadius: 3, objectFit: "cover", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }} alt="" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{teams[selectedTeam]?.name}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
              {metricLabel} trendi
              {points.length > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 800, color }}>
                  → {points[points.length - 1].value.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {series.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            Henüz veri yok. Güncelle butonuna basarak ilk noktayı ekleyin.
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}>
              {yTicks.map((tick) => {
                const y = pad.top + innerH - (tick / (yTicks[yTicks.length - 1] || 100)) * innerH;
                return (
                  <g key={tick}>
                    <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                    <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{tick}%</text>
                  </g>
                );
              })}

              {areaD && (
                <path d={areaD} fill={`${color}18`} />
              )}
              {pathD && (
                <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}

              {points.map((p, i) => (
                <g key={p.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoverIdx === i ? 7 : 5}
                    fill={p.isSeed ? "#fff" : color}
                    stroke={color}
                    strokeWidth={2}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                  <text
                    x={p.x}
                    y={H - pad.bottom + 14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#64748b"
                    fontFamily="monospace"
                    transform={points.length > 6 ? `rotate(-28, ${p.x}, ${H - pad.bottom + 14})` : undefined}
                  >
                    {p.label.length > 14 ? p.label.slice(0, 12) + "…" : p.label}
                  </text>
                  {hoverIdx === i && (
                    <g>
                      <rect x={p.x - 52} y={p.y - 36} width={104} height={28} rx={6} fill="#0f172a" opacity={0.92} />
                      <text x={p.x} y={p.y - 24} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">{p.label}</text>
                      <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={11} fill="#fff" fontWeight="bold" fontFamily="monospace">{p.value.toFixed(1)}%</text>
                    </g>
                  )}
                </g>
              ))}
            </svg>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 9.5, color: "#94a3b8", fontFamily: "monospace" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
            Canlı güncelleme
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", border: `2px solid ${color}`, display: "inline-block" }} />
            Geçmiş kayıt (seed)
          </span>
        </div>
      </div>

      {series.length > 1 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 8, letterSpacing: "0.05em" }}>VERİ NOKTALARI</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflowY: "auto" }}>
            {[...series].reverse().map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: 6, background: "#f8fafc", fontSize: 11 }}>
                <span style={{ color: "#475569" }}>{p.label}{p.isSeed ? " (seed)" : ""}</span>
                <span style={{ fontFamily: "monospace", fontWeight: 800, color }}>{p.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
