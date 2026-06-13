import React, { useState, useEffect, useRef, useCallback } from "react";
import { getFifaTargetThird } from "./fifaMatrix";
import { usePersistentState } from "./usePersistentState";


// --- TAKIM VERİLERİ ---
const INITIAL_TEAMS = {
  MEX: { name: "Meksika", iso: "mx", elo: 1875 },
  RSA: { name: "Güney Afrika", iso: "za", elo: 1517 },
  KOR: { name: "Güney Kore", iso: "kr", elo: 1758 },
  CZE: { name: "Çekya", iso: "cz", elo: 1740 },

  CAN: { name: "Kanada", iso: "ca", elo: 1788 },
  BIH: { name: "Bosna Hersek", iso: "ba", elo: 1595 },
  QAT: { name: "Katar", iso: "qa", elo: 1421 },
  SUI: { name: "İsviçre", iso: "ch", elo: 1891 },

  BRA: { name: "Brezilya", iso: "br", elo: 1991 },
  MAR: { name: "Fas", iso: "ma", elo: 1827 },
  HAI: { name: "Haiti", iso: "ht", elo: 1548 },
  SCO: { name: "İskoçya", iso: "gb-sct", elo: 1782 },

  USA: { name: "ABD", iso: "us", elo: 1726 },
  PAR: { name: "Paraguay", iso: "py", elo: 1834 },
  AUS: { name: "Avustralya", iso: "au", elo: 1777 },
  TUR: { name: "Türkiye", iso: "tr", elo: 1911 },

  GER: { name: "Almanya", iso: "de", elo: 1932 },
  CUW: { name: "Curaçao", iso: "cw", elo: 1434 },
  CIV: { name: "Fildişi Sahili", iso: "ci", elo: 1695 },
  ECU: { name: "Ekvador", iso: "ec", elo: 1938 },

  NED: { name: "Hollanda", iso: "nl", elo: 1948 },
  JPN: { name: "Japonya", iso: "jp", elo: 1906 },
  SWE: { name: "İsveç", iso: "se", elo: 1712 },
  TUN: { name: "Tunus", iso: "tn", elo: 1628 },

  BEL: { name: "Belçika", iso: "be", elo: 1894 },
  EGY: { name: "Mısır", iso: "eg", elo: 1696 },
  IRN: { name: "İran", iso: "ir", elo: 1772 }, // Ufak iso düzeltmesi ya da ir kalsın
  NZL: { name: "Yeni Zelanda", iso: "nz", elo: 1562 },

  ESP: { name: "İspanya", iso: "es", elo: 2157 },
  CPV: { name: "Cape Verde", iso: "cv", elo: 1578 },
  KSA: { name: "Suudi Arabistan", iso: "sa", elo: 1576 },
  URU: { name: "Uruguay", iso: "uy", elo: 1892 },

  FRA: { name: "Fransa", iso: "fr", elo: 2063 },
  SEN: { name: "Senegal", iso: "sn", elo: 1860 },
  IRQ: { name: "Irak", iso: "iq", elo: 1607 },
  NOR: { name: "Norveç", iso: "no", elo: 1914 },

  ARG: { name: "Arjantin", iso: "ar", elo: 2115 },
  ALG: { name: "Cezayir", iso: "dz", elo: 1772 },
  AUT: { name: "Avusturya", iso: "at", elo: 1830 },
  JOR: { name: "Ürdün", iso: "jo", elo: 1680 },

  POR: { name: "Portekiz", iso: "pt", elo: 1989 },
  COD: { name: "Kongo DC", iso: "cd", elo: 1652 },
  UZB: { name: "Özbekistan", iso: "uz", elo: 1714 },
  COL: { name: "Kolombiya", iso: "co", elo: 1982 },

  ENG: { name: "İngiltere", iso: "gb-eng", elo: 2024 },
  CRO: { name: "Hırvatistan", iso: "hr", elo: 1912 },
  GHA: { name: "Gana", iso: "gh", elo: 1510 },
  PAN: { name: "Panama", iso: "pa", elo: 1730 }
};

const GROUPS_CONFIG = {
  A: ["MEX","RSA","KOR","CZE"],
  B: ["CAN","BIH","QAT","SUI"],
  C: ["BRA","MAR","HAI","SCO"],
  D: ["USA","PAR","AUS","TUR"],
  E: ["GER","CUW","CIV","ECU"],
  F: ["NED","JPN","SWE","TUN"],
  G: ["BEL","EGY","IRN","NZL"],
  H: ["ESP","CPV","KSA","URU"],
  I: ["FRA","SEN","IRQ","NOR"],
  J: ["ARG","ALG","AUT","JOR"],
  K: ["POR","COD","UZB","COL"],
  L: ["ENG","CRO","GHA","PAN"]
};

const LOGO_URL = "https://upload.wikimedia.org/wikipedia/tr/1/19/2026_FIFA_D%C3%BCnya_Kupas%C4%B1.svg";

function generateAllFixtures() {
  const fixtures = [];
  Object.entries(GROUPS_CONFIG).forEach(([gName, teams]) => {
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++)
        fixtures.push({ id: `${gName}-${teams[i]}-${teams[j]}`, group: gName, home: teams[i], away: teams[j] });
  });
  return fixtures;
}

const getWinProbability = (eloA, eloB) => 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
const getFlagUrl = (iso) => iso ? `https://flagcdn.com/w40/${iso.toLowerCase()}.png` : "";

function scoreWinner(score) {
  if (!score || score.home === "" || score.away === "" || score.home === undefined || score.away === undefined) return null;
  const h = parseInt(score.home), a = parseInt(score.away);
  if (isNaN(h) || isNaN(a)) return null;
  if (h > a) return "home";
  if (a > h) return "away";
  return "draw"; 
}

