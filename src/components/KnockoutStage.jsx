import React, { useMemo } from "react";
import { getFifaTargetThird } from "../fifaMatrix";

const getFlagUrl = (iso) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : "";
const getWinProbability = (eloA, eloB) => 1 / (1 + Math.pow(10, (eloB - eloA) / 400));

// Eleme turları için beraberlik olamayacağından kazananı kesin belirleyen ELO motoru
function simulateKnockoutMatchElo(eloA, eloB) {
  const probA = getWinProbability(eloA, eloB);
  const rResult = Math.random();
  const winner = rResult < probA ? "A" : "B";

  const eloDiff = Math.abs(eloA - eloB);
  let baseLambdaA = 1.35 + ((eloA - eloB) / 300);
  let baseLambdaB = 1.35 + ((eloB - eloA) / 300);
  baseLambdaA = Math.max(0.4, Math.min(4.0, baseLambdaA));
  baseLambdaB = Math.max(0.4, Math.min(4.0, baseLambdaB));

  const poissonSample = (lambda) => {
    let L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  };

  let sA = poissonSample(baseLambdaA);
  let sB = poissonSample(baseLambdaB);

  if (winner === "A" && sA <= sB) sA = sB + 1;
  if (winner === "B" && sB <= sA) sB = sA + 1;

  if (Math.random() < 0.15) {
    if (winner === "A") sA = sB + 1; else sB = sA + 1;
  }

  return { scoreA: sA, scoreB: sB };
}

