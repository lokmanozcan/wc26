// FIFA 2026 grup aşaması sıralama kuralları:
// ADIM 1 — Eşit puandaki takımlar arası mini-lig: H2H puan → H2H averaj → H2H atılan gol
//         (hâlâ eşitse yalnızca bu takımlar arasında Adım 1 tekrarlanır)
// ADIM 2 — Genel averaj → Genel atılan gol → ELO (FIFA sıralaması yerine)
// En iyi 3.ler için yalnızca genel kriterler (H2H yok).

function emptyStats() {
  return { pts: 0, gd: 0, gf: 0, ga: 0, played: 0 };
}

function getFixtureGoals(fixture, scoresByFixtureId) {
  const sc = scoresByFixtureId[fixture.id];
  if (!sc || sc.home === "" || sc.away === "" || sc.home === undefined || sc.away === undefined) return null;
  const hG = parseInt(sc.home, 10);
  const aG = parseInt(sc.away, 10);
  if (Number.isNaN(hG) || Number.isNaN(aG)) return null;
  return { hG, aG };
}

function accumulateStats(stats, gf, ga) {
  stats.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
  stats.gf += gf;
  stats.ga += ga;
  stats.gd += gf - ga;
  stats.played += 1;
}

export function computeGroupStats(teamIds, fixtures, scoresByFixtureId, restrictToIds = null) {
  const stats = Object.fromEntries(teamIds.map((id) => [id, emptyStats()]));
  fixtures.forEach((f) => {
    if (!teamIds.includes(f.home) || !teamIds.includes(f.away)) return;
    if (restrictToIds && (!restrictToIds.includes(f.home) || !restrictToIds.includes(f.away))) return;
    const g = getFixtureGoals(f, scoresByFixtureId);
    if (!g) return;
    accumulateStats(stats[f.home], g.hG, g.aG);
    accumulateStats(stats[f.away], g.aG, g.hG);
  });
  return stats;
}

export function getElo(eloMap, id) {
  const e = eloMap[id];
  return (typeof e === "object" ? e?.elo : e) ?? 0;
}

function compareMiniStats(mA, mB) {
  return mB.pts - mA.pts || mB.gd - mA.gd || mB.gf - mA.gf;
}

function isMiniTied(a, b, miniStats) {
  return compareMiniStats(miniStats[a], miniStats[b]) === 0;
}

function compareOverallStats(oA, oB) {
  return oB.gd - oA.gd || oB.gf - oA.gf;
}

function compareOverallWithElo(a, b, overallStats, eloMap) {
  let c = compareOverallStats(overallStats[a], overallStats[b]);
  if (c !== 0) return c;
  c = getElo(eloMap, b) - getElo(eloMap, a);
  if (c !== 0) return c;
  return a.localeCompare(b);
}

/** Adım 2: mini-lig eşitliği çözülemediyse genel averaj + ELO */
function rankByOverallSubset(subset, overallStats, eloMap) {
  if (subset.length <= 1) return [...subset];

  const sorted = [...subset].sort((a, b) => compareOverallWithElo(a, b, overallStats, eloMap));
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length &&
      compareOverallStats(overallStats[sorted[i]], overallStats[sorted[j]]) === 0 &&
      getElo(eloMap, sorted[i]) === getElo(eloMap, sorted[j])
    ) {
      j++;
    }
    const group = sorted.slice(i, j);
    result.push(...group.sort((a, b) => a.localeCompare(b)));
    i = j;
  }
  return result;
}

/**
 * Eşit puandaki takım kümesini sırala.
 * Önce yalnızca ikili/üçlü/dörtlü averaj; çözülmezse genel averaj.
 */
function rankFifaSubset(subset, teamIds, fixtures, scoresByFixtureId, overallStats, eloMap) {
  if (subset.length <= 1) return [...subset];

  const miniStats = computeGroupStats(teamIds, fixtures, scoresByFixtureId, subset);
  const sorted = [...subset].sort((a, b) => {
    const c = compareMiniStats(miniStats[a], miniStats[b]);
    return c !== 0 ? c : a.localeCompare(b);
  });

  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && isMiniTied(sorted[i], sorted[j], miniStats)) {
      j++;
    }
    const tiedGroup = sorted.slice(i, j);

    if (tiedGroup.length === 1) {
      result.push(tiedGroup[0]);
    } else if (tiedGroup.length === subset.length) {
      // Tüm eşit puanlı takımlar mini-ligde hâlâ berabere → Adım 2
      result.push(...rankByOverallSubset(tiedGroup, overallStats, eloMap));
    } else {
      // Alt küme hâlâ mini-ligde eşit → Adım 1'i yalnızca bu takımlar için tekrarla
      result.push(
        ...rankFifaSubset(tiedGroup, teamIds, fixtures, scoresByFixtureId, overallStats, eloMap)
      );
    }
    i = j;
  }
  return result;
}

