import React, { useMemo } from "react";

// Bayrak URL üretici
const getFlagUrl = (iso) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : "";

// ELO'ya göre kazanma olasılığı formülü
const getWinProbability = (eloA, eloB) => 1 / (1 + Math.pow(10, (eloB - eloA) / 400));

// Poisson ve Rulet Tekerleği Yöntemli Gelişmiş Skor Simülatörü
function simulateEloWeightedScore(eloHome, eloAway) {
  const pHomeWin = getWinProbability(eloHome, eloAway);
  const pAwayWin = getWinProbability(eloAway, eloHome);
  
  const eloDiff = Math.abs(eloHome - eloAway);
  const pDraw = Math.max(0.05, 0.26 * Math.exp(-eloDiff / 400));

  const sumP = pHomeWin + pAwayWin + pDraw;
  const probHome = pHomeWin / sumP;
  const probAway = pAwayWin / sumP;

  const rResult = Math.random();
  let selectedOutcome = "draw";
  if (rResult < probHome) {
    selectedOutcome = "home";
  } else if (rResult < probHome + probAway) {
    selectedOutcome = "away";
  }

  const expectedDiff = (eloHome - eloAway) / 300;
  let lambdaHome = 1.35 + (expectedDiff / 2);
  let lambdaAway = 1.35 - (expectedDiff / 2);

  lambdaHome = Math.max(0.3, Math.min(4.5, lambdaHome));
  lambdaAway = Math.max(0.3, Math.min(4.5, lambdaAway));

  const poissonProb = (k, lambda) => {
    let factorial = 1;
    for (let i = 1; i <= k; i++) factorial *= i;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
  };

  const validCombinations = [];
  let weightSum = 0;

  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      if (selectedOutcome === "home" && h <= a) continue;
      if (selectedOutcome === "away" && a <= h) continue;
      if (selectedOutcome === "draw" && h !== a) continue;

      const pG_home = poissonProb(h, lambdaHome);
      const pG_away = poissonProb(a, lambdaAway);
      const combinedWeight = pG_home * pG_away;

      validCombinations.push({ home: h, away: a, weight: combinedWeight });
      weightSum += combinedWeight;
    }
  }

  if (validCombinations.length === 0 || weightSum === 0) {
    if (selectedOutcome === "home") return { home: 1, away: 0 };
    if (selectedOutcome === "away") return { home: 0, away: 1 };
    return { home: 1, away: 1 };
  }

  const rScore = Math.random();
  let cumulative = 0;
  for (let i = 0; i < validCombinations.length; i++) {
    cumulative += validCombinations[i].weight / weightSum;
    if (rScore <= cumulative) {
      return { home: validCombinations[i].home, away: validCombinations[i].away };
    }
  }
  return validCombinations[validCombinations.length - 1];
}