// === IKI AŞAMALI (1X2 KORUMALI) ELO TABANLI SKOR MOTORU (YENİ) ===
function simulateEloWeightedScore(eloHome, eloAway) {
  // 1. AŞAMA: ELO farkına göre 1X2 olasılıklarını kesin tespit etme
  const pHomeWin = getWinProbability(eloHome, eloAway);
  const pAwayWin = getWinProbability(eloAway, eloHome);
  
  // ELO farkına göre dinamik bir beraberlik marjı (Dengeli takımlarda %26, fark açıldıkça azalır)
  const eloDiff = Math.abs(eloHome - eloAway);
  const pDraw = Math.max(0.05, 0.26 * Math.exp(-eloDiff / 400));

  // Olasılıkları normalize et (toplamı 1.0 olsun)
  const sumP = pHomeWin + pAwayWin + pDraw;
  const probHome = pHomeWin / sumP;
  const probAway = pAwayWin / sumP;
  const probDraw = pDraw / sumP;

  // Rulet seçimi ile 1X2 sonucunu belirle
  const rResult = Math.random();
  let selectedOutcome = "draw"; // varsayılan
  if (rResult < probHome) {
    selectedOutcome = "home";
  } else if (rResult < probHome + probAway) {
    selectedOutcome = "away";
  }

  // 2. AŞAMA: Belirlenen sonuca göre (Galibiyet/Beraberlik/Mağlubiyet) gerçekçi skor üretimi
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

  // 0 ile 7 gol arası tüm olası skor kombinasyon matrisini oluştur ve filtrele
  const validCombinations = [];
  let weightSum = 0;

  for (let h = 0; h <= 7; h++) {
    for (let a = 0; a <= 7; a++) {
      // Sadece 1. aşamada seçilen sonuca uyan skorları kabul et
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

  // Eğer ekstrem bir durumdan dolayı havuz boş kalırsa güvenli varsayılan ata
  if (validCombinations.length === 0 || weightSum === 0) {
    if (selectedOutcome === "home") return { home: 1, away: 0 };
    if (selectedOutcome === "away") return { home: 0, away: 1 };
    return { home: 1, away: 1 };
  }

  // Filtrelenmiş ve doğrulanmış skor havuzundan olasılıksal ağırlıklı seçim yap
  const rScore = Math.random();
  let cumulative = 0;
  for (let i = 0; i < validCombinations.length; i++) {
    cumulative += validCombinations[i].weight / weightSum;
    if (rScore <= cumulative) {
      return { home: validCombinations[i].home, away: validCombinations[i].away };
    }
  }

  return { home: validCombinations[validCombinations.length - 1].home, away: validCombinations[validCombinations.length - 1].away };
}

// === MATCH CARD ===
function MatchCard({ m, score }) {
  const flagA = INITIAL_TEAMS[m?.idA]?.iso;
  const flagB = INITIAL_TEAMS[m?.idB]?.iso;
  const nameA = INITIAL_TEAMS[m?.idA]?.name || "---";
  const nameB = INITIAL_TEAMS[m?.idB]?.name || "---";

  const hasScore = score && score.home !== "" && score.away !== "" && score.home !== undefined && score.away !== undefined;
  const sw = hasScore ? scoreWinner(score) : null;
  const actualWinner = hasScore ? (sw === "home" || sw === "draw" ? m?.idA : m?.idB) : m?.winner;
  const isWinnerA = actualWinner === m?.idA;
  const isWinnerB = actualWinner === m?.idB;

  const flagStyle = { width:15, height:11, borderRadius:2, objectFit:"cover", flexShrink:0, display:"block" };

  return (
    <div className="match-card" style={{ position:"relative" }}>
      <div className={`match-row ${isWinnerA ? "winner" : "loser"}`}>
        <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
          <img src={getFlagUrl(flagA)} style={flagStyle} alt="" />
          <span className="team-name">{nameA}</span>
        </div>
        {hasScore ? (
          <span style={{ fontFamily:"monospace", fontWeight:900, fontSize:11, color: isWinnerA ? "#047857" : "#94a3b8", minWidth:14, textAlign:"center", flexShrink:0 }}>
            {score.home}
          </span>
        ) : (
          <span className="pct-badge" style={{ color: isWinnerA ? "#047857" : "#64748b", flexShrink:0 }}>{m?.pA ?? 50}%</span>
        )}
      </div>
      <div className={`match-row ${isWinnerB ? "winner" : "loser"}`}>
        <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
          <img src={getFlagUrl(flagB)} style={flagStyle} alt="" />
          <span className="team-name">{nameB}</span>
        </div>
        {hasScore ? (
          <span style={{ fontFamily:"monospace", fontWeight:900, fontSize:11, color: isWinnerB ? "#047857" : "#94a3b8", minWidth:14, textAlign:"center", flexShrink:0 }}>
            {score.away}
          </span>
        ) : (
          <span className="pct-badge" style={{ color: isWinnerB ? "#047857" : "#64748b", flexShrink:0 }}>{m?.pB ?? 50}%</span>
        )}
      </div>
      {hasScore && (
        <div style={{ position:"absolute", top:2, right:2, width:6, height:6, borderRadius:"50%", background:"#10b981" }} />
      )}
    </div>
  );
}

// === LIVE BRACKET ===
function BracketView({ bracket, knockoutScores }) {
  const containerRef = useRef(null);
  const [tick, setTick] = useState(0);

  const lR32Ref = useRef(null); const lR16Ref = useRef(null);
  const lQFRef = useRef(null);  const lSFRef = useRef(null);
  const rSFRef = useRef(null);  const rQFRef = useRef(null);
  const rR16Ref = useRef(null); const rR32Ref = useRef(null);

  const [svgPaths, setSvgPaths] = useState([]);

  const measure = useCallback(() => {
    const container = containerRef?.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const newPaths = [];
    const draw = (colRefs, side) => {
      for (let ci = 0; ci < colRefs.length - 1; ci++) {
        const colEl = colRefs[ci]?.current;
        const nextColEl = colRefs[ci+1]?.current;
        if (!colEl || !nextColEl) continue;
        const cards = colEl.querySelectorAll(".match-card");
        const nextCards = nextColEl.querySelectorAll(".match-card");
        const pairCount = Math.min(Math.floor(cards.length / 2), nextCards.length);
        for (let i = 0; i < pairCount; i++) {
          const cardA = cards[i*2]; const cardB = cards[i*2+1]; const tCard = nextCards[i];
          if (!cardA || !cardB || !tCard) continue;
          const aRect = cardA.getBoundingClientRect();
          const bRect = cardB.getBoundingClientRect();
          const tRect = tCard.getBoundingClientRect();
          const y1 = aRect.top + aRect.height/2 - containerRect.top;
          const y2 = bRect.top + bRect.height/2 - containerRect.top;
          const yT = tRect.top + tRect.height/2 - containerRect.top;
          let x1, x2;
          if (side === "left") { x1 = aRect.right - containerRect.left; x2 = tRect.left - containerRect.left; }
          else { x1 = aRect.left - containerRect.left; x2 = tRect.right - containerRect.left; }
          const midX = (x1+x2)/2;
          newPaths.push(`M ${x1} ${y1} H ${midX} V ${y2} M ${midX} ${yT} H ${x2}`);
        }
      }
    };
    draw([lR32Ref,lR16Ref,lQFRef,lSFRef], "left");
    draw([rR32Ref,rR16Ref,rQFRef,rSFRef], "right");
    setSvgPaths(newPaths);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [bracket, measure, tick]);

  useEffect(() => {
    const t = setTimeout(() => setTick(n => n+1), 300);
    return () => clearTimeout(t);
  }, [bracket, knockoutScores]);

  const colStyle = (justify) => ({
    flex: "1 1 0%",
    minWidth: "115px",
    maxWidth: "135px",
    display: "flex",
    flexDirection: "column",
    justifyContent: justify || "space-around",
    gap: "4px"
  });

  const getScore = (m) => {
    if (!m?.idA || !m?.idB) return undefined;
    const key = `ko_${[m.idA,m.idB].sort().join("_")}`;
    return knockoutScores[key];
  };

  const getOrientedScore = (m, score) => {
    if (!score || !m?.idA || !m?.idB) return score;
    const key = `ko_${[m.idA,m.idB].sort().join("_")}`;
    const storedA = [m.idA,m.idB].sort()[0];
    if (m.idA === storedA) return score;
    return { home: score.away, away: score.home };
  };

  return (
    <div ref={containerRef} style={{ position:"relative", width:"100%", paddingTop:4 }}>
      {svgPaths.length > 0 && (
        <svg style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:5, overflow:"visible" }}>
          {svgPaths.map((d,i) => <path key={i} d={d} fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="none" />)}
        </svg>
      )}

      <div style={{ display:"flex", alignItems:"stretch", justifyItems:"center", justifyContent:"space-between", gap:"8px", width:"100%", position:"relative", zIndex:10 }}>
        <div ref={lR32Ref} style={colStyle("space-around")}>
          {bracket.left_r32.map((m,i) => {
            const sc = getOrientedScore(m, getScore(m));
            return <MatchCard key={i} m={m} score={sc} />;
          })}
        </div>
        <div ref={lR16Ref} style={colStyle("space-around")}>
          {bracket.left_r16.map((m,i) => {
            const sc = getOrientedScore(m, getScore(m));
            return <div key={i} style={{ display:"flex", alignItems:"center", flex:1 }}><MatchCard m={m} score={sc} /></div>;
          })}
        </div>
        <div ref={lQFRef} style={colStyle("space-around")}>
          {bracket.left_qf.map((m,i) => {
            const sc = getOrientedScore(m, getScore(m));
            return <div key={i} style={{ display:"flex", alignItems:"center", flex:1 }}><MatchCard m={m} score={sc} /></div>;
          })}
        </div>
        <div ref={lSFRef} style={{ ...colStyle("center"), justifyContent:"center" }}>
          {(() => { const sc = getOrientedScore(bracket.left_sf, getScore(bracket.left_sf)); return <MatchCard m={bracket.left_sf} score={sc} />; })()}
        </div>

        {/* CENTER PODIUM — yeniden tasarım */}
        <div style={{
          alignSelf:"center", width:"240px", flexShrink:0,
          display:"flex", flexDirection:"column", gap:6,
          fontFamily:"var(--font-sans)"
        }}>

          {/* ── FİNAL BLOĞU ── */}
          <div style={{
            background:"linear-gradient(160deg,#0a0f1e 0%,#0f2027 100%)",
            borderRadius:16, overflow:"hidden",
            boxShadow:"0 8px 32px rgba(10,15,30,0.22), 0 2px 8px rgba(0,0,0,0.12)",
            border:"1px solid rgba(245,158,11,0.25)"
          }}>
            {/* başlık şeridi */}
            <div style={{
              background:"linear-gradient(90deg,#d97706,#f59e0b)",
              padding:"5px 12px",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span style={{fontSize:9.5,fontWeight:900,color:"#fff",letterSpacing:"0.18em",textTransform:"uppercase"}}>FİNAL</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>

            <div style={{padding:"10px 12px 12px"}}>
              {/* Finalistler */}
              {[
                {id: bracket.finalMatch.idA, p: bracket.finalMatch.pA, isWinner: bracket.finalMatch.winner === bracket.finalMatch.idA},
                {id: bracket.finalMatch.idB, p: bracket.finalMatch.pB, isWinner: bracket.finalMatch.winner === bracket.finalMatch.idB},
              ].map((t, i) => (
                <div key={i}>
                  <div style={{
                    display:"flex", alignItems:"center", gap:7,
                    padding:"6px 8px", borderRadius:8,
                    background: t.isWinner ? "rgba(245,158,11,0.13)" : "rgba(255,255,255,0.05)",
                    border: t.isWinner ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(255,255,255,0.06)",
                    marginBottom: i === 0 ? 4 : 0,
                  }}>
                    <img src={getFlagUrl(INITIAL_TEAMS[t.id]?.iso)} style={{width:20,height:14,borderRadius:3,objectFit:"cover",flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}} alt="" />
                    <span style={{flex:1,fontSize:11.5,fontWeight: t.isWinner?800:600,color: t.isWinner?"#fbbf24":"rgba(255,255,255,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {INITIAL_TEAMS[t.id]?.name||"---"}
                    </span>
                    {t.isWinner && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    )}
                    <span style={{fontSize:10,fontFamily:"var(--font-mono)",fontWeight:800,color: t.isWinner?"#fbbf24":"rgba(255,255,255,0.4)",flexShrink:0}}>
                      {t.p}%
                    </span>
                  </div>
                  {i === 0 && (
                    <div style={{
                      width:"100%", height:5, background:"rgba(255,255,255,0.06)",
                      borderRadius:3, overflow:"hidden", display:"flex", margin:"6px 0"
                    }}>
                      <div style={{width:`${bracket.finalMatch.pA}%`,height:"100%",background:"linear-gradient(90deg,#10b981,#34d399)"}}/>
                      <div style={{width:`${bracket.finalMatch.pB}%`,height:"100%",background:"linear-gradient(90deg,#3b82f6,#60a5fa)"}}/>
                    </div>
                  )}
                </div>
              ))}

              {/* ŞAMPİYON kutu */}
              <div style={{
                marginTop:8,
                background:"linear-gradient(135deg,rgba(217,119,6,0.18),rgba(251,191,36,0.10))",
                border:"1px solid rgba(245,158,11,0.4)",
                borderRadius:10, padding:"8px 10px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:4
              }}>
                <span style={{fontSize:8.5,fontWeight:900,color:"rgba(251,191,36,0.7)",letterSpacing:"0.18em",textTransform:"uppercase",fontFamily:"var(--font-mono)"}}>DÜNYA ŞAMPİYONU</span>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <img src={LOGO_URL} style={{width:22,height:22,objectFit:"contain",opacity:0.9}} alt="" />
                  <img src={getFlagUrl(INITIAL_TEAMS[bracket.finalMatch.winner]?.iso)} style={{width:24,height:17,borderRadius:3,objectFit:"cover",boxShadow:"0 2px 6px rgba(0,0,0,0.35)"}} alt="" />
                  <span style={{fontSize:13,fontWeight:900,color:"#fbbf24",fontFamily:"var(--font-sans)",letterSpacing:"0.01em"}}>
                    {INITIAL_TEAMS[bracket.finalMatch.winner]?.name||"---"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ÜÇÜNCÜLÜK MAÇI BLOĞU ── */}
          <div style={{
            background:"#ffffff",
            border:"1px solid #e2e8f0",
            borderRadius:12, overflow:"hidden",
            boxShadow:"0 2px 10px rgba(0,0,0,0.06)"
          }}>
            <div style={{
              background:"linear-gradient(90deg,#7c3aed,#a855f7)",
              padding:"4px 10px",
              display:"flex", alignItems:"center", justifyContent:"center", gap:5
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span style={{fontSize:8.5,fontWeight:900,color:"#fff",letterSpacing:"0.16em",textTransform:"uppercase"}}>ÜÇÜNCÜLÜK MAÇI</span>
            </div>
            <div style={{padding:"8px 10px"}}>
              {[
                {id:bracket.thirdPlaceMatch.idA, p:bracket.thirdPlaceMatch.pA, isWinner: bracket.thirdPlaceMatch.winner===bracket.thirdPlaceMatch.idA},
                {id:bracket.thirdPlaceMatch.idB, p:bracket.thirdPlaceMatch.pB, isWinner: bracket.thirdPlaceMatch.winner===bracket.thirdPlaceMatch.idB},
              ].map((t,i) => (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"5px 6px", borderRadius:7,
                  background: t.isWinner ? "rgba(124,58,237,0.07)" : "transparent",
                  marginBottom: i===0 ? 3 : 0,
                }}>
                  <img src={getFlagUrl(INITIAL_TEAMS[t.id]?.iso)} style={{width:18,height:13,borderRadius:2,objectFit:"cover",flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}} alt="" />
                  <span style={{flex:1,fontSize:11,fontWeight: t.isWinner?700:500,color: t.isWinner?"#5b21b6":"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {INITIAL_TEAMS[t.id]?.name||"---"}
                  </span>
                  {t.isWinner && <svg width="10" height="10" viewBox="0 0 24 24" fill="#7c3aed"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                  <span style={{fontSize:10,fontFamily:"var(--font-mono)",fontWeight:700,color: t.isWinner?"#7c3aed":"#94a3b8",flexShrink:0}}>{t.p}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div ref={rSFRef} style={{ ...colStyle("center"), justifyContent:"center" }}>
          {(() => { const sc = getOrientedScore(bracket.right_sf, getScore(bracket.right_sf)); return <MatchCard m={bracket.right_sf} score={sc} />; })()}
        </div>
        <div ref={rQFRef} style={colStyle("space-around")}>
          {bracket.right_qf.map((m,i) => {
            const sc = getOrientedScore(m, getScore(m));
            return <div key={i} style={{ display:"flex", alignItems:"center", flex:1 }}><MatchCard m={m} score={sc} /></div>;
          })}
        </div>
        <div ref={rR16Ref} style={colStyle("space-around")}>
          {bracket.right_r16.map((m,i) => {
            const sc = getOrientedScore(m, getScore(m));
            return <div key={i} style={{ display:"flex", alignItems:"center", flex:1 }}><MatchCard m={m} score={sc} /></div>;
          })}
        </div>
        <div ref={rR32Ref} style={colStyle("space-around")}>
          {bracket.right_r32.map((m,i) => {
            const sc = getOrientedScore(m, getScore(m));
            return <MatchCard key={i} m={m} score={sc} />;
          })}
        </div>
      </div>
    </div>
  );
}

// === Eleme Skor Giriş Satırı ===
function KOMatchRow({ m, score, officialScore, onChange, onConfirmOfficial, onClearOfficial }) {
  if (!m?.idA || !m?.idB) return null;
  const key = `ko_${[m.idA,m.idB].sort().join("_")}`;
  const homeId = m.idA; const awayId = m.idB;
  const storedA = [m.idA,m.idB].sort()[0];

  const rawScore = score;
  const homeVal = rawScore ? (m.idA === storedA ? rawScore.home : rawScore.away) : "";
  const awayVal = rawScore ? (m.idA === storedA ? rawScore.away : rawScore.home) : "";

  const offRaw = officialScore;
  const offHome = offRaw ? (m.idA === storedA ? offRaw.home : offRaw.away) : "";
  const offAway = offRaw ? (m.idA === storedA ? offRaw.away : offRaw.home) : "";

  const hasScore = homeVal !== "" && awayVal !== "" && homeVal !== undefined && awayVal !== undefined;
  const hasOfficial = offHome !== "" && offAway !== "" && offHome !== undefined && offAway !== undefined;
  const isPrediction = hasScore && !hasOfficial;

  // Gösterim için hangi skoru kullanıyoruz
  const displayHome = hasOfficial ? offHome : homeVal;
  const displayAway = hasOfficial ? offAway : awayVal;

  const sw = (displayHome !== "" && displayAway !== "") ? (parseInt(displayHome) > parseInt(displayAway) ? homeId : (parseInt(displayAway) > parseInt(displayHome) ? awayId : homeId)) : null;

  const handleChange = (side, val) => {
    const sorted = [m.idA, m.idB].sort();
    const isAFirst = m.idA === sorted[0];
    if (side === "homeInput") {
      onChange(key, isAFirst ? "home" : "away", val);
    } else {
      onChange(key, isAFirst ? "away" : "home", val);
    }
  };

  return (
    <div className="fixture-row-container" style={{
      background: hasOfficial ? "rgba(16,185,129,0.06)" : (isPrediction ? "rgba(251,191,36,0.04)" : "#ffffff"),
      border:`1px solid ${hasOfficial ? "#10b981" : (isPrediction ? "rgba(251,191,36,0.5)" : "#cbd5e1")}`,
      boxShadow:"0 1px 3px rgba(0,0,0,0.02)"
    }}>
      <div className="fixture-team-block home">
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: sw===homeId ? "#047857" : "var(--text-primary)", fontWeight: sw===homeId ? 700 : 500 }}>
          {INITIAL_TEAMS[homeId]?.name}
        </span>
        <img src={getFlagUrl(INITIAL_TEAMS[homeId]?.iso)} style={{ width:16,height:11,borderRadius:2,objectFit:"cover",flexShrink:0 }} alt="" />
      </div>
      
      <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0, padding:"0 6px", position:"relative" }}>
        <input type="number" min="0" max="99" placeholder="-" value={homeVal ?? ""}
          onChange={e => handleChange("homeInput", e.target.value)}
          style={{ width:32, height:24, background: hasOfficial ? "#f0fdf4" : "#fff", border:`1px solid ${hasOfficial ? "#10b981" : "#cbd5e1"}`, borderRadius:5, textAlign:"center", color:"#047857", fontWeight:700, fontFamily:"monospace", fontSize:12, outline:"none" }} />
        <span style={{ color:"#94a3b8", fontWeight:700, fontSize:13 }}>:</span>
        <input type="number" min="0" max="99" placeholder="-" value={awayVal ?? ""}
          onChange={e => handleChange("awayInput", e.target.value)}
          style={{ width:32, height:24, background: hasOfficial ? "#f0fdf4" : "#fff", border:`1px solid ${hasOfficial ? "#10b981" : "#cbd5e1"}`, borderRadius:5, textAlign:"center", color:"#047857", fontWeight:700, fontFamily:"monospace", fontSize:12, outline:"none" }} />
        {isPrediction && (
          <span style={{position:"absolute", bottom:-11, left:"50%", transform:"translateX(-50%)", fontSize:"7.5px", color:"#d97706", fontWeight:800, fontFamily:"monospace", whiteSpace:"nowrap", letterSpacing:"0.02em"}}>TAH</span>
        )}
        {hasOfficial && (
          <span style={{position:"absolute", bottom:-11, left:"50%", transform:"translateX(-50%)", fontSize:"7.5px", color:"#059669", fontWeight:800, fontFamily:"monospace", whiteSpace:"nowrap", letterSpacing:"0.02em"}}>RESMİ</span>
        )}
      </div>

      <div className="fixture-team-block away">
        <img src={getFlagUrl(INITIAL_TEAMS[awayId]?.iso)} style={{ width:16,height:11,borderRadius:2,objectFit:"cover",flexShrink:0 }} alt="" />
        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: sw===awayId ? "#047857" : "var(--text-primary)", fontWeight: sw===awayId ? 700 : 500 }}>
          {INITIAL_TEAMS[awayId]?.name}
        </span>
      </div>

      {/* R butonu: tahmin varsa resmi olarak onayla */}
      {isPrediction && (
        <button
          title="Resmi sonuç olarak kaydet"
          onClick={() => onConfirmOfficial && onConfirmOfficial(key, rawScore)}
          style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"#fff",cursor:"pointer",fontSize:10,padding:"2px 6px",flexShrink:0,fontWeight:900,borderRadius:5,letterSpacing:"0.05em",boxShadow:"0 1px 4px rgba(16,185,129,0.3)"}}>R</button>
      )}
      {/* Resmi sonuç iptal */}
      {hasOfficial && (
        <button onClick={() => onClearOfficial && onClearOfficial(key)}
          style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:11, padding:"0 0 0 4px", flexShrink:0, fontWeight:700 }}>✕</button>
      )}
      {/* Sadece tahmin yoksa temizle */}
      {hasScore && !hasOfficial && !isPrediction && (
        <button onClick={() => { onChange(key,"home",""); onChange(key,"away",""); }}
          style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:11, padding:"0 0 0 4px", flexShrink:0, fontWeight:700 }}>✕</button>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("bracket");
  const [menuOpen, setMenuOpen] = useState(false);

  // --- DB'ye kaydedilen state'ler ---
  const [userScores,      setUserScores,      dbLoaded]       = usePersistentState("userScores", {});
  const [officialScores,  setOfficialScores]                  = usePersistentState("officialScores", {});
  const [officialKOScores,setOfficialKOScores]                = usePersistentState("officialKOScores", {});
  const [knockoutScores,  setKnockoutScores]                  = usePersistentState("knockoutScores", {});

  // customElo DB'ye kaydedilmez — manuel değişiklikler + API güncellemesi birleşir
  const [customElo, setCustomElo] = useState(() =>
    Object.fromEntries(Object.entries(INITIAL_TEAMS).map(([k,v]) => [k, v.elo]))
  );

  // --- Hesaplanan / geçici state'ler (DB'ye kaydedilmez) ---
  const [simResults, setSimResults] = useState(null);
  const [singleDisplayScores, setSingleDisplayScores] = useState({});
  const [liveTableData, setLiveTableData] = useState({ groups: {}, thirds: [] });
  const [officialOnlyTableData, setOfficialOnlyTableData] = useState({ groups: {}, thirds: [] });
  const groupsPanelRef = useRef(null);
  const bracketPanelRef = useRef(null);

  // ── Görsel indirme — layout-lock + offscreen ──────────────────────────────
  const loadHtml2Canvas = (cb) => {
    if (window.html2canvas) { cb(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = cb;
    document.head.appendChild(s);
  };

  const downloadAsImage = (ref, filename) => {
    if (!ref.current) return;
    const el = ref.current;

    loadHtml2Canvas(async () => {
      // Sayfayı en üste scroll et — koordinat hesabı netleşsin
      const prevScrollY = window.scrollY;
      window.scrollTo({ top: 0, behavior: "instant" });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Gerçek layout boyutları
      const rect = el.getBoundingClientRect();
      const W = Math.round(rect.width);
      const H = Math.round(el.scrollHeight);

      // Genişliği kilitle
      const prevWidth    = el.style.width;
      const prevMinWidth = el.style.minWidth;
      const prevMaxWidth = el.style.maxWidth;
      el.style.width    = W + "px";
      el.style.minWidth = W + "px";
      el.style.maxWidth = W + "px";
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const r2 = el.getBoundingClientRect();

      try {
        const canvas = await window.html2canvas(document.documentElement, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 15000,
          x: Math.round(r2.left),
          y: Math.round(r2.top),
          width:  W,
          height: H,
          scrollX: 0,
          scrollY: 0,
          windowWidth:  document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
        });
        const link = document.createElement("a");
        link.download = filename;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
      } finally {
        el.style.width    = prevWidth;
        el.style.minWidth = prevMinWidth;
        el.style.maxWidth = prevMaxWidth;
        window.scrollTo({ top: prevScrollY, behavior: "instant" });
      }
    });
  };

  const downloadBracket = () => {
    if (!bracketPanelRef.current) return;
    const el = bracketPanelRef.current;

    loadHtml2Canvas(async () => {
      const prevScrollY = window.scrollY;
      window.scrollTo({ top: 0, behavior: "instant" });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const sw = el.querySelector(".bracket-scroll-wrapper");
      const swPrevStyle = sw ? sw.getAttribute("style") || "" : null;
      const innerW = sw ? sw.scrollWidth : el.scrollWidth;

      if (sw) {
        sw.style.overflow  = "visible";
        sw.style.width     = innerW + "px";
        sw.style.minWidth  = innerW + "px";
        sw.style.maxWidth  = "none";
      }

      const prevWidth    = el.style.width;
      const prevMinWidth = el.style.minWidth;
      el.style.width    = innerW + "px";
      el.style.minWidth = innerW + "px";
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const r2 = el.getBoundingClientRect();
      const H = Math.round(el.scrollHeight);

      try {
        const canvas = await window.html2canvas(document.documentElement, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#f8fafc",
          logging: false,
          imageTimeout: 15000,
          x: Math.round(r2.left),
          y: Math.round(r2.top),
          width:  innerW,
          height: H,
          scrollX: 0,
          scrollY: 0,
          windowWidth:  innerW + 100,
          windowHeight: document.documentElement.scrollHeight,
        });
        const link = document.createElement("a");
        link.download = "turnuva_agaci_wc26.png";
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
      } finally {
        el.style.width    = prevWidth;
        el.style.minWidth = prevMinWidth;
        if (sw && swPrevStyle !== null) sw.setAttribute("style", swPrevStyle);
        window.scrollTo({ top: prevScrollY, behavior: "instant" });
      }
    });
  };

  // --- ELO otomatik güncelleme (saatte bir) ---
  useEffect(() => {
    const fetchElo = async () => {
      try {
        const res = await fetch("/api/elo");
        if (!res.ok) return;
        const data = await res.json();
        if (data.elo && Object.keys(data.elo).length > 0) {
          // API'den gelen değerleri direkt yaz — manuel değişiklikler korunur, sadece API'dekiler güncellenir
          setCustomElo(prev => ({ ...prev, ...data.elo }));
          console.log(`[ELO] ${data.count} takım güncellendi:`, data.updated);
        }
      } catch (e) {
        console.warn("[ELO] Güncelleme başarısız:", e.message);
      }
    };

    fetchElo();
    const interval = setInterval(fetchElo, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const [eloSearch, setEloSearch] = useState("");
  const [groupsSection, setGroupsSection] = useState("groups");
  const [activeGroupTab, setActiveGroupTab] = useState("A");

  const activeTeams = Object.fromEntries(
    Object.entries(INITIAL_TEAMS).map(([k,v]) => [k, { ...v, elo: customElo[k] ?? v.elo }])
  );

  // KESİN TABLO DURUMUNU HESAPLAYAN YAN ETKİ (Resmi skorlara ya da simüle skorlara göre tam sayılar üretir)
  useEffect(() => {
    if (!simResults || !singleDisplayScores) return;

    const points = {}; const gd = {}; const gf = {};
    Object.keys(activeTeams).forEach(id => { points[id] = 0; gd[id] = 0; gf[id] = 0; });

    const fixtures = generateAllFixtures();
    fixtures.forEach(f => {
      const officialSc = officialScores[f.id];
      const userSc = userScores[f.id];
      let hG = 0; let aG = 0;

      if (officialSc && officialSc.home !== "" && officialSc.away !== "") {
        // Resmi sonuç (R tuşuyla onaylanmış) — kesin olarak kullan
        hG = parseInt(officialSc.home) || 0;
        aG = parseInt(officialSc.away) || 0;
      } else if (userSc && userSc.home !== "" && userSc.away !== "") {
        // Kullanıcı tahmini — tabloya yansıt (ama olasılıkları etkilemiyor)
        hG = parseInt(userSc.home) || 0;
        aG = parseInt(userSc.away) || 0;
      } else if (singleDisplayScores[f.id]) {
        hG = singleDisplayScores[f.id].home;
        aG = singleDisplayScores[f.id].away;
      }

      gf[f.home] += hG; gf[f.away] += aG;
      gd[f.home] += (hG - aG); gd[f.away] += (aG - hG);
      
      if (hG > aG) points[f.home] += 3;
      else if (aG > hG) points[f.away] += 3;
      else { points[f.home] += 1; points[f.away] += 1; }
    });

    const groupsOutput = {};
    const thirdsOutput = [];

    Object.entries(GROUPS_CONFIG).forEach(([gName, gTeams]) => {
      const sorted = [...gTeams].sort((a, b) => 
        points[b] - points[a] || gd[b] - gd[a] || gf[b] - gf[a] || activeTeams[b].elo - activeTeams[a].elo
      );
      groupsOutput[gName] = sorted.map(id => ({ id, pts: points[id], gd: gd[id], gf: gf[id] }));
      thirdsOutput.push({ id: sorted[2], group: gName, pts: points[sorted[2]], gd: gd[sorted[2]], gf: gf[sorted[2]] });
    });

    const sortedThirds = thirdsOutput.sort((a, b) => 
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || activeTeams[b.id].elo - activeTeams[a.id].elo
    );

    setLiveTableData({ groups: groupsOutput, thirds: sortedThirds });
  }, [userScores, officialScores, singleDisplayScores, simResults]);

  // SADECE RESMİ ONAYLANAN SKORLARDAN OLUŞAN TABLO (Anlık Puan Durumu)
  useEffect(() => {
    const points2 = {}; const gd2 = {}; const gf2 = {};
    Object.keys(activeTeams).forEach(id => { points2[id] = 0; gd2[id] = 0; gf2[id] = 0; });
    const fixtures2 = generateAllFixtures();
    fixtures2.forEach(f => {
      const sc = officialScores[f.id];
      if (!sc || sc.home === "" || sc.away === "") return;
      const hG = parseInt(sc.home) || 0;
      const aG = parseInt(sc.away) || 0;
      gf2[f.home] += hG; gf2[f.away] += aG;
      gd2[f.home] += (hG - aG); gd2[f.away] += (aG - hG);
      if (hG > aG) points2[f.home] += 3;
      else if (aG > hG) points2[f.away] += 3;
      else { points2[f.home] += 1; points2[f.away] += 1; }
    });
    const groups2 = {};
    const thirds2 = [];
    Object.entries(GROUPS_CONFIG).forEach(([gName, gTeams]) => {
      const sorted2 = [...gTeams].sort((a, b) =>
        points2[b] - points2[a] || gd2[b] - gd2[a] || gf2[b] - gf2[a] || activeTeams[b].elo - activeTeams[a].elo
      );
      groups2[gName] = sorted2.map(id => ({ id, pts: points2[id], gd: gd2[id], gf: gf2[id] }));
      thirds2.push({ id: sorted2[2], group: gName, pts: points2[sorted2[2]], gd: gd2[sorted2[2]], gf: gf2[sorted2[2]] });
    });
    const sortedThirds2 = thirds2.sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || activeTeams[b.id].elo - activeTeams[a.id].elo
    );
    setOfficialOnlyTableData({ groups: groups2, thirds: sortedThirds2 });
  }, [officialScores]);

  // Monte Carlo tetikleyici
  useEffect(() => {
    const results = runAdvancedSimulation(activeTeams, officialScores);
    setSimResults(results);
    if (results && results.displayScores) {
      setSingleDisplayScores(results.displayScores);
    }
  }, [officialScores, customElo]);

  const handleScoreChange = (fixtureId, side, value) => {
    setUserScores(prev => ({ ...prev, [fixtureId]: { ...prev[fixtureId], [side]: value } }));
  };

  const getKOWinner = (idA, idB) => {
    if (!idA || !idB) return null;
    const key = `ko_${[idA,idB].sort().join("_")}`;
    // Önce resmi sonuca bak, yoksa knockoutScores'a
    const sc = officialKOScores[key] || knockoutScores[key];
    if (!sc || sc.home === "" || sc.away === "" || sc.home === undefined || sc.away === undefined) return null;
    const sorted = [idA,idB].sort();
    const h = parseInt(sc.home), a = parseInt(sc.away);
    if (isNaN(h) || isNaN(a)) return null;
    if (h > a) return sorted[0];
    if (a > h) return sorted[1];
    return sorted[0]; 
  };

  // === MONTE CARLO SIMÜLASYON MOTORU ===
  function runAdvancedSimulation(teams, userScores) {
    const SIM_COUNT = 1000;
    const stats = {};
    const matchupStats = {};
    const firstSimDisplayScores = {};

    Object.keys(teams).forEach(id => {
      stats[id] = { id, r32:0,r16:0,qf:0,sf:0,f:0,champion:0,thirdPlaceChamp:0,g1:0,g2:0,g3:0,g4:0 };
    });
    
    const fixtures = generateAllFixtures();

    for (let sim = 0; sim < SIM_COUNT; sim++) {
      const points={}; const gd={}; const gf={};
      Object.keys(teams).forEach(id => { points[id]=0; gd[id]=0; gf[id]=0; });
      
      fixtures.forEach(f => {
        const saved = officialScores[f.id]; // Sadece resmi onaylı skorlar simülasyonu kilitler
        let hG = 0; let aG = 0;

        if (saved && saved.home !== "" && saved.away !== "") {
          hG = parseInt(saved.home) || 0; 
          aG = parseInt(saved.away) || 0;
        } else {
          const simScore = simulateEloWeightedScore(teams[f.home].elo, teams[f.away].elo);
          hG = simScore.home;
          aG = simScore.away;

          if (sim === 0) {
            firstSimDisplayScores[f.id] = { home: hG, away: aG, isSimulated: true };
          }
        }

        points[f.home] += (hG > aG) ? 3 : (hG === aG ? 1 : 0);
        points[f.away] += (aG > hG) ? 3 : (hG === aG ? 1 : 0);
        gf[f.home] += hG; gf[f.away] += aG; 
        gd[f.home] += (hG - aG); gd[f.away] += (aG - hG);
      });

      const winners={}; const runners={}; const thirds=[];
      Object.entries(GROUPS_CONFIG).forEach(([gName,gTeams]) => {
        const sorted=[...gTeams].sort((a,b)=>points[b]-points[a]||gd[b]-gd[a]||gf[b]-gf[a]||teams[b].elo-teams[a].elo);
        winners[gName]=sorted[0]; runners[gName]=sorted[1];
        thirds.push({id:sorted[2],group:gName,pts:points[sorted[2]],gd:gd[sorted[2]],gf:gf[sorted[2]],elo:teams[sorted[2]].elo});
        // Grup bitiş pozisyonu istatistikleri
        if(stats[sorted[0]])stats[sorted[0]].g1++;
        if(stats[sorted[1]])stats[sorted[1]].g2++;
        if(stats[sorted[2]])stats[sorted[2]].g3++;
        if(stats[sorted[3]])stats[sorted[3]].g4++;
      });

      const bestThirds = [...thirds].sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.elo - a.elo);
      const qualifiedThirds = bestThirds.slice(0,8); // Değişkeni burada tanımlıyoruz
      
      // Şimdi qualifiedThirds artık erişilebilir durumda
      const qualifiedLetters = qualifiedThirds.map(t => t.group).sort().join("");
      
      // Annex C slot sırası (index): 0=1A, 1=1B, 2=1D, 3=1E, 4=1G, 5=1I, 6=1K, 7=1L
      const getThirdId = (idx) => {
        const targetGroup = getFifaTargetThird(qualifiedLetters, idx);
        const tgt = qualifiedThirds.find(t => t.group === targetGroup);
        return tgt ? tgt.id : null;
      };

      // Annex C slot sırası (index): 0=1A, 1=1B, 2=1D, 3=1E, 4=1G, 5=1I, 6=1K, 7=1L
      const r32Matches=[
        [winners["E"],getThirdId(3)],[winners["I"],getThirdId(5)],  // M74, M77
        [runners["A"],runners["B"]],[winners["F"],runners["C"]],    // M73, M75
        [runners["K"],runners["L"]],[winners["H"],runners["J"]],    // M83, M84
        [winners["D"],getThirdId(2)],[winners["G"],getThirdId(4)],  // M81, M82
        [winners["C"],runners["F"]],[runners["E"],runners["I"]],    // M76, M78
        [winners["A"],getThirdId(0)],[winners["L"],getThirdId(7)],  // M79, M80
        [winners["J"],runners["H"]],[runners["D"],runners["G"]],    // M86, M88
        [winners["B"],getThirdId(1)],[winners["K"],getThirdId(6)]   // M85, M87
      ];

      r32Matches.forEach(m=>{ if(m[0]&&stats[m[0]])stats[m[0]].r32++; if(m[1]&&stats[m[1]])stats[m[1]].r32++; });
      const runStage=(matches,nextKey)=>{
        const wL=[]; const loL=[];
        matches.forEach(m=>{
          const idA=m[0]; const idB=m[1]; if(!idB){wL.push(idA);return;}
          const pk=[idA,idB].sort().join("_vs_");
          if(!matchupStats[pk]) matchupStats[pk]={total:0,[idA]:0,[idB]:0};
          matchupStats[pk].total++;
          const pA=getWinProbability(teams[idA].elo,teams[idB].elo);
          if(Math.random()<pA){wL.push(idA);loL.push(idB);matchupStats[pk][idA]++;}
          else{wL.push(idB);loL.push(idA);matchupStats[pk][idB]++;}
        });
        wL.forEach(id=>{if(id&&stats[id])stats[id][nextKey]++;});
        const pairs=[]; for(let i=0;i<wL.length;i+=2){if(wL[i])pairs.push([wL[i],wL[i+1]]);}
        return {pairs,losersList:loL};
      };

      const r16R=runStage(r32Matches,"r16"); const qfR=runStage(r16R.pairs,"qf");
      const sfR=runStage(qfR.pairs,"sf"); runStage(sfR.pairs,"f");
      const sfM=sfR.pairs;
      if(sfM.length>=2){
        const sf1A=sfM[0][0],sf1B=sfM[0][1],sf2A=sfM[1][0],sf2B=sfM[1][1];
        const w1=Math.random()<getWinProbability(teams[sf1A].elo,teams[sf1B].elo)?sf1A:sf1B; const l1=w1===sf1A?sf1B:sf1A;
        const w2=Math.random()<getWinProbability(teams[sf2A].elo,teams[sf2B].elo)?sf2A:sf2B; const l2=w2===sf2A?sf2B:sf2A;
        const champ=Math.random()<getWinProbability(teams[w1].elo,teams[w2].elo)?w1:w2;
        if(stats[champ])stats[champ].champion++;
        const tpw=Math.random()<getWinProbability(teams[l1].elo,teams[l2].elo)?l1:l2;
        if(stats[tpw])stats[tpw].thirdPlaceChamp++;
      }
    }

    Object.keys(stats).forEach(id=>{
      const s=SIM_COUNT;
      stats[id].r32=(stats[id].r32/s)*100; stats[id].r16=(stats[id].r16/s)*100;
      stats[id].qf=(stats[id].qf/s)*100; stats[id].sf=(stats[id].sf/s)*100;
      stats[id].f=(stats[id].f/s)*100; stats[id].champion=(stats[id].champion/s)*100;
      stats[id].thirdPlaceChamp=(stats[id].thirdPlaceChamp/s)*100;
      stats[id].g1=(stats[id].g1/s)*100; stats[id].g2=(stats[id].g2/s)*100;
      stats[id].g3=(stats[id].g3/s)*100; stats[id].g4=(stats[id].g4/s)*100;
    });

    return {teams:stats, matchups:matchupStats, displayScores:firstSimDisplayScores};
  }

  const buildLiveBracket = () => {
    if (!simResults || !liveTableData.groups || Object.keys(liveTableData.groups).length === 0) return null;
    
    const getTop = (g) => (liveTableData.groups[g] || []).map(t => t.id);
    
    const allThirds = Object.keys(GROUPS_CONFIG).map(g => getTop(g)[2]);
    const sortedThirds = [...allThirds].sort((a, b) => {
      const tB = liveTableData.thirds.find(x => x.id === b) || { pts: 0, gd: 0 };
      const tA = liveTableData.thirds.find(x => x.id === a) || { pts: 0, gd: 0 };
      return tB.pts - tA.pts || tB.gd - tA.gd || activeTeams[b].elo - activeTeams[a].elo;
    });

    const qualifiedThirds = sortedThirds.slice(0, 8);
    const qualifiedLetters = qualifiedThirds.map(id => Object.keys(GROUPS_CONFIG).find(g => GROUPS_CONFIG[g].includes(id))).sort().join("");
    // Annex C slot sırası (index): 0=1A, 1=1B, 2=1D, 3=1E, 4=1G, 5=1I, 6=1K, 7=1L
    const slotMap = {};
    [0,1,2,3,4,5,6,7].forEach((idx) => {
      const targetGroup = getFifaTargetThird(qualifiedLetters, idx);
      const foundId = qualifiedThirds.find(id => GROUPS_CONFIG[targetGroup]?.includes(id));
      slotMap[idx] = foundId || null;
    });

    const resolveMatch = (idA, idB) => {
      if (!idA || !idB) return { idA, idB, pA: 50, pB: 50, winner: idA || idB, loser: idA || idB };
      const koW = getKOWinner(idA, idB);
      if (koW) {
        return { idA, idB, pA: koW === idA ? 100 : 0, pB: koW === idB ? 100 : 0, winner: koW, loser: koW === idA ? idB : idA, hasScore: true };
      }
      const mKey = [idA, idB].sort().join("_vs_");
      const mh = simResults.matchups[mKey];
      let pA = mh && mh.total > 0 ? Math.round((mh[idA] / mh.total) * 100) : Math.round(getWinProbability(activeTeams[idA]?.elo || 1600, activeTeams[idB]?.elo || 1600) * 100);
      return { idA, idB, pA, pB: 100 - pA, winner: pA >= 50 ? idA : idB, loser: pA >= 50 ? idB : idA };
    };

    const left_r32 = [
      resolveMatch(getTop("E")[0], slotMap[3]), resolveMatch(getTop("I")[0], slotMap[5]),  // M74, M77
      resolveMatch(getTop("A")[1], getTop("B")[1]), resolveMatch(getTop("F")[0], getTop("C")[1]),  // M73, M75
      resolveMatch(getTop("K")[1], getTop("L")[1]), resolveMatch(getTop("H")[0], getTop("J")[1]),  // M83, M84
      resolveMatch(getTop("D")[0], slotMap[2]), resolveMatch(getTop("G")[0], slotMap[4])   // M81, M82
    ];
    const left_r16 = [
      resolveMatch(left_r32[0].winner, left_r32[1].winner), resolveMatch(left_r32[2].winner, left_r32[3].winner),
      resolveMatch(left_r32[4].winner, left_r32[5].winner), resolveMatch(left_r32[6].winner, left_r32[7].winner)
    ];
    const left_qf = [resolveMatch(left_r16[0].winner, left_r16[1].winner), resolveMatch(left_r16[2].winner, left_r16[3].winner)];
    const left_sf = resolveMatch(left_qf[0].winner, left_qf[1].winner);
    
    const right_r32 = [
      resolveMatch(getTop("C")[0], getTop("F")[1]), resolveMatch(getTop("E")[1], getTop("I")[1]),  // M76, M78
      resolveMatch(getTop("A")[0], slotMap[0]), resolveMatch(getTop("L")[0], slotMap[7]),          // M79, M80
      resolveMatch(getTop("J")[0], getTop("H")[1]), resolveMatch(getTop("D")[1], getTop("G")[1]),  // M86, M88
      resolveMatch(getTop("B")[0], slotMap[1]), resolveMatch(getTop("K")[0], slotMap[6])           // M85, M87
    ];
    const right_r16 = [
      resolveMatch(right_r32[0].winner, right_r32[1].winner), resolveMatch(right_r32[2].winner, right_r32[3].winner),
      resolveMatch(right_r32[4].winner, right_r32[5].winner), resolveMatch(right_r32[6].winner, right_r32[7].winner)
    ];
    const right_qf = [resolveMatch(right_r16[0].winner, right_r16[1].winner), resolveMatch(right_r16[2].winner, right_r16[3].winner)];
    const right_sf = resolveMatch(right_qf[0].winner, right_qf[1].winner);
    
    const finalMatch = resolveMatch(left_sf.winner, right_sf.winner);
    const thirdPlaceMatch = resolveMatch(left_sf.loser, right_sf.loser);
    return { left_r32, left_r16, left_qf, left_sf, right_r32, right_r16, right_qf, right_sf, finalMatch, thirdPlaceMatch, sortedThirds, qualifiedThirds };
  };

  const bracket = buildLiveBracket();
  const allFixtures = generateAllFixtures();

  const renderGroups = () => {
    if (!liveTableData.groups || Object.keys(liveTableData.groups).length === 0) return null;
    const qualifiedThirdIds = new Set((liveTableData.thirds || []).slice(0, 8).map(t => t.id));
    return Object.keys(GROUPS_CONFIG).map(gName => {
      const sorted = liveTableData.groups[gName] || [];
      return (
        <div key={gName} className="group-card">
          {/* Grup başlık + kolon etiketleri */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"2px solid #f0fdf4",paddingBottom:6,marginBottom:6}}>
            <span style={{fontSize:10.5,fontWeight:900,color:"#047857",letterSpacing:"0.09em",textTransform:"uppercase",fontFamily:"var(--font-sans)"}}>GRUP {gName}</span>
            <div style={{display:"flex",gap:0,alignItems:"center"}}>
              <span style={{fontSize:10,fontWeight:800,color:"#1d4ed8",fontFamily:"var(--font-mono)",width:32,textAlign:"center",letterSpacing:"0.04em"}}>AV</span>
              <span style={{fontSize:10,fontWeight:800,color:"#0f172a",fontFamily:"var(--font-mono)",width:24,textAlign:"center",letterSpacing:"0.04em"}}>P</span>
            </div>
          </div>
          {/* Satırlar */}
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {sorted.map((item, index) => {
              const id = item.id;
              const isTop2 = index < 2;
              const isQThird = index === 2 && qualifiedThirdIds.has(id);
              let rowBg = "transparent";
              let leftAccent = "transparent";
              let nameColor = "#374151";
              let fontWeight = 500;
              if (isTop2) {
                rowBg = "rgba(16,185,129,0.09)";
                leftAccent = "#10b981";
                nameColor = "#065f46";
                fontWeight = 700;
              } else if (isQThird) {
                rowBg = "rgba(249,115,22,0.09)";
                leftAccent = "#f97316";
                nameColor = "#9a3412";
                fontWeight = 700;
              }
              const gdColor = item.gd > 0 ? "#1d4ed8" : item.gd < 0 ? "#dc2626" : "#94a3b8";
              return (
                <div key={id} style={{
                  display:"flex",
                  alignItems:"center",
                  background: rowBg,
                  borderRadius: 6,
                  borderLeft: `3px solid ${leftAccent}`,
                  paddingLeft: 5,
                  paddingRight: 4,
                  paddingTop: 3,
                  paddingBottom: 3,
                  minHeight: 26,
                }}>
                  {/* Sıra */}
                  <span style={{fontSize:9.5,fontFamily:"var(--font-mono)",fontWeight:700,color: isTop2?"#059669": isQThird?"#ea580c":"#cbd5e1",width:12,flexShrink:0,textAlign:"center"}}>{index+1}</span>
                  {/* Bayrak */}
                  <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:17,height:12,borderRadius:2,objectFit:"cover",flexShrink:0,margin:"0 5px 0 4px",boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}} alt="" />
                  {/* İsim */}
                  <span style={{flex:1,fontSize:12,fontWeight,color:nameColor,whiteSpace:"nowrap",fontFamily:"var(--font-sans)"}}>{INITIAL_TEAMS[id]?.name}</span>
                  {/* AV */}
                  <span style={{width:32,textAlign:"center",fontSize:11,fontFamily:"var(--font-mono)",fontWeight:700,color:gdColor,flexShrink:0}}>
                    {item.gd > 0 ? `+${item.gd}` : item.gd}
                  </span>
                  {/* P */}
                  <span style={{width:24,textAlign:"center",fontSize:12,fontFamily:"var(--font-mono)",fontWeight:900,color: isTop2?"#047857": isQThird?"#ea580c":"#0f172a",flexShrink:0}}>
                    {item.pts}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const inputStyle = { width:32, height:24, background:"#fff", border:"1px solid #cbd5e1", borderRadius:5, textAlign:"center", color:"#047857", fontWeight:700, fontFamily:"monospace", fontSize:12, outline:"none", flexShrink:0 };

  // DB yüklenene kadar splash göster
  if (!dbLoaded) {
    return (
      <div style={{minHeight:"100vh",background:"var(--bg-deep)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
        <img src="https://upload.wikimedia.org/wikipedia/tr/1/19/2026_FIFA_D%C3%BCnya_Kupas%C4%B1.svg" style={{width:64,height:64,objectFit:"contain",opacity:0.8}} alt="" />
        <div style={{fontSize:13,fontWeight:700,color:"#64748b",fontFamily:"monospace",letterSpacing:"0.1em"}}>VERİTABANINDAN YÜKLENİYOR...</div>
        <div style={{width:180,height:4,background:"#e2e8f0",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:4,animation:"shimmer 1.2s ease-in-out infinite",width:"60%"}} />
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"var(--bg-deep)",color:"var(--text-primary)",fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      {/* HEADER */}
      <header style={{height:52,background:"#0a0f1e",borderBottom:"1px solid rgba(255,255,255,0.08)",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 16px rgba(0,0,0,0.3)"}}>
        {/* Logo + başlık */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#d97706,#f59e0b)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(217,119,6,0.4)",flexShrink:0}}>
            <img src={LOGO_URL} style={{width:22,height:22,objectFit:"contain"}} alt="Logo" />
          </div>
          <div>
            <h1 style={{margin:0,fontSize:13,fontWeight:900,letterSpacing:"0.07em",textTransform:"uppercase",color:"#ffffff",fontFamily:"'Inter',system-ui,sans-serif",lineHeight:1.2}}>
              WORLDCUP<span style={{color:"#f59e0b"}}>'26</span> <span className="hide-xs">ANALYTICA</span>
            </h1>
            <p style={{margin:0,fontSize:7.5,color:"#10b981",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:"0.14em",lineHeight:1.3}} className="hide-xs">10,000× MONTE CARLO LIVE PROJECTION</p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="desktop-nav" style={{display:"flex",background:"rgba(255,255,255,0.06)",padding:3,borderRadius:11,border:"1px solid rgba(255,255,255,0.1)",gap:2}}>
          {[["bracket","Turnuva Ağacı"],["groupstats","Grup Analizi"],["groups","Skor Girişi"],["matrix","Olasılık Matrisi"],["elo","ELO Güncelle"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} className={`nav-btn ${activeTab===tab?"active":"inactive"}`}>{label}</button>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="hamburger-btn"
          onClick={()=>setMenuOpen(o=>!o)}
          style={{display:"none",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:9,width:38,height:38,alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,flexDirection:"column",gap:5,padding:0}}
          aria-label="Menü"
        >
          <span style={{display:"block",width:18,height:2,background: menuOpen?"#f59e0b":"rgba(255,255,255,0.8)",borderRadius:2,transition:"all 0.2s",transform: menuOpen?"rotate(45deg) translate(5px,5px)":"none"}}/>
          <span style={{display:"block",width:18,height:2,background: menuOpen?"transparent":"rgba(255,255,255,0.8)",borderRadius:2,transition:"all 0.2s"}}/>
          <span style={{display:"block",width:18,height:2,background: menuOpen?"#f59e0b":"rgba(255,255,255,0.8)",borderRadius:2,transition:"all 0.2s",transform: menuOpen?"rotate(-45deg) translate(5px,-5px)":"none"}}/>
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-menu" style={{position:"sticky",top:52,zIndex:190,background:"#0d1628",borderBottom:"1px solid rgba(255,255,255,0.10)",padding:"8px 12px",display:"flex",flexDirection:"column",gap:4,boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}}>
          {[["bracket","🏆 Turnuva Ağacı"],["groupstats","📈 Grup Analizi"],["groups","⚽ Skor Girişi"],["matrix","📊 Olasılık Matrisi"],["elo","⚡ ELO Güncelle"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>{setActiveTab(tab);setMenuOpen(false);}}
              style={{
                width:"100%",textAlign:"left",padding:"11px 14px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",border:"none",
                background: activeTab===tab?"linear-gradient(135deg,#10b981,#059669)":"rgba(255,255,255,0.05)",
                color: activeTab===tab?"#fff":"rgba(255,255,255,0.75)",
                boxShadow: activeTab===tab?"0 2px 8px rgba(16,185,129,0.25)":"none",
                transition:"all 0.15s"
              }}>{label}</button>
          ))}
        </div>
      )}

      <main style={{flex:1,padding:"12px 12px 32px",maxWidth:"100%",width:"100%"}}>

        {/* === BRACKET TAB === */}
        {activeTab==="bracket" && bracket && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* İndirme Butonları */}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
              <button onClick={()=>downloadAsImage(groupsPanelRef,"gruplar_ve_3ler_wc26.png")}
                style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#0284c7)",border:"none",color:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",boxShadow:"0 2px 8px rgba(2,132,199,0.35)",letterSpacing:"0.04em",fontFamily:"monospace"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                GRUPLAR + 3.LER
              </button>
              <button onClick={()=>downloadBracket()}
                style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",color:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",boxShadow:"0 2px 8px rgba(217,119,6,0.35)",letterSpacing:"0.04em",fontFamily:"monospace"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                TURNUVA AĞACI
              </button>
            </div>
            {/* 4x3 Groups Grid + 3.ler Panel — mobilde dikey */}
            <div className="bracket-top-panel" ref={groupsPanelRef}>
              {/* Groups 4x3 */}
              <div style={{flex:1,minWidth:0,background:"#ffffff",border:"1px solid #e8edf3",borderRadius:14,padding:"10px 12px",boxShadow:"0 2px 8px rgba(0,0,0,0.03)"}}>
                <div className="groups-panel-grid">{renderGroups()}</div>
              </div>
              {/* Thirds Panel - right side, same height */}
              <div className="thirds-panel" style={{flexShrink:0,background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:14,padding:"10px 12px",boxShadow:"0 2px 8px rgba(0,0,0,0.03)",display:"flex",flexDirection:"column"}}>
                {/* Başlık + kolon etiketleri — grup kartlarıyla aynı stil */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"2px solid #f0fdf4",paddingBottom:6,marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <span style={{fontSize:10.5,fontWeight:900,color:"#047857",letterSpacing:"0.09em",textTransform:"uppercase",fontFamily:"var(--font-sans)"}}>EN İYİ 3.LER</span>
                  </div>
                  <div style={{display:"flex",gap:0,alignItems:"center"}}>
                    <span style={{fontSize:10,fontWeight:800,color:"#1d4ed8",fontFamily:"var(--font-mono)",width:32,textAlign:"center",letterSpacing:"0.04em"}}>AV</span>
                    <span style={{fontSize:10,fontWeight:800,color:"#0f172a",fontFamily:"var(--font-mono)",width:24,textAlign:"center",letterSpacing:"0.04em"}}>P</span>
                  </div>
                </div>
                <div className="thirds-mobile-grid" style={{display:"flex",flexDirection:"column",gap:2,flex:1}}>
                  {bracket.sortedThirds.map((id, index) => {
                    const isQ = bracket.qualifiedThirds.includes(id);
                    const gLetter = Object.keys(GROUPS_CONFIG).find(g => GROUPS_CONFIG[g].includes(id));
                    const tData = liveTableData.thirds.find(x => x.id === id) || { pts: 0, gd: 0 };
                    const leftAccent = isQ ? "#f97316" : "transparent";
                    const rowBg = isQ ? "rgba(249,115,22,0.09)" : "transparent";
                    const nameColor = isQ ? "#9a3412" : "#374151";
                    const gdColor = tData.gd > 0 ? "#1d4ed8" : tData.gd < 0 ? "#dc2626" : "#94a3b8";
                    const gdColorFinal = isQ ? gdColor : "#94a3b8";
                    return (
                      <div key={id} style={{
                        display:"flex", alignItems:"center",
                        background: rowBg,
                        borderRadius: 6,
                        borderLeft: `3px solid ${leftAccent}`,
                        paddingLeft: 5, paddingRight: 4,
                        paddingTop: 3, paddingBottom: 3,
                        minHeight: 26,
                      }}>
                        <span style={{fontSize:9.5,fontFamily:"var(--font-mono)",fontWeight:700,color: isQ?"#ea580c":"#94a3b8",width:16,flexShrink:0,textAlign:"center"}}>{index+1}</span>
                        <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:17,height:12,borderRadius:2,objectFit:"cover",flexShrink:0,margin:"0 5px 0 4px",boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}} alt="" />
                        <span style={{flex:1,fontSize:11.5,fontWeight: isQ?700:500,color:nameColor,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"var(--font-sans)"}}>
                          {INITIAL_TEAMS[id]?.name} <span style={{fontSize:9,color: isQ?"#f97316":"#94a3b8",fontFamily:"var(--font-mono)",fontWeight:600}}>({gLetter})</span>
                        </span>
                        {/* AV */}
                        <span style={{width:32,textAlign:"center",fontSize:11,fontFamily:"var(--font-mono)",fontWeight:700,color:gdColorFinal,flexShrink:0}}>
                          {tData.gd > 0 ? `+${tData.gd}` : tData.gd}
                        </span>
                        {/* P */}
                        <span style={{width:24,textAlign:"center",fontSize:11.5,fontFamily:"var(--font-mono)",fontWeight:900,color: isQ?"#ea580c":"#374151",flexShrink:0}}>
                          {tData.pts}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Bracket Wrapper - premium dark header */}
            <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:14,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,0.04)"}} ref={bracketPanelRef}>
              {/* Stage labels bar */}
              <div style={{background:"#0a0f1e",padding:"10px 14px",display:"flex",justifyContent:"space-between",gap:"8px",alignItems:"center"}}>
                {[["SON 32","rgba(255,255,255,0.4)"],["SON 16","rgba(255,255,255,0.5)"],["ÇEYREK F.","rgba(255,255,255,0.65)"],["YARI F.","rgba(255,255,255,0.8)"],null,["YARI F.","rgba(255,255,255,0.8)"],["ÇEYREK F.","rgba(255,255,255,0.65)"],["SON 16","rgba(255,255,255,0.5)"],["SON 32","rgba(255,255,255,0.4)"]].map((item, i) => 
                  item === null ? (
                    <div key={i} style={{width:"230px",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      <span style={{fontSize:9.5,fontWeight:900,color:"#f59e0b",letterSpacing:"0.1em",textTransform:"uppercase"}}>FİNAL</span>
                    </div>
                  ) : (
                    <div key={i} style={{flex:"1 1 0%",maxWidth:"135px",fontSize:9,fontWeight:700,color:item[1],letterSpacing:"0.1em",textTransform:"uppercase",textAlign:"center"}}>
                      {item[0]}
                    </div>
                  )
                )}
              </div>
              <div className="bracket-scroll-wrapper" style={{padding:"14px",overflowX:"auto"}}>
                <div style={{minWidth:"1200px"}}>
                  <BracketView bracket={bracket} knockoutScores={knockoutScores} />
                </div>
              </div>
            </div>
          </div>
        )}


        {/* === GRUP ANALİZİ TAB === */}
        {activeTab==="groupstats" && simResults && liveTableData.groups && (() => {
          const groupKeys = Object.keys(GROUPS_CONFIG);
          const allGroupFixtures = generateAllFixtures();

          // Seçili grubun verileri
          const gName = activeGroupTab;
          const gTeams = GROUPS_CONFIG[gName] || [];
          const gFixtures = allGroupFixtures.filter(f => f.group === gName);
          const liveRows = (officialOnlyTableData.groups[gName]) || [];
          const qualThirdIds = new Set((officialOnlyTableData.thirds||[]).slice(0,8).map(t=>t.id));

          // Simüle puan durumu (officialScores > userScores > singleDisplayScores)
          const simPts={}, simGd={}, simGf={};
          gTeams.forEach(id=>{simPts[id]=0;simGd[id]=0;simGf[id]=0;});
          gFixtures.forEach(f=>{
            const oSc=officialScores[f.id], uSc=userScores[f.id], sSc=singleDisplayScores[f.id];
            let sc={};
            if(oSc && oSc.home !== "" && oSc.away !== "") { sc=oSc; }
            else if(uSc && uSc.home !== "" && uSc.away !== "") { sc=uSc; }
            else if(sSc) { sc=sSc; }
            const h=parseInt(sc.home)||0, a=parseInt(sc.away)||0;
            if(h>a){simPts[f.home]+=3;}else if(a>h){simPts[f.away]+=3;}else{simPts[f.home]+=1;simPts[f.away]+=1;}
            simGd[f.home]+=(h-a); simGd[f.away]+=(a-h);
            simGf[f.home]+=h; simGf[f.away]+=a;
          });
          const simSorted=[...gTeams].sort((a,b)=>simPts[b]-simPts[a]||simGd[b]-simGd[a]||simGf[b]-simGf[a]||activeTeams[b].elo-activeTeams[a].elo);

          const cardStyle = {background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,0.03)"};
          const sectionTitle = (label, color="#047857") => (
            <div style={{fontSize:11,fontWeight:900,color,letterSpacing:"0.07em",textTransform:"uppercase",borderBottom:"2px solid #f0fdf4",paddingBottom:6,marginBottom:10,display:"flex",alignItems:"center",gap:7}}>
              <span style={{width:3,height:16,background:color,borderRadius:2,display:"inline-block"}}></span>
              {label}
            </div>
          );

          const posColors = ["#059669","#0284c7","#f59e0b","#ef4444"];
          const posLabels = ["1.", "2.", "3.", "4."];

          return (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Grup seçim tab bar */}
              <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:5,display:"flex",gap:3,flexWrap:"wrap",boxShadow:"0 2px 6px rgba(0,0,0,0.03)"}}>
                {groupKeys.map(g=>(
                  <button key={g} onClick={()=>setActiveGroupTab(g)}
                    style={{
                      padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",border:"none",
                      background:activeGroupTab===g?"linear-gradient(135deg,#10b981,#059669)":"transparent",
                      color:activeGroupTab===g?"#fff":"#475569",
                      boxShadow:activeGroupTab===g?"0 2px 8px rgba(16,185,129,0.25)":"none",
                      transition:"all 0.15s", minWidth:36, letterSpacing:"0.04em",
                      fontFamily:"'JetBrains Mono',monospace"
                    }}>
                    {g}
                  </button>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:12}}>

                {/* 1. Anlık Resmi Puan Durumu */}
                <div style={cardStyle}>
                  {sectionTitle(`GRUP ${gName} — ANLK PUAN DURUMU`,"#047857")}
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr>
                        {["#","Takım","O","G","B","M","AG","AY","AV","P"].map(h=>(
                          <th key={h} style={{fontSize:9.5,fontWeight:800,color:"#94a3b8",textAlign:h==="Takım"?"left":"center",padding:"4px 5px",letterSpacing:"0.04em",fontFamily:"monospace",borderBottom:"2px solid #f1f5f9"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {liveRows.map((item,idx)=>{
                        const id=item.id;
                        const isTop2=idx<2, isQThird=idx===2&&qualThirdIds.has(id);
                        const bg=isTop2?"rgba(16,185,129,0.07)":isQThird?"rgba(249,115,22,0.07)":"transparent";
                        const accent=isTop2?"#10b981":isQThird?"#f97316":"transparent";
                        const nameClr=isTop2?"#065f46":isQThird?"#9a3412":"#374151";
                        // Hesapla: oynanan/galibiyet/beraberlik/mağlubiyet/atılan/yenilen
                        let p=0,w=0,d=0,l=0,gfv=0,gav=0;
                        gFixtures.forEach(f=>{
                          const sc=officialScores[f.id];
                          if(!sc||sc.home===""||sc.away==="")return;
                          const h=parseInt(sc.home),a=parseInt(sc.away);
                          if(f.home===id){p++;gfv+=h;gav+=a;if(h>a)w++;else if(h===a)d++;else l++;}
                          else if(f.away===id){p++;gfv+=a;gav+=h;if(a>h)w++;else if(h===a)d++;else l++;}
                        });
                        return (
                          <tr key={id} style={{borderBottom:"1px solid #f8fafc",background:bg,borderLeft:`3px solid ${accent}`}}>
                            <td style={{textAlign:"center",padding:"5px 4px",fontSize:10.5,fontFamily:"monospace",color:isTop2?"#059669":isQThird?"#ea580c":"#cbd5e1",fontWeight:700}}>{idx+1}</td>
                            <td style={{padding:"5px 6px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:5}}>
                                <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:16,height:11,borderRadius:2,objectFit:"cover"}} alt="" />
                                <span style={{fontSize:11.5,fontWeight:700,color:nameClr,whiteSpace:"nowrap"}}>{INITIAL_TEAMS[id]?.name}</span>
                              </div>
                            </td>
                            <td style={{textAlign:"center",fontSize:11,fontFamily:"monospace",color:"#374151",padding:"5px 4px"}}>{p}</td>
                            <td style={{textAlign:"center",fontSize:11,fontFamily:"monospace",color:"#059669",padding:"5px 4px",fontWeight:700}}>{w}</td>
                            <td style={{textAlign:"center",fontSize:11,fontFamily:"monospace",color:"#94a3b8",padding:"5px 4px"}}>{d}</td>
                            <td style={{textAlign:"center",fontSize:11,fontFamily:"monospace",color:"#dc2626",padding:"5px 4px"}}>{l}</td>
                            <td style={{textAlign:"center",fontSize:11,fontFamily:"monospace",color:"#374151",padding:"5px 4px"}}>{gfv}</td>
                            <td style={{textAlign:"center",fontSize:11,fontFamily:"monospace",color:"#374151",padding:"5px 4px"}}>{gav}</td>
                            <td style={{textAlign:"center",fontSize:11,fontFamily:"monospace",fontWeight:700,color:item.gd>0?"#1d4ed8":item.gd<0?"#dc2626":"#94a3b8",padding:"5px 4px"}}>{item.gd>0?`+${item.gd}`:item.gd}</td>
                            <td style={{textAlign:"center",padding:"5px 4px"}}>
                              <span style={{fontFamily:"monospace",fontWeight:900,fontSize:13,color:isTop2?"#047857":isQThird?"#ea580c":"#0f172a"}}>{item.pts}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{marginTop:8,display:"flex",gap:10,flexWrap:"wrap"}}>
                    {[["#10b981","Son 16'ya geçer (İlk 2)"],["#f97316","3.ler sırasına girer"]].map(([c,l])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:9.5,color:"#94a3b8"}}>
                        <span style={{width:8,height:8,borderRadius:2,background:c,opacity:0.7,display:"inline-block"}}></span>{l}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Fikstür */}
                <div style={cardStyle}>
                  {sectionTitle(`GRUP ${gName} — FİKSTÜR`,"#0284c7")}
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {gFixtures.map(f=>{
                      const off=officialScores[f.id], usr=userScores[f.id];
                      const hasOff=off&&off.home!==""&&off.away!=="";
                      const hasUsr=usr&&usr.home!==""&&usr.away!=="";
                      const simSc=singleDisplayScores[f.id];
                      const isSim=!hasOff&&!hasUsr&&simSc;
                      const hScore=hasOff?off.home:hasUsr?usr.home:simSc?.home??"–";
                      const aScore=hasOff?off.away:hasUsr?usr.away:simSc?.away??"–";
                      const hWin=hScore!==""&&aScore!==""&&parseInt(hScore)>parseInt(aScore);
                      const aWin=hScore!==""&&aScore!==""&&parseInt(aScore)>parseInt(hScore);
                      const borderClr=hasOff?"#10b981":hasUsr?"#f59e0b":isSim?"rgba(59,130,246,0.3)":"#e2e8f0";
                      const bgClr=hasOff?"rgba(16,185,129,0.05)":hasUsr?"rgba(245,158,11,0.04)":isSim?"rgba(59,130,246,0.02)":"#fafbfc";
                      return (
                        <div key={f.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:8,border:`1px solid ${borderClr}`,background:bgClr}}>
                          <div style={{flex:1,display:"flex",alignItems:"center",gap:5,justifyContent:"flex-end"}}>
                            <span style={{fontSize:11.5,fontWeight:hWin?700:500,color:hWin?"#047857":"#374151",textAlign:"right"}}>{INITIAL_TEAMS[f.home]?.name}</span>
                            <img src={getFlagUrl(INITIAL_TEAMS[f.home]?.iso)} style={{width:16,height:11,borderRadius:2,objectFit:"cover",flexShrink:0}} alt="" />
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:3,padding:"0 4px",flexShrink:0}}>
                            <span style={{fontFamily:"monospace",fontWeight:900,fontSize:13,color:hWin?"#047857":aWin?"#94a3b8":"#374151",minWidth:14,textAlign:"center"}}>{hScore}</span>
                            <span style={{color:"#94a3b8",fontWeight:700,fontSize:12}}>:</span>
                            <span style={{fontFamily:"monospace",fontWeight:900,fontSize:13,color:aWin?"#047857":hWin?"#94a3b8":"#374151",minWidth:14,textAlign:"center"}}>{aScore}</span>
                          </div>
                          <div style={{flex:1,display:"flex",alignItems:"center",gap:5}}>
                            <img src={getFlagUrl(INITIAL_TEAMS[f.away]?.iso)} style={{width:16,height:11,borderRadius:2,objectFit:"cover",flexShrink:0}} alt="" />
                            <span style={{fontSize:11.5,fontWeight:aWin?700:500,color:aWin?"#047857":"#374151"}}>{INITIAL_TEAMS[f.away]?.name}</span>
                          </div>
                          <span style={{fontSize:8,fontFamily:"monospace",fontWeight:800,color:hasOff?"#059669":hasUsr?"#d97706":isSim?"#3b82f6":"#cbd5e1",flexShrink:0,minWidth:28,textAlign:"right"}}>
                            {hasOff?"RESMİ":hasUsr?"TAH":isSim?"SIM":"—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Simüle Puan Durumu */}
                <div style={cardStyle}>
                  {sectionTitle(`GRUP ${gName} — SİMÜLE PUAN DURUMU`,"#7c3aed")}
                  <div style={{marginBottom:8,fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>Resmi + Tahmin + Monte Carlo simülasyon skorlarıyla oluşturulan beklenen tablo</div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {simSorted.map((id,idx)=>{
                      const isTop2=idx<2,isThird=idx===2;
                      const bg=isTop2?"rgba(16,185,129,0.07)":isThird?"rgba(249,115,22,0.07)":"transparent";
                      const accent=isTop2?"#10b981":isThird?"#f97316":"transparent";
                      const gdClr=simGd[id]>0?"#1d4ed8":simGd[id]<0?"#dc2626":"#94a3b8";
                      return (
                        <div key={id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px 5px 10px",borderRadius:8,background:bg,borderLeft:`3px solid ${accent}`}}>
                          <span style={{fontSize:10,fontFamily:"monospace",color:isTop2?"#059669":isThird?"#ea580c":"#cbd5e1",fontWeight:700,minWidth:14}}>{idx+1}</span>
                          <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:17,height:12,borderRadius:2,objectFit:"cover"}} alt="" />
                          <span style={{flex:1,fontSize:12,fontWeight:isTop2||isThird?700:500,color:isTop2?"#065f46":isThird?"#9a3412":"#374151"}}>{INITIAL_TEAMS[id]?.name}</span>
                          <span style={{fontSize:11,fontFamily:"monospace",fontWeight:700,color:gdClr,minWidth:32,textAlign:"center"}}>{simGd[id]>0?`+${simGd[id]}`:simGd[id]}</span>
                          <span style={{fontSize:13,fontFamily:"monospace",fontWeight:900,color:isTop2?"#047857":isThird?"#ea580c":"#0f172a",minWidth:24,textAlign:"center"}}>{simPts[id]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Bitiş Pozisyonu Olasılıkları */}
                <div style={cardStyle}>
                  {sectionTitle(`GRUP ${gName} — POZİSYON OLASILIKLARI`,"#b45309")}
                  <div style={{marginBottom:10,fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>10.000× Monte Carlo simülasyonuna göre her takımın grubu kaçıncı sırada bitirme ihtimali</div>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr>
                        <th style={{textAlign:"left",padding:"5px 8px",fontSize:10,fontWeight:800,color:"#94a3b8",letterSpacing:"0.04em",borderBottom:"2px solid #f1f5f9"}}>TAKIM</th>
                        {posLabels.map((l,i)=>(
                          <th key={l} style={{textAlign:"center",padding:"5px 8px",fontSize:10,fontWeight:800,color:posColors[i],letterSpacing:"0.04em",borderBottom:"2px solid #f1f5f9"}}>{l} SIRADA</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gTeams.map((id,ti)=>{
                        const t = simResults.teams[id]||{};
                        const vals=[t.g1??0,t.g2??0,t.g3??0,t.g4??0];
                        const maxVal=Math.max(...vals);
                        return (
                          <tr key={id} style={{borderBottom:"1px solid #f8fafc",background:ti%2===0?"#ffffff":"#fafbfc"}}>
                            <td style={{padding:"6px 8px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:5}}>
                                <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:16,height:11,borderRadius:2,objectFit:"cover"}} alt="" />
                                <span style={{fontSize:11.5,fontWeight:600,color:"#0f172a"}}>{INITIAL_TEAMS[id]?.name}</span>
                              </div>
                            </td>
                            {vals.map((v,vi)=>{
                              const isMax=v===maxVal&&v>0;
                              const barW=maxVal>0?Math.round((v/100)*52):0;
                              return (
                                <td key={vi} style={{textAlign:"center",padding:"6px 4px"}}>
                                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                    <div style={{width:52,height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden"}}>
                                      <div style={{width:`${v}%`,height:"100%",background:posColors[vi],borderRadius:3,opacity:isMax?1:0.55,transition:"width 0.3s"}}></div>
                                    </div>
                                    <span style={{fontFamily:"monospace",fontWeight:isMax?900:600,fontSize:11,color:isMax?posColors[vi]:"#64748b"}}>{v.toFixed(1)}%</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{marginTop:10,display:"flex",gap:10,flexWrap:"wrap"}}>
                    {posLabels.map((l,i)=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:9.5,color:"#94a3b8"}}>
                        <span style={{width:8,height:8,borderRadius:2,background:posColors[i],display:"inline-block"}}></span>{l} Sıra
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* === SKOR GİRİŞİ TAB === */}
        {activeTab==="groups" && simResults && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",gap:8,background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:5,alignSelf:"flex-start",width:"100%",maxWidth:320}}>
              {[["groups","⚽ Grup Maçları"],["knockout","🏆 Eleme Maçları"]].map(([s,label])=>(
                <button key={s} onClick={()=>setGroupsSection(s)}
                  style={{padding:"6px 18px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",
                    background:groupsSection===s?"linear-gradient(135deg,#10b981,#059669)":"transparent",
                    color:groupsSection===s?"#fff":"#475569",
                    boxShadow:groupsSection===s?"0 2px 8px rgba(16,185,129,0.2)":"none"
                  }}>{label}</button>
              ))}
            </div>

            {groupsSection==="groups" && (
              <div className="score-entry-grid">
                {Object.keys(GROUPS_CONFIG).map(gName=>(
                  <div key={gName} style={{background:"var(--bg-card)",border:"1px solid #e2e8f0",borderRadius:12,padding:14,boxShadow:"0 2px 4px rgba(0,0,0,0.02)"}}>
                    <div style={{fontSize:12,fontWeight:900,color:"#047857",borderBottom:"2px solid #e2e8f0",paddingBottom:6,marginBottom:10,letterSpacing:"0.05em"}}>
                      GRUP {gName}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {allFixtures.filter(f=>f.group===gName).map(f=>{
                        const userSc=userScores[f.id]; 
                        const officialSc=officialScores[f.id];
                        const hasOfficialScore=officialSc&&officialSc.home!==""&&officialSc.away!=="";
                        const hasUserScore=userSc&&userSc.home!==""&&userSc.away!=="";
                        const isPrediction=hasUserScore&&!hasOfficialScore;
                        
                        const activeHomeScore = hasOfficialScore ? officialSc.home : (hasUserScore ? userSc.home : (singleDisplayScores[f.id]?.home ?? ""));
                        const activeAwayScore = hasOfficialScore ? officialSc.away : (hasUserScore ? userSc.away : (singleDisplayScores[f.id]?.away ?? ""));
                        const isSimulated = !hasUserScore && !hasOfficialScore && activeHomeScore !== "";

                        const sw=activeHomeScore!==""&&activeAwayScore!=="" ? (parseInt(activeHomeScore)>parseInt(activeAwayScore)?"home":parseInt(activeAwayScore)>parseInt(activeHomeScore)?"away":"draw"):null;
                        
                        return (
                          <div key={f.id} className="fixture-row-container" 
                               style={{
                                 background: hasOfficialScore ? "rgba(16,185,129,0.06)" : (isPrediction ? "rgba(251,191,36,0.04)" : (isSimulated ? "rgba(59,130,246,0.02)" : "#f8fafc")), 
                                 border:`1px solid ${hasOfficialScore ? "#10b981" : (isPrediction ? "rgba(251,191,36,0.5)" : (isSimulated ? "rgba(59,130,246,0.25)" : "#cbd5e1"))}`
                               }}>
                            <div className="fixture-team-block home">
                              <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:sw==="home"||sw==="draw"?"#047857":"var(--text-primary)", fontWeight:sw==="home"||sw==="draw"?700:500}}>{INITIAL_TEAMS[f.home]?.name}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:3,padding:"0 4px",flexShrink:0,position:"relative"}}>
                              <input type="number" min="0" placeholder={isSimulated ? activeHomeScore : "-"} value={userScores[f.id]?.home??""} onChange={e=>handleScoreChange(f.id,"home",e.target.value)} style={{...inputStyle, placeholderColor: isSimulated ? "#3b82f6" : "#cbd5e1"}} />
                              <span style={{color: isSimulated ? "#3b82f6" : "#cbd5e1", fontWeight:700}}>:</span>
                              <input type="number" min="0" placeholder={isSimulated ? activeAwayScore : "-"} value={userScores[f.id]?.away??""} onChange={e=>handleScoreChange(f.id,"away",e.target.value)} style={{...inputStyle, placeholderColor: isSimulated ? "#3b82f6" : "#cbd5e1"}} />
                              {isSimulated && (
                                <span style={{position:"absolute", bottom:-11, left:"50%", transform:"translateX(-50%)", fontSize:"7.5px", color:"#3b82f6", fontWeight:800, fontFamily:"monospace", whiteSpace:"nowrap", letterSpacing:"0.02em"}}>SIM</span>
                              )}
                              {isPrediction && (
                                <span style={{position:"absolute", bottom:-11, left:"50%", transform:"translateX(-50%)", fontSize:"7.5px", color:"#d97706", fontWeight:800, fontFamily:"monospace", whiteSpace:"nowrap", letterSpacing:"0.02em"}}>TAH</span>
                              )}
                              {hasOfficialScore && (
                                <span style={{position:"absolute", bottom:-11, left:"50%", transform:"translateX(-50%)", fontSize:"7.5px", color:"#059669", fontWeight:800, fontFamily:"monospace", whiteSpace:"nowrap", letterSpacing:"0.02em"}}>RESMİ</span>
                              )}
                            </div>
                            <div className="fixture-team-block away">
                              <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:sw==="away"?"#047857":"var(--text-primary)", fontWeight:sw==="away"?700:500}}>{INITIAL_TEAMS[f.away]?.name}</span>
                            </div>
                            {/* R butonu: tahmin varsa resmi olarak onayla */}
                            {isPrediction && (
                              <button
                                title="Resmi sonuç olarak kaydet"
                                onClick={() => {
                                  setOfficialScores(prev => ({...prev, [f.id]: {home: userSc.home, away: userSc.away}}));
                                }}
                                style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"#fff",cursor:"pointer",fontSize:10,padding:"2px 6px",flexShrink:0,fontWeight:900,borderRadius:5,letterSpacing:"0.05em",boxShadow:"0 1px 4px rgba(16,185,129,0.3)"}}>R</button>
                            )}
                            {/* Resmi sonuç iptal butonu */}
                            {hasOfficialScore && (
                              <button onClick={() => {
                                  setOfficialScores(prev => {const n={...prev};delete n[f.id];return n;});
                                }}
                                style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:11,padding:"0 0 0 4px",flexShrink:0,fontWeight:700}}>✕</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groupsSection==="knockout" && bracket && (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{background:"rgba(16,185,129,0.05)",border:"1px solid #10b981",borderRadius:10,padding:"8px 14px",fontSize:11.5,color:"#047857",fontWeight:500}}>
                  💡 Eleme turları skorlarını kaydet — Turnuva ağacı canlı akışı ve kazanma olasılık matrisi anlık simüle edilir.
                </div>
                {[
                  { label:"SON 32 TURU", color:"#3b82f6", matches:[...bracket.left_r32,...bracket.right_r32] },
                  { label:"SON 16 TURU", color:"#8b5cf6", matches:[...bracket.left_r16,...bracket.right_r16] },
                  { label:"ÇEYREK FİNAL", color:"#ec4899", matches:[...bracket.left_qf,...bracket.right_qf] },
                  { label:"YARI FİNAL", color:"#f59e0b", matches:[bracket.left_sf, bracket.right_sf] },
                  { label:"BÜYÜK FİNAL", color:"#10b981", matches:[bracket.finalMatch] },
                  { label:"3.LÜK MAÇI", color:"#06b6d4", matches:[bracket.thirdPlaceMatch] },
                ].map(({label,color,matches})=>(
                  <div key={label} style={{background:"var(--bg-card)",border:"1px solid #e2e8f0",borderRadius:12,padding:14,boxShadow:"0 2px 6px rgba(0,0,0,0.02)"}}>
                    <div style={{fontSize:12,fontWeight:900,color,borderBottom:"2px solid #edf2f7",paddingBottom:7,marginBottom:10,letterSpacing:"0.06em",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:4,height:14,background:color,borderRadius:2,display:"inline-block"}}></span>
                      {label}
                      <span style={{fontSize:10.5,color:"#94a3b8",fontWeight:500,marginLeft:4}}>({matches.filter(m=>m?.idA&&m?.idB).length} aktif eşleşme)</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))",gap:8}}>
                      {matches.map((m,i)=>{
                        if(!m?.idA||!m?.idB) return <div key={i} style={{padding:"6px 10px",borderRadius:8,background:"#f8fafc",border:"1px dashed #cbd5e1",fontSize:11,color:"#94a3b8",textAlign:"center"}}>Önceki Tur Sonuçları Bekleniyor...</div>;
                        const key=`ko_${[m.idA,m.idB].sort().join("_")}`;
                        return (
                          <KOMatchRow key={`${m.idA}_${m.idB}_${i}`} m={m} score={knockoutScores[key]}
                            officialScore={officialKOScores[key]}
                            onChange={(k,side,val)=>setKnockoutScores(prev=>({...prev,[k]:{...prev[k],[side]:val}}))}
                            onConfirmOfficial={(k, sc) => {
                              setOfficialKOScores(prev=>({...prev,[k]:sc}));
                              setKnockoutScores(prev=>({...prev,[k]:sc}));
                            }}
                            onClearOfficial={(k) => setOfficialKOScores(prev=>{const n={...prev};delete n[k];return n;})}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === MATRIX TAB === */}
        {activeTab==="matrix" && simResults && (() => {
          const sortedIds = Object.keys(INITIAL_TEAMS).sort((a,b)=>(simResults.teams[b]?.champion??0)-(simResults.teams[a]?.champion??0));
          const half = Math.ceil(sortedIds.length / 2);
          const leftIds = sortedIds.slice(0, half);
          const rightIds = sortedIds.slice(half);
          const maxChamp = simResults.teams[sortedIds[0]]?.champion ?? 1;

          const thCls = (color) => ({padding:"7px 8px",textAlign:"center",fontWeight:800,fontSize:10,color,letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap",background:"#0a0f1e",borderBottom:"2px solid rgba(255,255,255,0.08)"});
          const tdCls = (color, bold) => ({padding:"6px 8px",textAlign:"center",fontFamily:"'JetBrains Mono',monospace",fontWeight:bold?700:600,color,fontSize:11.5,whiteSpace:"nowrap"});

          const MatrixTable = ({ids, offset}) => (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0,zIndex:20}}>
                <tr>
                  <th style={{...thCls("rgba(255,255,255,0.5)"),textAlign:"left",padding:"7px 10px",minWidth:130}}>Takım</th>
                  <th style={thCls("#10b981")}>S32</th>
                  <th style={thCls("rgba(255,255,255,0.6)")}>S16</th>
                  <th style={thCls("rgba(255,255,255,0.7)")}>ÇF</th>
                  <th style={thCls("#38bdf8")}>YF</th>
                  <th style={thCls("#a78bfa")}>F</th>
                  <th style={{...thCls("#f59e0b"),minWidth:80}}>
                    <svg style={{verticalAlign:"middle",marginRight:3}} width="9" height="9" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ŞAMPİYON
                  </th>
                </tr>
              </thead>
              <tbody>
                {ids.map((id, i) => {
                  const t = simResults.teams[id] || {};
                  const champPct = t.champion ?? 0;
                  const rowIdx = offset + i;
                  const isTop3 = rowIdx < 3;
                  return (
                    <tr key={id}
                      style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#ffffff":"#fafbfc",transition:"background 0.12s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(16,185,129,0.04)"}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#ffffff":"#fafbfc"}>
                      <td style={{padding:"6px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <span style={{fontSize:10,fontFamily:"monospace",color:"#94a3b8",fontWeight:700,minWidth:18,textAlign:"right"}}>{rowIdx+1}</span>
                          <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:18,height:13,borderRadius:2,objectFit:"cover",boxShadow:"0 1px 2px rgba(0,0,0,0.1)",flexShrink:0}} alt="" />
                          <span style={{fontWeight:700,color:"#0f172a",fontSize:12,whiteSpace:"nowrap"}}>{INITIAL_TEAMS[id]?.name}</span>
                        </div>
                      </td>
                      <td style={tdCls("#059669",true)}>{(t.r32??0).toFixed(1)}%</td>
                      <td style={tdCls("#374151",false)}>{(t.r16??0).toFixed(1)}%</td>
                      <td style={tdCls("#374151",false)}>{(t.qf??0).toFixed(1)}%</td>
                      <td style={tdCls("#0284c7",true)}>{(t.sf??0).toFixed(1)}%</td>
                      <td style={tdCls("#7c3aed",true)}>{(t.f??0).toFixed(1)}%</td>
                      <td style={{padding:"6px 8px",background:"rgba(217,119,6,0.02)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{width:36,height:4,background:"#f1f5f9",borderRadius:2,overflow:"hidden",flexShrink:0}}>
                            <div style={{width:`${Math.min(100,(champPct/maxChamp)*100)}%`,height:"100%",background:isTop3?"linear-gradient(90deg,#d97706,#f59e0b)":"linear-gradient(90deg,#94a3b8,#cbd5e1)",borderRadius:2}}></div>
                          </div>
                          <span style={{fontFamily:"monospace",fontWeight:900,color:isTop3?"#b45309":"#374151",fontSize:12,minWidth:38,textAlign:"right"}}>{champPct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );

          return (
            <div style={{display:"flex",flexDirection:"column",gap:0,borderRadius:16,overflow:"hidden",boxShadow:"0 6px 24px rgba(0,0,0,0.06)",border:"1px solid #e2e8f0"}}>
              {/* Header */}
              <div style={{background:"#0a0f1e",padding:"12px 18px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:3,height:24,background:"linear-gradient(180deg,#10b981,#059669)",borderRadius:2}}></div>
                <div>
                  <div style={{fontSize:12.5,fontWeight:900,color:"#ffffff",letterSpacing:"0.06em",fontFamily:"'Inter',system-ui"}}>OLASILIK MATRİSİ</div>
                  <div style={{fontSize:9,color:"#475569",fontFamily:"monospace",fontWeight:600,marginTop:1,letterSpacing:"0.08em"}}>10,000× MONTE CARLO SİMÜLASYONU</div>
                </div>
                <div style={{marginLeft:"auto",display:"flex",gap:16,alignItems:"center"}}>
                  {[["S32","Son 32"],["S16","Son 16"],["ÇF","Çeyrek"],["YF","Yarı F."],["F","Final"]].map(([k,v])=>(
                    <div key={k} style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>
                      <span style={{color:"rgba(255,255,255,0.7)",fontWeight:700}}>{k}</span> = {v}
                    </div>
                  ))}
                </div>
              </div>
              {/* Dual column tables */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1px 1fr",background:"#ffffff"}}>
                <div style={{overflowX:"auto"}}><MatrixTable ids={leftIds} offset={0} /></div>
                <div style={{background:"#e2e8f0"}}></div>
                <div style={{overflowX:"auto"}}><MatrixTable ids={rightIds} offset={half} /></div>
              </div>
            </div>
          );
        })()}

        {/* === ELO TAB === */}
        {activeTab==="elo" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,boxShadow:"0 2px 6px rgba(0,0,0,0.01)"}}>
              <div>
                <h2 style={{margin:0,fontSize:15,fontWeight:900,color:"#0f172a"}}>Güç Reytingleri (ELO) Güncellemesi</h2>
                <p style={{margin:"3px 0 0",fontSize:11.5,color:"#64748b"}}>Takımların ELO güç endekslerini değiştirerek simülasyon dengelerini değiştirebilirsin.</p>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <input type="text" placeholder="Takımlarda ara..." value={eloSearch} onChange={e=>setEloSearch(e.target.value)}
                  style={{padding:"6px 12px",borderRadius:8,border:"1px solid #cbd5e1",background:"#fff",color:"#0f172a",fontSize:12,outline:"none",width:180}} />
                <button onClick={()=>setCustomElo(Object.fromEntries(Object.entries(INITIAL_TEAMS).map(([k,v])=>[k,v.elo])))}
                  style={{padding:"6px 14px",borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#dc2626",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  ↺ Tümünü Sıfırla
                </button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",gap:12}}>
              {Object.entries(GROUPS_CONFIG).map(([gName,teamIds])=>(
                <div key={gName} style={{background:"var(--bg-card)",border:"1px solid #e2e8f0",borderRadius:12,padding:14,boxShadow:"0 2px 4px rgba(0,0,0,0.02)"}}>
                  <div style={{fontSize:11.5,fontWeight:900,color:"#047857",letterSpacing:"0.07em",textTransform:"uppercase",borderBottom:"2px solid #edf2f7",paddingBottom:7,marginBottom:10}}>GRUP {gName}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {teamIds.filter(id=>!eloSearch||INITIAL_TEAMS[id]?.name.toLowerCase().includes(eloSearch.toLowerCase())).map(id=>{
                      const current=customElo[id]??INITIAL_TEAMS[id].elo; const original=INITIAL_TEAMS[id].elo; const changed=current!==original;
                      return (
                        <div key={id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:8,background:changed?"rgba(16,185,129,0.04)":"#f8fafc",border:`1px solid ${changed?"#10b981":"#e2e8f0"}`}}>
                          <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:18,height:13,borderRadius:2,objectFit:"cover",flexShrink:0}} alt="" />
                          <span style={{flex:1,fontSize:12,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{INITIAL_TEAMS[id]?.name}</span>
                          <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                            <button onClick={()=>setCustomElo(prev=>({...prev,[id]:Math.max(1000,(prev[id]??original)-10)}))}
                              style={{width:22,height:22,borderRadius:5,background:"#fff",border:"1px solid #cbd5e1",color:"#dc2626",fontWeight:900,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                            <input type="number" value={current} onChange={e=>{const v=parseInt(e.target.value);if(!isNaN(v)&&v>=1000&&v<=2500)setCustomElo(prev=>({...prev,[id]:v}));}}
                              style={{width:55,height:24,borderRadius:6,border:`1px solid ${changed?"#10b981":"#cbd5e1"}`,background:"#fff",color:changed?"#047857":"#475569",fontFamily:"monospace",fontWeight:700,fontSize:12,textAlign:"center",outline:"none"}} />
                            <button onClick={()=>setCustomElo(prev=>({...prev,[id]:Math.min(2500,(prev[id]??original)+10)}))}
                              style={{width:22,height:22,borderRadius:5,background:"#fff",border:"1px solid #cbd5e1",color:"#047857",fontWeight:900,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                          </div>
                          {changed&&<span style={{fontSize:10,fontFamily:"monospace",color:current>original?"#047857":"#dc2626",flexShrink:0,fontWeight:700}}>{current>original?`+${current-original}`:current-original}</span>}
                          {changed&&<button onClick={()=>setCustomElo(prev=>{const n={...prev};n[id]=original;return n;})} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:11,padding:0,flexShrink:0,fontWeight:700}}>✕</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}