/** Grup içi FIFA sıralaması — oynanan maç sayısı dahil */
export function rankGroupByFifaRules(teamIds, fixtures, scoresByFixtureId, eloMap) {
  const overallStats = computeGroupStats(teamIds, fixtures, scoresByFixtureId);
  const byPts = {};
  teamIds.forEach((id) => {
    const p = overallStats[id].pts;
    if (!byPts[p]) byPts[p] = [];
    byPts[p].push(id);
  });

  const order = [];
  Object.keys(byPts)
    .map(Number)
    .sort((a, b) => b - a)
    .forEach((pts) => {
      order.push(...rankFifaSubset(byPts[pts], teamIds, fixtures, scoresByFixtureId, overallStats, eloMap));
    });

  return order.map((id) => ({ id, ...overallStats[id] }));
}

/**
 * Grup içi bitiş pozisyonu olasılıkları (%).
 * Kalan maç senaryolarında FIFA Adım 1 + Adım 2 sıralaması uygulanır.
 */
export function computeGroupPositionProbabilities(gTeams, gFixtures, scoresByFixtureId, eloMap) {
  const scenarios = enumerateGroupScoreScenarios(gFixtures, scoresByFixtureId);
  const counts = Object.fromEntries(
    gTeams.map((id) => [id, { 1: 0, 2: 0, 3: 0, 4: 0 }])
  );

  scenarios.forEach((scenario) => {
    rankGroupByFifaRules(gTeams, gFixtures, scenario, eloMap).forEach((row, idx) => {
      const pos = idx + 1;
      if (counts[row.id] && counts[row.id][pos] !== undefined) {
        counts[row.id][pos]++;
      }
    });
  });

  const total = scenarios.length || 1;
  const probs = {};
  gTeams.forEach((id) => {
    probs[id] = {
      g1: (counts[id][1] / total) * 100,
      g2: (counts[id][2] / total) * 100,
      g3: (counts[id][3] / total) * 100,
      g4: (counts[id][4] / total) * 100,
    };
  });
  return probs;
}

/** En iyi 3.ler — genel puan / averaj / gol (gruplar arası H2H yok) */
export function compareBestThirdPlace(a, b, eloMap) {
  return (
    b.pts - a.pts ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    getElo(eloMap, b.id) - getElo(eloMap, a.id)
  );
}

export function buildScoresMap(fixtures, resolveScore) {
  const map = {};
  fixtures.forEach((f) => {
    const sc = resolveScore(f);
    if (sc && sc.home !== "" && sc.away !== "" && sc.home !== undefined && sc.away !== undefined) {
      map[f.id] = sc;
    }
  });
  return map;
}

export function isGroupComplete(gFixtures, scoresByFixtureId) {
  return gFixtures.length > 0 && gFixtures.every((f) => getFixtureGoals(f, scoresByFixtureId) !== null);
}

export function areAllGroupsComplete(fixtures, scoresByFixtureId) {
  const groupNames = [...new Set(fixtures.map((f) => f.group))];
  return groupNames.every((g) =>
    isGroupComplete(fixtures.filter((f) => f.group === g), scoresByFixtureId)
  );
}

const WDL_OUTCOMES = [[1, 0], [1, 1], [0, 1]];

export function enumerateGroupScoreScenarios(gFixtures, scoresByFixtureId) {
  const remaining = gFixtures.filter((f) => !getFixtureGoals(f, scoresByFixtureId));
  if (remaining.length === 0) return [scoresByFixtureId];

  const results = [];
  const go = (i, ext) => {
    if (i >= remaining.length) {
      results.push({ ...scoresByFixtureId, ...ext });
      return;
    }
    const f = remaining[i];
    WDL_OUTCOMES.forEach(([h, a]) => {
      go(i + 1, { ...ext, [f.id]: { home: String(h), away: String(a) } });
    });
  };
  go(0, {});
  return results;
}

/** Hangi takımlar 1. veya 2. sırayı matematiksel olarak garantiledi */
export function analyzeGroupClinch(gTeams, gFixtures, scoresByFixtureId, eloMap) {
  const scenarios = enumerateGroupScoreScenarios(gFixtures, scoresByFixtureId);
  const rankSets = Object.fromEntries(gTeams.map((id) => [id, new Set()]));

  scenarios.forEach((scenario) => {
    rankGroupByFifaRules(gTeams, gFixtures, scenario, eloMap).forEach((row, idx) => {
      rankSets[row.id].add(idx + 1);
    });
  });

  const clinchedFirst = new Set();
  const clinchedSecond = new Set();
  gTeams.forEach((id) => {
    const ranks = rankSets[id];
    if (ranks.size === 1 && ranks.has(1)) clinchedFirst.add(id);
    if (ranks.size === 1 && ranks.has(2)) clinchedSecond.add(id);
  });

  return { clinchedFirst, clinchedSecond };
}

export function makeBracketSlot(teamId, label) {
  return { id: teamId || null, label: teamId ? null : label };
}

export function resolveGroupPositionSlot(gName, position, rankedRows, groupComplete, clinch) {
  const row = rankedRows[position - 1];
  if (groupComplete && row) return makeBracketSlot(row.id, null);
  if (position === 1 && row && clinch.clinchedFirst.has(row.id)) return makeBracketSlot(row.id, null);
  if (position === 2 && row && clinch.clinchedSecond.has(row.id)) return makeBracketSlot(row.id, null);
  return makeBracketSlot(null, `${position}${gName}`);
}