export default function GroupStage({ teams, matches, setMatches, groupsConfig, knockoutMatches, setKnockoutMatches }) {

  // --- CANLI HESAPLANAN PUAN DURUMU ---
  const { groupTables, sortedThirds } = useMemo(() => {
    const tables = {};
    
    // İlk değerleri oluştur
    Object.entries(groupsConfig).forEach(([gName, gTeams]) => {
      tables[gName] = gTeams.map(tId => ({
        id: tId, name: teams[tId].name, iso: teams[tId].iso, elo: teams[tId].elo,
        O: 0, G: 0, B: 0, M: 0, AG: 0, YG: 0, AV: 0, P: 0
      }));
    });

    // Maç sonuçlarını işle
    matches.forEach(m => {
      if (m.played || (m.scoreA !== "" && m.scoreB !== "")) {
        const sA = parseInt(m.scoreA) || 0;
        const sB = parseInt(m.scoreB) || 0;
        const rowA = tables[m.group].find(t => t.id === m.teamA);
        const rowB = tables[m.group].find(t => t.id === m.teamB);

        if (rowA && rowB) {
          rowA.O += 1; rowB.O += 1;
          rowA.AG += sA; rowA.YG += sB;
          rowB.AG += sB; rowB.YG += sA;

          if (sA > sB) {
            rowA.G += 1; rowA.P += 3; rowB.M += 1;
          } else if (sB > sA) {
            rowB.G += 1; rowB.P += 3; rowA.M += 1;
          } else {
            rowA.B += 1; rowA.P += 1;
            rowB.B += 1; rowB.P += 1;
          }
        }
      }
    });

    // Grupları kendi içinde sırala (Puan -> Averaj -> Atılan Gol -> ELO)
    Object.keys(tables).forEach(gName => {
      tables[gName].forEach(row => { row.AV = row.AG - row.YG; });
      tables[gName].sort((a, b) => b.P - a.P || b.AV - a.AV || b.AG - a.AG || b.elo - a.elo);
    });

    // 3.lük Barajı Sıralaması
    const thirds = [];
    Object.entries(tables).forEach(([gName, rows]) => {
      if (rows[2]) thirds.push({ ...rows[2], group: gName });
    });
    thirds.sort((a, b) => b.P - a.P || b.AV - a.AV || b.AG - a.AG || b.elo - a.elo);

    return { groupTables: tables, sortedThirds: thirds };
  }, [matches, teams, groupsConfig]);

  // --- GRUP MAÇLARINI SKORLA SİMÜLE ETME ---
  const handleSimulateGroups = () => {
    const updatedMatches = matches.map(m => {
      const eloA = teams[m.teamA].elo;
      const eloB = teams[m.teamB].elo;
      const res = simulateEloWeightedScore(eloA, eloB);
      return {
        ...m,
        scoreA: res.home.toString(),
        scoreB: res.away.toString(),
        played: true
      };
    });
    setMatches(updatedMatches);
  };

  // Skor Girişi El İle Değiştiğinde
  const handleScoreChange = (id, field, val) => {
    setMatches(prev => prev.map(m => {
      if (m.id === id) {
        const updated = { ...m, [field]: val };
        updated.played = updated.scoreA !== "" && updated.scoreB !== "";
        return updated;
      }
      return m;
    }));
  };

  return (
    <div style={{ padding: "20px 0" }}>
      {/* BAŞLIK VE HIZLI SİMÜLASYON BARBARI */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", background: "#1e293b", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>Grup Aşaması Eşleşmeleri & Puan Tabloları</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>12 Grupta toplam 48 takım son 32 turuna kalabilmek için mücadele ediyor.</p>
        </div>
        <button
          onClick={handleSimulateGroups}
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)"
          }}
        >
          Grupları ELO İle Simüle Et ⚡
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
        
        {/* SOL TARAF: GRUPLAR (KARTLAR VE FİKSTÜRLER) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
          {Object.keys(groupsConfig).map(gName => (
            <div key={gName} style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
              
              {/* Grup Adı Şeridi */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: "15px", color: "#fbbf24" }}>GRUP {gName}</span>
                <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>FİKSTÜR & PUAN</span>
              </div>

              {/* PUAN DURUMU TABLOSU */}
              <div style={{ padding: "12px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left", marginBottom: "14px" }}>
                  <thead>
                    <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ padding: "6px 4px" }}>Takım</th>
                      <th style={{ padding: "6px 4px", textAlign: "center" }}>O</th>
                      <th style={{ padding: "6px 4px", textAlign: "center" }}>AV</th>
                      <th style={{ padding: "6px 4px", textAlign: "center", color: "#fbbf24" }}>P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupTables[gName].map((row, idx) => {
                      const isTop2 = idx < 2;
                      const isBestThird = sortedThirds.slice(0, 8).some(t => t.id === row.id && t.group === gName);
                      let rowBg = "transparent";
                      if (isTop2) rowBg = "rgba(16, 185, 129, 0.05)";
                      else if (isBestThird) rowBg = "rgba(59, 130, 246, 0.05)";

                      return (
                        <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: rowBg, height: "30px" }}>
                          <td style={{ padding: "4px", display: "flex", alignItems: "center", gap: "6px", fontWeight: idx === 0 ? 700 : 500 }}>
                            <span style={{ color: idx < 2 ? "#10b981" : isBestThird ? "#3b82f6" : "#64748b", width: "12px", fontSize: "10px" }}>{idx+1}</span>
                            <img src={getFlagUrl(row.iso)} style={{ width: 16, height: 11, objectFit: "cover", borderRadius: "1px" }} alt="" />
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }}>{row.name}</span>
                          </td>
                          <td style={{ padding: "4px", textAlign: "center", fontFamily: "monospace" }}>{row.O}</td>
                          <td style={{ padding: "4px", textAlign: "center", fontFamily: "monospace", color: row.AV > 0 ? "#10b981" : row.AV < 0 ? "#ef4444" : "#94a3b8" }}>{row.AV > 0 ? `+${row.AV}` : row.AV}</td>
                          <td style={{ padding: "4px", textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: idx < 2 ? "#10b981" : isBestThird ? "#3b82f6" : "#cbd5e1" }}>{row.P}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* GRUP MAÇLARI GİRİŞ ALANLARI */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                  {matches.filter(m => m.group === gName).map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "6px 10px", borderRadius: "6px", gap: "8px" }}>
                      
                      {/* Ev Sahibi */}
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", minWidth: 0 }}>
                        <span style={{ fontSize: "11px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{teams[m.teamA].name}</span>
                        <img src={getFlagUrl(teams[m.teamA].iso)} style={{ width:14, height:10 }} alt="" />
                      </div>

                      {/* Skor Inputları */}
                      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <input
                          type="number" min="0" placeholder="-"
                          value={m.scoreA}
                          onChange={(e) => handleScoreChange(m.id, "scoreA", e.target.value)}
                          style={{ width: "26px", height: "20px", background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#fbbf24", textAlign: "center", fontWeight: "bold", fontSize: "11px", outline: "none" }}
                        />
                        <span style={{ fontSize: "10px", color: "#475569" }}>:</span>
                        <input
                          type="number" min="0" placeholder="-"
                          value={m.scoreB}
                          onChange={(e) => handleScoreChange(m.id, "scoreB", e.target.value)}
                          style={{ width: "26px", height: "20px", background: "#0f172a", border: "1px solid #334155", borderRadius: "4px", color: "#fbbf24", textAlign: "center", fontWeight: "bold", fontSize: "11px", outline: "none" }}
                        />
                      </div>

                      {/* Deplasman */}
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "6px", minWidth: 0 }}>
                        <img src={getFlagUrl(teams[m.teamB].iso)} style={{ width:14, height:10 }} alt="" />
                        <span style={{ fontSize: "11px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{teams[m.teamB].name}</span>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* SAĞ TARAF: EN İYİ ÜÇÜNCÜLER BARAJI (BAR PANELİ) */}
        <div style={{ position: "sticky", top: "84px", background: "#1e293b", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", padding: "16px", boxShadow: "0 4px 25px rgba(0,0,0,0.2)" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#fbbf24", fontWeight: 800 }}>EN İYİ ÜÇÜNCÜLER MATRİSİ</h3>
          <p style={{ margin: "0 0 14px 0", fontSize: "11px", color: "#94a3b8" }}>12 grubun üçüncülerinden en yüksek puan ve averaja sahip **ilk 8 takım** üst tura sızar.</p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "6px 2px", textAlign: "left" }}>Gr (Takım)</th>
                <th style={{ padding: "6px 2px", textAlign: "center" }}>AV</th>
                <th style={{ padding: "6px 2px", textAlign: "center", color: "#fbbf24" }}>P</th>
              </tr>
            </thead>
            <tbody>
              {sortedThirds.map((row, idx) => {
                const isQualified = idx < 8;
                return (
                  <tr key={row.id} style={{ 
                    borderBottom: "1px solid rgba(255,255,255,0.03)", 
                    background: isQualified ? "rgba(16, 185, 129, 0.04)" : "rgba(239, 68, 68, 0.03)",
                    height: "28px"
                  }}>
                    <td style={{ padding: "2px", display: "flex", alignItems: "center", gap: "5px", fontWeight: isQualified ? 600 : 400 }}>
                      <span style={{ color: isQualified ? "#10b981" : "#ef4444", width: "14px", fontWeight: 900 }}>{idx + 1}</span>
                      <span style={{ background: "rgba(255,255,255,0.05)", padding: "1px 3px", borderRadius: "3px", fontSize: "9px", color: "#94a3b8" }}>{row.group}</span>
                      <img src={getFlagUrl(row.iso)} style={{ width: 14, height: 10, objectFit: "cover" }} alt="" />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "110px" }}>{row.name}</span>
                    </td>
                    <td style={{ padding: "2px", textAlign: "center", fontFamily: "monospace", color: row.AV > 0 ? "#10b981" : row.AV < 0 ? "#ef4444" : "#94a3b8" }}>{row.AV > 0 ? `+${row.AV}` : row.AV}</td>
                    <td style={{ padding: "2px", textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: isQualified ? "#10b981" : "#ef4444" }}>{row.P}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: "14px", background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: "8px", padding: "10px", fontSize: "11px", color: "#94a3b8", lineHeight: "1.4" }}>
            <strong style={{ color: "#60a5fa", display: "block", marginBottom: "2px" }}>💡 Eleme Eşleşme Yapısı</strong>
            Üçüncüler tam kesinleştiğinde, FIFA 2026 turnuva matrisine göre hangi üçüncünün hangi grup lideriyle (`A, B, C, L`) eşleşeceği algoritma tarafından otomatik çözümlenir.
          </div>
        </div>

      </div>
    </div>
  );
}