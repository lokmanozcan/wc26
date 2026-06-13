import React, { useMemo } from "react";

const getFlagUrl = (iso) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : "";

export default function StatsView({ teams, matches, knockoutMatches, groupsConfig }) {

  // --- TÜM TURNUVA VERİLERİNİ ANALİZ EDEN MERKEZİ MOTOR ---
  const stats = useMemo(() => {
    const data = {};

    // 1. Tüm takımların başlangıç istatistik şablonunu oluştur
    Object.keys(teams).forEach(id => {
      data[id] = {
        id,
        name: teams[id].name,
        iso: teams[id].iso,
        elo: teams[id].elo,
        played: 0,
        goalsScored: 0,
        goalsConceded: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        stageReached: "Grup Aşaması"
      };
    });

    // 2. Grup Maçlarını Hesapla ve Ekle
    matches.forEach(m => {
      if (m.played || (m.scoreA !== "" && m.scoreB !== "")) {
        const sA = parseInt(m.scoreA) || 0;
        const sB = parseInt(m.scoreB) || 0;

        if (data[m.teamA] && data[m.teamB]) {
          data[m.teamA].played += 1;
          data[m.teamB].played += 1;
          data[m.teamA].goalsScored += sA;
          data[m.teamA].goalsConceded += sB;
          data[m.teamB].goalsScored += sB;
          data[m.teamB].goalsConceded += sA;

          if (sA > sB) {
            data[m.teamA].wins += 1;
            data[m.teamA].points += 3;
            data[m.teamB].losses += 1;
          } else if (sB > sA) {
            data[m.teamB].wins += 1;
            data[m.teamB].points += 3;
            data[m.teamA].losses += 1;
          } else {
            data[m.teamA].draws += 1;
            data[m.teamA].points += 1;
            data[m.teamB].draws += 1;
            data[m.teamB].points += 1;
          }
        }
      }
    });

    // 3. Eleme Turları Sonuçlarını ve Ulaşılan Aşamaları Ekle
    if (knockoutMatches) {
      const processKoStage = (stageMap, stageName) => {
        if (!stageMap) return;
        Object.values(stageMap).forEach(m => {
          const sA = parseInt(m.sA);
          const sB = parseInt(m.sB);
          
          if (teams[m.tA]) data[m.tA].stageReached = stageName;
          if (teams[m.tB]) data[m.tB].stageReached = stageName;

          if (!isNaN(sA) && !isNaN(sB)) {
            data[m.tA].played += 1;
            data[m.tB].played += 1;
            data[m.tA].goalsScored += sA;
            data[m.tA].goalsConceded += sB;
            data[m.tB].goalsScored += sB;
            data[m.tB].goalsConceded += sA;

            if (sA > sB) {
              data[m.tA].wins += 1;
              data[m.tB].losses += 1;
            } else {
              data[m.tB].wins += 1;
              data[m.tA].losses += 1;
            }
          }
        });
      };

      processKoStage(knockoutMatches.r32, "Son 32 Turu");
      processKoStage(knockoutMatches.r16, "Son 16 Turu");
      processKoStage(knockoutMatches.qf, "Çeyrek Final");
      processKoStage(knockoutMatches.sf, "Yarı Final");
      processKoStage(knockoutMatches.third, "3.lük Maçı");
      processKoStage(knockoutMatches.final, "Final");

      // Şampiyon ve derece alanları güncelle
      const fMatch = knockoutMatches.final?.final;
      if (fMatch && fMatch.sA !== "" && fMatch.sB !== "") {
        const scoreA = parseInt(fMatch.sA) || 0;
        const scoreB = parseInt(fMatch.sB) || 0;
        if (scoreA > scoreB) {
          data[fMatch.tA].stageReached = "🏆 ŞAMPİYON";
          data[fMatch.tB].stageReached = "🥈 İkinci";
        } else if (scoreB > scoreA) {
          data[fMatch.tB].stageReached = "🏆 ŞAMPİYON";
          data[fMatch.tA].stageReached = "🥈 İkinci";
        }
      }

      const tMatch = knockoutMatches.third?.third;
      if (tMatch && tMatch.sA !== "" && tMatch.sB !== "") {
        const scoreA = parseInt(tMatch.sA) || 0;
        const scoreB = parseInt(tMatch.sB) || 0;
        if (scoreA > scoreB) {
          data[tMatch.tA].stageReached = "🥉 Üçüncü";
        } else if (scoreB > scoreA) {
          data[tMatch.tB].stageReached = "🥉 Üçüncü";
        }
      }
    }

    return Object.values(data);
  }, [teams, matches, knockoutMatches]);

  // --- EN ÇOK GOL ATAN TAKIMLAR (HÜCUM GÜCÜ) ---
  const topAttackingTeams = useMemo(() => {
    return [...stats].sort((a, b) => b.goalsScored - a.goalsScored || a.played - b.played).slice(0, 10);
  }, [stats]);

  // --- GENEL PERFORMANS LİSTESİ ---
  const sortedGeneralLeaderboard = useMemo(() => {
    return [...stats].sort((a, b) => {
      const stageWeight = {
        "🏆 ŞAMPİYON": 7, "🥈 İkinci": 6, "🥉 Üçüncü": 5, "3.lük Maçı": 4,
        "Yarı Final": 4, "Çeyrek Final": 3, "Son 16 Turu": 2, "Son 32 Turu": 1, "Grup Aşaması": 0
      };
      const weightA = stageWeight[a.stageReached] || 0;
      const weightB = stageWeight[b.stageReached] || 0;

      return weightB - weightA || b.points - a.points || (b.goalsScored - b.goalsConceded) - (a.goalsScored - a.goalsConceded) || b.elo - a.elo;
    });
  }, [stats]);

  // Sosyal Medya Metin Paylaşım Jeneratörü
  const generateShareText = () => {
    const champion = stats.find(t => t.stageReached === "🏆 ŞAMPİYON");
    const runnerUp = stats.find(t => t.stageReached === "🥈 İkinci");
    const third = stats.find(t => t.stageReached === "🥉 Üçüncü");
    const topScorer = topAttackingTeams[0];

    let text = `📊 FIFA WORLD CUP 2026 SIMULATION REPORT\n\n`;
    if (champion) text += `🏆 ŞAMPİYON: ${champion.name}\n`;
    if (runnerUp) text += `🥈 İKİNCİ: ${runnerUp.name}\n`;
    if (third) text += `🥉 ÜÇÜNCÜ: ${third.name}\n`;
    if (topScorer && topScorer.goalsScored > 0) text += `🔥 EN GOLCÜ TAKIM: ${topScorer.name} (${topScorer.goalsScored} Gol)\n`;
    text += `\n#WorldCup2026 #FIFA #Simulation`;

    navigator.clipboard.writeText(text);
    alert("Sosyal medya raporu başarıyla panoya kopyalandı! 🚀");
  };

  return (
    <div style={{ padding: "20px 0" }}>
      
      {/* ÜST PANEL VE SOSYAL MEDYA BUTONU */}
      <div style={{ background: "#1e293b", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>Turnuva İstatistikleri & Veri Analizi</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>Oynanan tüm maç verilerine dayanan canlı performans tabloları ve sosyal medya çıktıları.</p>
        </div>
        <button
          onClick={generateShareText}
          style={{
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff", border: "none", padding: "10px 18px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(29, 78, 216, 0.2)"
          }}
        >
          📊 Raporu X/Twitter İçin Kopyala
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* SOL TABLO: GENEL TURNUVA SIRALAMASI */}
        <div style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", padding: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", color: "#fbbf24" }}>Genel Turnuva Performans Sıralaması</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead>
                <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ padding: "8px 4px" }}>Sıra</th>
                  <th style={{ padding: "8px 4px" }}>Takım</th>
                  <th style={{ padding: "8px 4px", textAlign: "center" }}>Maç</th>
                  <th style={{ padding: "8px 4px", textAlign: "center" }}>G-B-M</th>
                  <th style={{ padding: "8px 4px", textAlign: "center" }}>Gol (A/Y)</th>
                  <th style={{ padding: "8px 4px", textAlign: "center" }}>Averaj</th>
                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Son Aşama</th>
                </tr>
              </thead>
              <tbody>
                {sortedGeneralLeaderboard.map((row, idx) => {
                  const isGold = row.stageReached === "🏆 ŞAMPİYON";
                  return (
                    <tr key={row.id} style={{ 
                      borderBottom: "1px solid rgba(255,255,255,0.02)", 
                      background: isGold ? "rgba(251, 191, 36, 0.05)" : "transparent",
                      height: "32px"
                    }}>
                      <td style={{ padding: "6px 4px", color: isGold ? "#fbbf24" : "#64748b", fontWeight: "bold" }}>{idx + 1}</td>
                      <td style={{ padding: "6px 4px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <img src={getFlagUrl(row.iso)} style={{ width: 16, height: 11, borderRadius: "1px" }} alt="" />
                        <span style={{ fontWeight: isGold ? 700 : 500 }}>{row.name}</span>
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "center", fontFamily: "monospace" }}>{row.played}</td>
                      <td style={{ padding: "6px 4px", textAlign: "center", fontFamily: "monospace", color: "#94a3b8" }}>
                        {row.wins}-{row.draws}-{row.losses}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "center", fontFamily: "monospace" }}>
                        {row.goalsScored}/{row.goalsConceded}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: (row.goalsScored - row.goalsConceded) > 0 ? "#10b981" : (row.goalsScored - row.goalsConceded) < 0 ? "#ef4444" : "#94a3b8" }}>
                        {(row.goalsScored - row.goalsConceded) > 0 ? `+${row.goalsScored - row.goalsConceded}` : row.goalsScored - row.goalsConceded}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 700, color: isGold ? "#fbbf24" : row.stageReached.includes("Final") ? "#60a5fa" : "#cbd5e1" }}>
                        {row.stageReached}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SAĞ TABLO: EN GOLCÜ TAKIMLAR */}
        <div style={{ background: "#1e293b", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", padding: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#fbbf24" }}>🔥 En Çok Gol Atan Takımlar</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "8px 4px", textAlign: "left" }}>Takım</th>
                <th style={{ padding: "8px 4px", textAlign: "center" }}>Maç</th>
                <th style={{ padding: "8px 4px", textAlign: "right", color: "#10b981" }}>Toplam Gol</th>
              </tr>
            </thead>
            <tbody>
              {topAttackingTeams.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", height: "32px" }}>
                  <td style={{ padding: "6px 4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <img src={getFlagUrl(row.iso)} style={{ width: 14, height: 10 }} alt="" />
                    <span>{row.name}</span>
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center", fontFamily: "monospace", color: "#64748b" }}>{row.played}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#10b981", fontSize: "13px" }}>{row.goalsScored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}