export default function KnockoutStage({ teams, matches, knockoutMatches, setKnockoutMatches }) {

  // --- GRUP SONUÇLARINDAN TURU TETİKLEME VE MATRİS HESABI ---
  const handleCalculateKnockouts = () => {
    // 1. Grupları Hesapla
    const tables = {};
    const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];
    groups.forEach(g => { tables[g] = []; });

    // Mevcut grup maçlarının durumunu çek
    const tempTeams = {};
    Object.keys(teams).forEach(k => {
      tempTeams[k] = { id: k, O:0, G:0, B:0, M:0, AG:0, YG:0, AV:0, P:0, elo: teams[k].elo };
    });

    matches.forEach(m => {
      const sA = parseInt(m.scoreA);
      const sB = parseInt(m.scoreB);
      if (!isNaN(sA) && !isNaN(sB)) {
        tempTeams[m.teamA].O++; tempTeams[m.teamB].O++;
        tempTeams[m.teamA].AG += sA; tempTeams[m.teamA].YG += sB;
        tempTeams[m.teamB].AG += sB; tempTeams[m.teamB].YG += sA;
        if (sA > sB) { tempTeams[m.teamA].G++; tempTeams[m.teamA].P += 3; tempTeams[m.teamB].M++; }
        else if (sB > sA) { tempTeams[m.teamB].G++; tempTeams[m.teamB].P += 3; tempTeams[m.teamA].M++; }
        else { tempTeams[m.teamA].B++; tempTeams[m.teamA].P++; tempTeams[m.teamB].B++; tempTeams[m.teamB].P++; }
      }
    });

    Object.keys(tempTeams).forEach(k => {
      tempTeams[k].AV = tempTeams[k].AG - tempTeams[k].YG;
    });

    // Grupları kendi içinde yapılandır ve diz
    const config = {
      A: ["MEX","RSA","KOR","CZE"], B: ["CAN","BIH","QAT","SUI"], C: ["BRA","MAR","HAI","SCO"],
      D: ["FRA","AUS","EGY","JAM"], E: ["ARG","GHA","IRQ","ROU"], F: ["ESP","ALG","UZB","NZL"],
      G: ["ENG","ECU","TUN","GUA"], H: ["BEL","PAR","OMA","HON"], I: ["POR","COL","CMR","FIN"],
      J: ["ITA","SEN","CRC","MKD"], K: ["GER","URU","NGA","PAN"], L: ["NED","UKR","MLI","SLV"]
    };

    Object.entries(config).forEach(([gName, gTeams]) => {
      const list = gTeams.map(tid => tempTeams[tid]);
      list.sort((a,b) => b.P - a.P || b.AV - a.AV || b.AG - a.AG || b.elo - a.elo);
      tables[gName] = list;
    });

    // En iyi 3.ler listesi oluştur
    const thirds = [];
    groups.forEach(g => { if (tables[g][2]) thirds.push({ id: tables[g][2].id, group: g, P: tables[g][2].P, AV: tables[g][2].AV, AG: tables[g][2].AG, elo: tables[g][2].elo }); });
    thirds.sort((a,b) => b.P - a.P || b.AV - a.AV || b.AG - a.AG || b.elo - a.elo);
    
    const top8Thirds = thirds.slice(0, 8);
    const chosenGroupsLetters = top8Thirds.map(t => t.group).sort().join("");

    // Son 32 Turu Eşleşme Şablonunu Kurgula
    const r32 = {};
    const get3rd = (targetGroup) => {
      const sourceGroup = getFifaTargetThird(chosenGroupsLetters, targetGroup);
      return tables[sourceGroup]?.[2]?.id || "TBD";
    };

    const getT = (g, rank) => tables[g]?.[rank]?.id || "TBD";

    r32.m1  = { id: "m1",  tA: getT("A", 0), tB: get3rd("A"), sA: "", sB: "" };
    r32.m2  = { id: "m2",  tA: getT("B", 1), tB: getT("C", 1), sA: "", sB: "" };
    r32.m3  = { id: "m3",  tA: getT("C", 0), tB: get3rd("C"), sA: "", sB: "" };
    r32.m4  = { id: "m4",  tA: getT("E", 1), tB: getT("F", 1), sA: "", sB: "" };
    r32.m5  = { id: "m5",  tA: getT("E", 0), tB: getT("D", 1), sA: "", sB: "" };
    r32.m6  = { id: "m6",  tA: getT("I", 0), tB: getT("H", 1), sA: "", sB: "" };
    r32.m7  = { id: "m7",  tA: getT("D", 0), tB: get3rd("D"), sA: "", sB: "" };
    r32.m8  = { id: "m8",  tA: getT("G", 0), tB: get3rd("G"), sA: "", sB: "" };
    r32.m9  = { id: "m9",  tA: getT("B", 0), tB: get3rd("B"), sA: "", sB: "" };
    r32.m10 = { id: "m10", tA: getT("A", 1), tB: getT("D", 2), sA: "", sB: "" };
    r32.m11 = { id: "m11", tA: getT("F", 0), tB: get3rd("F"), sA: "", sB: "" };
    r32.m12 = { id: "m12", tA: getT("H", 0), tB: getT("G", 1), sA: "", sB: "" };
    r32.m13 = { id: "m13", tA: getT("K", 0), tB: getT("L", 1), sA: "", sB: "" };
    r32.m14 = { id: "m14", tA: getT("J", 0), tB: get3rd("J"), sA: "", sB: "" };
    r32.m15 = { id: "m14_2",tA:getT("L", 0), tB: get3rd("L"), sA: "", sB: "" };
    r32.m16 = { id: "m15", tA: getT("I", 1), tB: getT("J", 1), sA: "", sB: "" };

    r32.m17 = { id: "m16", tA: getT("K", 1), tB: getT("L", 2), sA: "", sB: "" };
    r32.m18 = { id: "m17", tA: getT("G", 2), tB: getT("H", 2), sA: "", sB: "" };
    r32.m19 = { id: "m18", tA: getT("I", 2), tB: getT("J", 2), sA: "", sB: "" };
    r32.m20 = { id: "m19", tA: getT("A", 2), tB: getT("B", 2), sA: "", sB: "" };
    r32.m21 = { id: "m20", tA: getT("C", 2), tB: getT("D", 3), sA: "", sB: "" };
    r32.m22 = { id: "m21", tA: getT("E", 2), tB: getT("F", 2), sA: "", sB: "" };
    r32.m23 = { id: "m22", tA: getT("G", 3), tB: getT("H", 3), sA: "", sB: "" };
    r32.m24 = { id: "m23", tA: getT("I", 3), tB: getT("J", 3), sA: "", sB: "" };
    r32.m25 = { id: "m24", tA: getT("K", 2), tB: getT("L", 3), sA: "", sB: "" };
    r32.m26 = { id: "m25", tA: getT("E", 3), tB: getT("F", 3), sA: "", sB: "" };
    r32.m27 = { id: "m26", tA: getT("A", 3), tB: getT("B", 3), sA: "", sB: "" };
    r32.m28 = { id: "m27", tA: getT("C", 3), tB: getT("D", 4), sA: "", sB: "" };
    r32.m29 = { id: "m28", tA: getT("K", 3), tB: getT("L", 4), sA: "", sB: "" };
    r32.m30 = { id: "m29", tA: getT("G", 4), tB: getT("H", 4), sA: "", sB: "" };
    r32.m31 = { id: "m30", tA: getT("I", 4), tB: getT("J", 4), sA: "", sB: "" };
    r32.m32 = { id: "m31", tA: getT("E", 4), tB: getT("F", 4), sA: "", sB: "" };

    // Boş Üst Tur Yapılarını Oluştur
    const createEmptyBranch = (count, prefix) => {
      const obj = {};
      for(let i=1; i<=count; i++) obj[`${prefix}${i}`] = { id: `${prefix}${i}`, tA: "TBD", tB: "TBD", sA: "", sB: "" };
      return obj;
    };

    setKnockoutMatches({
      r32,
      r16: createEmptyBranch(16, "m"),
      qf: createEmptyBranch(8, "q"),
      sf: createEmptyBranch(4, "s"),
      third: { third: { id: "third", tA: "TBD", tB: "TBD", sA: "", sB: "" } },
      final: { final: { id: "final", tA: "TBD", tB: "TBD", sA: "", sB: "" } }
    });
  };

  // --- KADEMELİ SİMÜLASYON TETİKLEME MOTORU ---
  const handleSimulateStage = (stageKey) => {
    if (!knockoutMatches) return;
    const currentStage = { ...knockoutMatches[stageKey] };

    // Mevcut turu simüle et
    Object.keys(currentStage).forEach(k => {
      const m = currentStage[k];
      if (m.tA !== "TBD" && m.tB !== "TBD") {
        const eloA = teams[m.tA]?.elo || 1500;
        const eloB = teams[m.tB]?.elo || 1500;
        const res = simulateKnockoutMatchElo(eloA, eloB);
        currentStage[k] = { ...m, sA: res.scoreA.toString(), sB: res.scoreB.toString() };
      }
    });

    const nextState = { ...knockoutMatches, [stageKey]: currentStage };

    // Bir üst turun katılımcılarını belirle ve taşı
    const getWinner = (m) => {
      const sA = parseInt(m.sA) || 0;
      const sB = parseInt(m.sB) || 0;
      return sA > sB ? m.tA : m.tB;
    };
    const getLoser = (m) => {
      const sA = parseInt(m.sA) || 0;
      const sB = parseInt(m.sB) || 0;
      return sA > sB ? m.tB : m.tA;
    };

    if (stageKey === "r32") {
      const keys = Object.keys(currentStage);
      for (let i = 0; i < 16; i++) {
        const nextMatchKey = `m${i + 1}`;
        nextState.r16[nextMatchKey].tA = getWinner(currentStage[keys[i * 2]]);
        nextState.r16[nextMatchKey].tB = getWinner(currentStage[keys[i * 2 + 1]]);
      }
    } else if (stageKey === "r16") {
      for (let i = 1; i <= 8; i++) {
        nextState.qf[`q${i}`].tA = getWinner(currentStage[`m${i * 2 - 1}`]);
        nextState.qf[`q${i}`].tB = getWinner(currentStage[`m${i * 2}`]);
      }
    } else if (stageKey === "qf") {
      for (let i = 1; i <= 4; i++) {
        nextState.sf[`s${i}`].tA = getWinner(currentStage[`q${i * 2 - 1}`]);
        nextState.sf[`s${i}`].tB = getWinner(currentStage[`q${i * 2}`]);
      }
    } else if (stageKey === "sf") {
      // Finalistler
      nextState.final.final.tA = getWinner(currentStage.s1);
      nextState.final.final.tB = getWinner(currentStage.s2);
      // 3.lük Maçı Katılımcıları
      nextState.third.third.tA = getLoser(currentStage.s1);
      nextState.third.third.tB = getLoser(currentStage.s2);
    }

    setKnockoutMatches(nextState);
  };

  // Skor El ile Değiştirildiğinde
  const handleKoScoreChange = (stageKey, matchId, field, val) => {
    setKnockoutMatches(prev => {
      const next = { ...prev };
      next[stageKey][matchId] = { ...next[stageKey][matchId], [field]: val };
      return next;
    });
  };

  // Tekil Maç Satırı Çizim Elemanı
  const renderKoMatchRow = (stageKey, m) => {
    const tAData = teams[m.tA];
    const tBData = teams[m.tB];

    return (
      <div key={m.id} style={{ display: "flex", alignItems: "center", background: "#1e293b", padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", gap: "8px" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "end", gap: "6px", minWidth: 0 }}>
          <span style={{ fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tAData?.name || m.tA}</span>
          {tAData && <img src={getFlagUrl(tAData.iso)} style={{ width: 14, height: 10 }} alt="" />}
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          <input type="number" min="0" placeholder="-" value={m.sA} onChange={e => handleKoScoreChange(stageKey, m.id, "sA", e.target.value)} style={{ width: "24px", height: "18px", background: "#0f172a", border: "1px solid #334155", color: "#fbbf24", textAlign: "center", fontSize: "11px", fontWeight: "bold", borderRadius: "4px" }} />
          <input type="number" min="0" placeholder="-" value={m.sB} onChange={e => handleKoScoreChange(stageKey, m.id, "sB", e.target.value)} style={{ width: "24px", height: "18px", background: "#0f172a", border: "1px solid #334155", color: "#fbbf24", textAlign: "center", fontSize: "11px", fontWeight: "bold", borderRadius: "4px" }} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "start", gap: "6px", minWidth: 0 }}>
          {tBData && <img src={getFlagUrl(tBData.iso)} style={{ width: 14, height: 10 }} alt="" />}
          <span style={{ fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tBData?.name || m.tB}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 0" }}>
      {/* BAŞLIK VE KONTROL PANELİ */}
      <div style={{ background: "#1e293b", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>Eleme Turları Görünümü (Knockout Bracket)</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>Grup aşaması bittikten sonra turları sırasıyla tetikleyerek şampiyona ulaşın.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleCalculateKnockouts} style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            Ağacı Gruplardan Çek 🔄
          </button>
        </div>
      </div>

      {!knockoutMatches ? (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#64748b" }}>
          ⚠️ Eleme turları henüz oluşturulmadı. Lütfen önce yukarıdaki <strong>"Ağacı Gruplardan Çek"</strong> butonuna basın.
        </div>
      ) : (
        /* ELEME ŞEMASI - YATAY KAYDIRILABİLİR SÜTUNLAR */
        <div style={{ display: "flex", gap: "20px", overflowX: "auto", paddingBottom: "20px", alignItems: "stretch" }}>
          
          {/* SON 32 */}
          <div style={{ minWidth: "210px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => handleSimulateStage("r32")} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #475569", color: "#cbd5e1", padding: "6px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Son 32 Simüle Et ⚡</button>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.values(knockoutMatches.r32).map(m => renderKoMatchRow("r32", m))}
            </div>
          </div>

          {/* SON 16 */}
          <div style={{ minWidth: "210px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => handleSimulateStage("r16")} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #475569", color: "#cbd5e1", padding: "6px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Son 16 Simüle Et ⚡</button>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "space-around", height: "100%" }}>
              {Object.values(knockoutMatches.r16).map(m => renderKoMatchRow("r16", m))}
            </div>
          </div>

          {/* ÇEYREK FİNAL */}
          <div style={{ minWidth: "210px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => handleSimulateStage("qf")} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #475569", color: "#cbd5e1", padding: "6px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Çeyrek Final Simüle Et ⚡</button>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "space-around", height: "100%" }}>
              {Object.values(knockoutMatches.qf).map(m => renderKoMatchRow("qf", m))}
            </div>
          </div>

          {/* YARI FİNAL */}
          <div style={{ minWidth: "210px", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => handleSimulateStage("sf")} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #475569", color: "#cbd5e1", padding: "6px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Yarı Final Simüle Et ⚡</button>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "space-around", height: "100%" }}>
              {Object.values(knockoutMatches.sf).map(m => renderKoMatchRow("sf", m))}
            </div>
          </div>

          {/* FİNAL & 3.LÜK MAÇI */}
          <div style={{ minWidth: "210px", flex: 1, display: "flex", flexDirection: "column", gap: "20px", justifyContent: "center" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24", marginBottom: "6px", textAlign: "center" }}>🏆 BÜYÜK FİNAL</div>
              {renderKoMatchRow("final", knockoutMatches.final.final)}
              <button onClick={() => handleSimulateStage("final")} style={{ width: "100%", marginTop: "6px", background: "linear-gradient(135deg, #d97706, #b45309)", color: "#fff", border: "none", padding: "5px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>Finali Oynat 🎬</button>
            </div>

            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", marginBottom: "6px", textAlign: "center" }}>🥉 3.LÜK MAÇI</div>
              {renderKoMatchRow("third", knockoutMatches.third.third)}
              <button onClick={() => handleSimulateStage("third")} style={{ width: "100%", marginTop: "6px", background: "rgba(255,255,255,0.05)", color: "#cbd5e1", border: "1px solid #475569", padding: "5px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>3.lüğü Belirle ⚡</button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}