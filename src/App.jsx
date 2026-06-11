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
  SCO: { name: "İskoçya", iso: "gb", elo: 1782 },

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

  ENG: { name: "İngiltere", iso: "gb", elo: 2024 },
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

  return (
    <div className="match-card" style={{ position:"relative" }}>
      <div className={`match-row ${isWinnerA ? "winner" : "loser"}`}>
        <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
          <img src={getFlagUrl(flagA)} style={{ width:14, height:10, borderRadius:2, objectFit:"cover", flexShrink:0 }} alt="" />
          <span className="team-name">{nameA}</span>
        </div>
        {hasScore ? (
          <span style={{ fontFamily:"monospace", fontWeight:900, fontSize:11, color: isWinnerA ? "#047857" : "#94a3b8", minWidth:14, textAlign:"center" }}>
            {score.home}
          </span>
        ) : (
          <span className="pct-badge" style={{ color: isWinnerA ? "#047857" : "#64748b" }}>{m?.pA ?? 50}%</span>
        )}
      </div>
      <div className={`match-row ${isWinnerB ? "winner" : "loser"}`}>
        <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
          <img src={getFlagUrl(flagB)} style={{ width:14, height:10, borderRadius:2, objectFit:"cover", flexShrink:0 }} alt="" />
          <span className="team-name">{nameB}</span>
        </div>
        {hasScore ? (
          <span style={{ fontFamily:"monospace", fontWeight:900, fontSize:11, color: isWinnerB ? "#047857" : "#94a3b8", minWidth:14, textAlign:"center" }}>
            {score.away}
          </span>
        ) : (
          <span className="pct-badge" style={{ color: isWinnerB ? "#047857" : "#64748b" }}>{m?.pB ?? 50}%</span>
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
          {svgPaths.map((d,i) => <path key={i} d={d} fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />)}
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

        {/* CENTER PODIUM */}
        <div className="podium-center" style={{ alignSelf:"center", width: "230px", flexShrink: 0 }}>
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:900, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"monospace", marginBottom:4 }}>FİNALİST A</div>
            <div className="finalist-box">
              <img src={getFlagUrl(INITIAL_TEAMS[bracket.finalMatch.idA]?.iso)} style={{ width:16,height:11,borderRadius:2,objectFit:"cover" }} alt="" />
              <span style={{ fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{INITIAL_TEAMS[bracket.finalMatch.idA]?.name||"---"}</span>
            </div>
          </div>
          <div className="champion-box" style={{ margin:"8px 0" }}>
            <img src={LOGO_URL} style={{ width: 44, height: 44, margin: "0 auto 6px", objectFit: "contain" }} alt="Kupa" />
            <div style={{ fontSize:9, fontWeight:900, color:"#b45309", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"monospace" }}>WORLD CHAMPION</div>
            <div style={{ marginTop:6, background:"#ffffff", borderRadius:8, padding:"6px 10px", display:"flex", alignItems:"center", justifyContent:"center", gap:6, border:"1px solid #d97706", boxShadow:"0 2px 4px rgba(0,0,0,0.05)" }}>
              <img src={getFlagUrl(INITIAL_TEAMS[bracket.finalMatch.winner]?.iso)} style={{ width:18,height:12,borderRadius:2,objectFit:"cover" }} alt="" />
              <span style={{ fontSize:12.5,fontWeight:900,color:"#b45309" }}>{INITIAL_TEAMS[bracket.finalMatch.winner]?.name||"---"}</span>
            </div>

            <div style={{ marginTop:12, borderTop:"1px solid #e2e8f0", paddingTop:8 }}>
              <div style={{ fontSize:9, fontWeight:900, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4, fontFamily:"monospace" }}>KAZANMA OLASILIKLARI</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:10.5, fontFamily:"monospace", fontWeight:700, marginBottom:3 }}>
                <span style={{ color:"#047857" }}>{bracket.finalMatch.pA}%</span>
                <span style={{ color:"#1d4ed8" }}>{bracket.finalMatch.pB}%</span>
              </div>
              <div style={{ width:"100%", height:7, background:"#e2e8f0", borderRadius:4, overflow:"hidden", display:"flex" }}>
                <div style={{ width: `${bracket.finalMatch.pA}%`, height:"100%", background:"#10b981" }}></div>
                <div style={{ width: `${bracket.finalMatch.pB}%`, height:"100%", background:"#3b82f6" }}></div>
              </div>
            </div>
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:900, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"monospace", marginBottom:4 }}>FİNALİST B</div>
            <div className="finalist-box">
              <img src={getFlagUrl(INITIAL_TEAMS[bracket.finalMatch.idB]?.iso)} style={{ width:16,height:11,borderRadius:2,objectFit:"cover" }} alt="" />
              <span style={{ fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{INITIAL_TEAMS[bracket.finalMatch.idB]?.name||"---"}</span>
            </div>
          </div>
          <div style={{ borderTop:"1px solid #e2e8f0", paddingTop:8 }}>
            <div style={{ fontSize:9, fontWeight:900, color:"#0891b2", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"monospace", textAlign:"center", marginBottom:5 }}>🥉 ÜÇÜNCÜLÜK MAÇI</div>
            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 8px" }}>
              {[{id:bracket.thirdPlaceMatch.idA, p:bracket.thirdPlaceMatch.pA},{id:bracket.thirdPlaceMatch.idB, p:bracket.thirdPlaceMatch.pB}].map((t,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, color:"var(--text-primary)", ...(i>0?{borderTop:"1px solid #edf2f7",paddingTop:4,marginTop:4}:{}) }}>
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <img src={getFlagUrl(INITIAL_TEAMS[t.id]?.iso)} style={{ width:13,height:9,borderRadius:2 }} alt="" />
                    {INITIAL_TEAMS[t.id]?.name}
                  </span>
                  <span style={{ color:"#0891b2", fontWeight:700, fontFamily:"monospace" }}>{t.p}%</span>
                </div>
              ))}
              <div style={{ marginTop:6, background:"rgba(6,182,212,0.08)", border:"1px solid rgba(6,182,212,0.2)", borderRadius:6, padding:"4px 6px", textAlign:"center", fontSize:11, fontWeight:800, color:"#0891b2" }}>
                🥉 {INITIAL_TEAMS[bracket.thirdPlaceMatch.winner]?.name}
              </div>
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
      stats[id] = { id, r32:0,r16:0,qf:0,sf:0,f:0,champion:0,thirdPlaceChamp:0 };
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
    return Object.keys(GROUPS_CONFIG).map(gName => {
      const sorted = liveTableData.groups[gName] || [];
      return (
        <div key={gName} className="group-card">
          <div className="group-header">
            <span>GRUP {gName}</span>
            <span style={{fontSize:9,color:"#64748b",fontFamily:"monospace"}}>AV / P</span>
          </div>
          <div>
            {sorted.map((item, index) => {
              const id = item.id;
              return (
                <div key={id} className="group-team-row">
                  <span className="rank">{index + 1}</span>
                  <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:15,height:10,borderRadius:2,objectFit:"cover",flexShrink:0,margin:"0 4px"}} alt="" />
                  <span className="team-name" style={{fontSize:11.5, color:"var(--text-primary)"}}>{INITIAL_TEAMS[id]?.name}</span>
                  <span style={{fontFamily:"monospace",fontWeight:700,fontSize:10.5,color:"#475569",flexShrink:0}}>
                    {item.gd >= 0 ? `+${item.gd}` : item.gd} | {item.pts}
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
      <header style={{height:58,background:"#ffffff",borderBottom:"1px solid #e2e8f0",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <img src={LOGO_URL} style={{ width: 34, height: 34, objectFit: "contain" }} alt="Logo" />
          <div>
            <h1 style={{margin:0,fontSize:14,fontWeight:900,letterSpacing:"0.05em",textTransform:"uppercase",color:"#0f172a"}}>WORLDCUP'26 ANALYTICA</h1>
            <p style={{margin:0,fontSize:9,color:"#059669",fontFamily:"monospace",fontWeight:700,letterSpacing:"0.15em"}}>10,000× MONTE CARLO LIVE PROJECTION</p>
          </div>
        </div>
        <nav style={{display:"flex",background:"#f1f5f9",padding:4,borderRadius:10,border:"1px solid #e2e8f0",gap:2}}>
          {[["bracket","Turnuva Ağacı"],["groups","Skor Girişi"],["matrix","Olasılık Matrisi"],["elo","ELO Güncelle"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} className={`nav-btn ${activeTab===tab?"active":"inactive"}`}>{label}</button>
          ))}
        </nav>
      </header>

      <main style={{flex:1,padding:"16px 20px",maxWidth:"100%",width:"100%"}}>

        {/* === BRACKET TAB === */}
        {activeTab==="bracket" && bracket && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* 6x2 Kusursuz Grid Alanı */}
            <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:14,padding:"12px 14px",boxShadow:"0 2px 8px rgba(0,0,0,0.02)"}}>
              <div className="groups-panel-grid">{renderGroups()}</div>
            </div>
            {/* Thirds */}
            <div style={{background:"#ffffff",border:"1px dashed #10b981",borderRadius:12,padding:"10px 14px"}}>
              <div style={{fontSize:11,fontWeight:900,color:"#047857",marginBottom:8,display:"flex",alignItems:"center",gap:6,fontFamily:"monospace",letterSpacing:"0.05em"}}>
                <span>⏳</span> EN İYİ 3.LER ANLIK DURUM
              </div>
              <div className="thirds-grid">
                {bracket.sortedThirds.map((id, index) => {
                  const isQ = bracket.qualifiedThirds.includes(id);
                  const gLetter = Object.keys(GROUPS_CONFIG).find(g => GROUPS_CONFIG[g].includes(id));
                  const tData = liveTableData.thirds.find(x => x.id === id) || { pts: 0, gd: 0 };
                  return (
                    <div key={id} className={`third-chip ${isQ ? "qualified" : "eliminated"}`}>
                      <span style={{fontSize:9,fontWeight:700,color:isQ?"#047857":"#94a3b8",fontFamily:"monospace",flexShrink:0,width:12}}>{index+1}.</span>
                      <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:14,height:10,borderRadius:2,objectFit:"cover",flexShrink:0}} alt="" />
                      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11}}>
                        {INITIAL_TEAMS[id]?.name}<span style={{fontSize:9,color:"#64748b",marginLeft:2}}>{gLetter ? `(${gLetter})` : ""}</span>
                      </span>
                      <span style={{fontSize:10,fontWeight:700,color:isQ?"#047857":"#94a3b8",fontFamily:"monospace",flexShrink:0}}>{tData.pts}P</span>
                      <span style={{fontSize:10,fontWeight:600,color:tData.gd>=0?"#2563eb":"#dc2626",fontFamily:"monospace",flexShrink:0}}>
                        {tData.gd >= 0 ? `+${tData.gd}` : tData.gd}AV
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Bracket Wrapper */}
            <div style={{background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:14,padding:"14px",boxShadow:"0 4px 12px rgba(0,0,0,0.03)",overflowX:"auto"}}>
              <div style={{display:"flex", justifyContent:"space-between", gap:"8px", textAlign:"center", fontSize:10, fontWeight:900, color:"#64748b", letterSpacing:"0.08em", borderBottom:"1px solid #e2e8f0", paddingBottom:8, marginBottom:12, width:"100%"}}>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>SON 32</div>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>SON 16</div>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>ÇEYREK F.</div>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>YARI F.</div>
                <div style={{width:"230px", color:"#b45309", flexShrink:0}}>PODYUM MERKEZİ</div>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>YARI F.</div>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>ÇEYREK F.</div>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>SON 16</div>
                <div style={{flex:"1 1 0%", maxWidth:"135px"}}>SON 32</div>
              </div>
              <div style={{width:"100%"}}>
                <BracketView bracket={bracket} knockoutScores={knockoutScores} />
              </div>
            </div>
          </div>
        )}

        {/* === SKOR GİRİŞİ TAB === */}
        {activeTab==="groups" && simResults && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",gap:8,background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12,padding:5,alignSelf:"flex-start"}}>
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
              // YENİ: Her satırda tam 4 grup olacak şekilde optimize edilen grid yapısı
              <div style={{display:"grid",gridTemplateColumns:"repeat(4, minmax(0, 1fr))",gap:14}}>
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
        {activeTab==="matrix" && simResults && (
          <div style={{background:"var(--bg-card)",border:"1px solid #e2e8f0",borderRadius:14,overflow:"hidden",boxShadow:"0 4px 12px rgba(0,0,0,0.03)"}}>
            <div style={{overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                <thead style={{position:"sticky",top:0,background:"#f8fafc",zIndex:20}}>
                  <tr style={{borderBottom:"2px solid #e2e8f0",color:"#475569"}}>
                    <th style={{padding:"11px 14px",textAlign:"left",fontWeight:800}}>Ülke / Takım</th>
                    <th style={{padding:"11px 14px",textAlign:"center",color:"#047857",fontWeight:800}}>Son 32</th>
                    <th style={{padding:"11px 14px",textAlign:"center",fontWeight:800}}>Son 16</th>
                    <th style={{padding:"11px 14px",textAlign:"center",fontWeight:800}}>Çeyrek Final</th>
                    <th style={{padding:"11px 14px",textAlign:"center",color:"#0891b2",fontWeight:800}}>Yarı Final</th>
                    <th style={{padding:"11px 14px",textAlign:"center",color:"#09748e",fontWeight:800}}>Bronz</th>
                    <th style={{padding:"11px 14px",textAlign:"center",color:"#4f46e5",fontWeight:800}}>Final</th>
                    <th style={{padding:"11px 14px",textAlign:"center",color:"#b45309",fontWeight:800}}>Şampiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(INITIAL_TEAMS).sort((a,b)=>(simResults.teams[b]?.champion??0)-(simResults.teams[a]?.champion??0)).map(id=>{
                    const t=simResults.teams[id]||{};
                    return (
                      <tr key={id} style={{borderBottom:"1px solid #edf2f7"}}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(16,185,129,0.02)"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{padding:"9px 14px",display:"flex",alignItems:"center",gap:8}}>
                          <img src={getFlagUrl(INITIAL_TEAMS[id]?.iso)} style={{width:16,height:11,borderRadius:2,objectFit:"cover"}} alt="" />
                          <span style={{fontWeight:600,color:"#0f172a"}}>{INITIAL_TEAMS[id]?.name}</span>
                        </td>
                        <td style={{padding:"9px 14px",textAlign:"center",fontFamily:"monospace",fontWeight:700,color:"#047857"}}>{(t.r32??0).toFixed(1)}%</td>
                        <td style={{padding:"9px 14px",textAlign:"center",fontFamily:"monospace",color:"#334155",fontWeight:600}}>{(t.r16??0).toFixed(1)}%</td>
                        <td style={{padding:"9px 14px",textAlign:"center",fontFamily:"monospace",color:"#334155",fontWeight:600}}>{(t.qf??0).toFixed(1)}%</td>
                        <td style={{padding:"9px 14px",textAlign:"center",fontFamily:"monospace",color:"#0891b2",fontWeight:600}}>{(t.sf??0).toFixed(1)}%</td>
                        <td style={{padding:"9px 14px",textAlign:"center",fontFamily:"monospace",color:"#09748e",fontWeight:600}}>{(t.thirdPlaceChamp??0).toFixed(1)}%</td>
                        <td style={{padding:"9px 14px",textAlign:"center",fontFamily:"monospace",color:"#4f46e5",fontWeight:700}}>{(t.f??0).toFixed(1)}%</td>
                        <td style={{padding:"9px 14px",textAlign:"center",fontFamily:"monospace",fontWeight:900,color:"#b45309",background:"rgba(217,119,6,0.02)"}}>{(t.champion??0).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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