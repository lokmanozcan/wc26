import React, { useState, useEffect, useRef, useCallback } from "react";
import { getFifaTargetThird } from "./fifaMatrix";
import { usePersistentState } from "./usePersistentState";

// Yeni oluşturacağımız alt bileşenleri import ediyoruz
import Navigation from "./components/Navigation";
import GroupStage from "./components/GroupStage";
import KnockoutStage from "./components/KnockoutStage";
import StatsView from "./components/StatsView";
import EloSettings from "./components/EloSettings";

// --- SABİT TAKIM VERİLERİ (INITIAL_TEAMS) ---
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
  FRA: { name: "Fransa", iso: "fr", elo: 1974 },
  AUS: { name: "Avustralya", iso: "au", elo: 1711 },
  EGY: { name: "Mısır", iso: "eg", elo: 1642 },
  JAM: { name: "Jamaika", iso: "jm", elo: 1555 },
  ARG: { name: "Arjantin", iso: "ar", elo: 2012 },
  GHA: { name: "Gana", iso: "gh", elo: 1588 },
  IRQ: { name: "Irak", iso: "iq", elo: 1610 },
  ROU: { name: "Romanya", iso: "ro", elo: 1682 },
  ESP: { name: "İspanya", iso: "es", elo: 2022 },
  ALG: { name: "Cezayir", iso: "dz", elo: 1630 },
  UZB: { name: "Özbekistan", iso: "uz", elo: 1618 },
  NZL: { name: "Yeni Zelanda", iso: "nz", elo: 1512 },
  ENG: { name: "İngiltere", iso: "gb-eng", elo: 2008 },
  ECU: { name: "Ekvador", iso: "ec", elo: 1851 },
  TUN: { name: "Tunus", iso: "tn", elo: 1612 },
  GUA: { name: "Guatemala", iso: "gt", elo: 1464 },
  BEL: { name: "Belçika", iso: "be", elo: 1912 },
  PAR: { name: "Paraguay", iso: "py", elo: 1695 },
  OMA: { name: "Umman", iso: "om", elo: 1490 },
  HON: { name: "Honduras", iso: "hn", elo: 1502 },
  POR: { name: "Portekiz", iso: "pt", elo: 1988 },
  COL: { name: "Kolombiya", iso: "co", elo: 1927 },
  CMR: { name: "Kamerun", iso: "cm", elo: 1622 },
  FIN: { name: "Finlandiya", iso: "fi", elo: 1604 },
  ITA: { name: "İtalya", iso: "it", elo: 1935 },
  SEN: { name: "Senegal", iso: "sn", elo: 1735 },
  CRC: { name: "Kosta Rika", iso: "cr", elo: 1620 },
  MKD: { name: "Kuzey Makedonya", iso: "mk", elo: 1530 },
  GER: { name: "Almanya", iso: "de", elo: 1944 },
  URU: { name: "Uruguay", iso: "uy", elo: 1918 },
  NGA: { name: "Nijerya", iso: "ng", elo: 1650 },
  PAN: { name: "Panama", iso: "pa", elo: 1632 },
  NED: { name: "Hollanda", iso: "nl", elo: 1925 },
  UKR: { name: "Ukrayna", iso: "ua", elo: 1785 },
  MLI: { name: "Mali", iso: "ml", elo: 1608 },
  SLV: { name: "El Salvador", iso: "sv", elo: 1410 }
};

// --- GRUP TANIMLAMALARI ---
const GROUPS_CONFIG = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"],
  D: ["FRA", "AUS", "EGY", "JAM"],
  E: ["ARG", "GHA", "IRQ", "ROU"],
  F: ["ESP", "ALG", "UZB", "NZL"],
  G: ["ENG", "ECU", "TUN", "GUA"],
  H: ["BEL", "PAR", "OMA", "HON"],
  I: ["POR", "COL", "CMR", "FIN"],
  J: ["ITA", "SEN", "CRC", "MKD"],
  K: ["GER", "URU", "NGA", "PAN"],
  L: ["NED", "UKR", "MLI", "SLV"]
};

// --- FİKSTÜR OLUŞTURMA MANTIĞI ---
const generateInitialMatches = () => {
  const m = [];
  let id = 1;
  Object.entries(GROUPS_CONFIG).forEach(([gName, gTeams]) => {
    const pairs = [
      [gTeams[0], gTeams[1]], [gTeams[2], gTeams[3]],
      [gTeams[0], gTeams[2]], [gTeams[1], gTeams[3]],
      [gTeams[0], gTeams[3]], [gTeams[1], gTeams[2]]
    ];
    pairs.forEach(([tA, tB], index) => {
      m.push({
        id,
        group: gName,
        round: Math.floor(index / 2) + 1,
        teamA: tA,
        teamB: tB,
        scoreA: "",
        scoreB: "",
        played: false
      });
      id++;
    });
  });
  return m;
};

const INITIAL_MATCHES = generateInitialMatches();

export default function App() {
  const [activeTab, setActiveTab] = useState("groups");
  
  // Kalıcı durumlar (Persistent State)
  const [teams, setTeams] = usePersistentState("wc2026_teams_state", INITIAL_TEAMS);
  const [matches, setMatches] = usePersistentState("wc2026_matches_state", INITIAL_MATCHES);
  const [knockoutMatches, setKnockoutMatches] = usePersistentState("wc2026_knockout_state", null);
  const [customElo, setCustomElo] = usePersistentState("wc2026_custom_elo", {});

  // ELO Değişimlerini ana takım verisine yansıtma dinleyicisi
  useEffect(() => {
    setTeams(prev => {
      const updated = { ...prev };
      let hasChange = false;
      Object.keys(updated).forEach(id => {
        const targetElo = customElo[id] !== undefined ? customElo[id] : INITIAL_TEAMS[id].elo;
        if (updated[id].elo !== targetElo) {
          updated[id] = { ...updated[id], elo: targetElo };
          hasChange = true;
        }
      });
      return hasChange ? updated : prev;
    });
  }, [customElo, setTeams]);

  // Tüm turnuvayı sıfırlama fonksiyonu
  const handleResetAll = () => {
    if (window.confirm("Tüm turnuva verilerini sıfırlamak istediğinize emin misiniz?")) {
      setMatches(INITIAL_MATCHES);
      setKnockoutMatches(null);
      localStorage.removeItem("wc2026_matches_state");
      localStorage.removeItem("wc2026_knockout_state");
    }
  };

  // Menüden seçilen sayfayı ekrana basan yönlendirici router mantığı
  const renderPage = () => {
    switch (activeTab) {
      case "groups":
        return (
          <GroupStage
            teams={teams}
            matches={matches}
            setMatches={setMatches}
            groupsConfig={GROUPS_CONFIG}
            knockoutMatches={knockoutMatches}
            setKnockoutMatches={setKnockoutMatches}
          />
        );
      case "knockout":
        return (
          <KnockoutStage
            teams={teams}
            matches={matches}
            knockoutMatches={knockoutMatches}
            setKnockoutMatches={setKnockoutMatches}
          />
        );
      case "stats":
        return (
          <StatsView
            teams={teams}
            matches={matches}
            knockoutMatches={knockoutMatches}
            groupsConfig={GROUPS_CONFIG}
          />
        );
      case "elo":
        return (
          <EloSettings
            initialTeams={INITIAL_TEAMS}
            customElo={customElo}
            setCustomElo={setCustomElo}
          />
        );
      default:
        return (
          <GroupStage
            teams={teams}
            matches={matches}
            setMatches={setMatches}
            groupsConfig={GROUPS_CONFIG}
            knockoutMatches={knockoutMatches}
            setKnockoutMatches={setKnockoutMatches}
          />
        );
    }
  };

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#f8fafc", fontFamily: "system-ui, sans-serif", paddingBottom: 60 }}>
      {/* Üst Header ve Navigasyon Menüsü */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} onResetAll={handleResetAll} />

      {/* Dinamik Sayfa Alanı */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 20px" }}>
        {renderPage()}
      </div>
    </div>
  );
}