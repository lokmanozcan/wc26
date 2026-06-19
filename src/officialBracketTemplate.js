import { getFifaTargetThird } from "./fifaMatrix";
import {
  analyzeGroupClinch,
  areAllGroupsComplete,
  compareBestThirdPlace,
  isGroupComplete,
  rankGroupByFifaRules,
  resolveGroupPositionSlot,
  makeBracketSlot,
} from "./fifaStandings";

function buildMatch(slotA, slotB) {
  return {
    idA: slotA.id,
    idB: slotB.id,
    labelA: slotA.label,
    labelB: slotB.label,
    pA: 50,
    pB: 50,
    winner: null,
    loser: null,
    hasScore: false,
  };
}

function resolveThirdSlot(slotIdx, allComplete, slotMap, pendingGroups) {
  if (allComplete) {
    const id = slotMap[slotIdx];
    return id ? makeBracketSlot(id, null) : makeBracketSlot(null, "3?");
  }
  const label = pendingGroups.length
    ? pendingGroups.map((g) => `3${g}`).join("/")
    : "3?";
  return makeBracketSlot(null, label);
}

/**
 * Kesinleşen yerleşim modu: garanti 1./2.ler takım adı, diğerleri 1A/2B etiketi;
 * 3.lük slotları tüm gruplar bitene kadar olası grup etiketleri.
 */
export function buildTemplateOfficialBracket({
  groupsConfig,
  fixtures,
  scoresMap,
  eloMap,
  getOfficialKOWinner,
}) {
  const groupData = {};
  Object.entries(groupsConfig).forEach(([gName, gTeams]) => {
    const gFixtures = fixtures.filter((f) => f.group === gName);
    const ranked = rankGroupByFifaRules(gTeams, gFixtures, scoresMap, eloMap);
    const complete = isGroupComplete(gFixtures, scoresMap);
    const clinch = analyzeGroupClinch(gTeams, gFixtures, scoresMap, eloMap);
    groupData[gName] = { ranked, complete, clinch, gFixtures };
  });

  const allComplete = areAllGroupsComplete(fixtures, scoresMap);
  const pendingThirdGroups = Object.keys(groupsConfig).filter(
    (g) => !groupData[g].complete
  );

  const pos = (g, p) =>
    resolveGroupPositionSlot(
      g,
      p,
      groupData[g].ranked,
      groupData[g].complete,
      groupData[g].clinch
    );

  // En iyi 3.ler (tüm gruplar bitince)
  const thirdsOutput = Object.keys(groupsConfig).map((gName) => {
    const third = groupData[gName].ranked[2];
    return third
      ? { id: third.id, group: gName, pts: third.pts, gd: third.gd, gf: third.gf }
      : null;
  }).filter(Boolean);

  const sortedThirds = thirdsOutput
    .sort((a, b) => compareBestThirdPlace(a, b, eloMap))
    .map((t) => t.id);

  const qualifiedThirds = allComplete ? sortedThirds.slice(0, 8) : [];
  const qualifiedLetters = qualifiedThirds
    .map((id) => Object.keys(groupsConfig).find((g) => groupsConfig[g].includes(id)))
    .sort()
    .join("");

  const slotMap = {};
  [0, 1, 2, 3, 4, 5, 6, 7].forEach((idx) => {
    if (allComplete) {
      const targetGroup = getFifaTargetThird(qualifiedLetters, idx);
      slotMap[idx] =
        qualifiedThirds.find((id) => groupsConfig[targetGroup]?.includes(id)) || null;
    } else {
      slotMap[idx] = null;
    }
  });

  const third = (idx) => resolveThirdSlot(idx, allComplete, slotMap, pendingThirdGroups);

  const resolveMatchOfficial = (slotA, slotB) => {
    const idA = slotA.id;
    const idB = slotB.id;
    const base = buildMatch(slotA, slotB);
    if (!idA || !idB) return base;
    const koW = getOfficialKOWinner(idA, idB);
    if (koW) {
      return {
        ...base,
        pA: koW === idA ? 100 : 0,
        pB: koW === idB ? 100 : 0,
        winner: koW,
        loser: koW === idA ? idB : idA,
        hasScore: true,
      };
    }
    return base;
  };

  const advanceSlot = (match) => {
    if (match?.hasScore && match.winner) {
      return makeBracketSlot(match.winner, null);
    }
    return makeBracketSlot(null, null);
  };

  const left_r32 = [
    resolveMatchOfficial(pos("E", 1), third(3)),
    resolveMatchOfficial(pos("I", 1), third(5)),
    resolveMatchOfficial(pos("A", 2), pos("B", 2)),
    resolveMatchOfficial(pos("F", 1), pos("C", 2)),
    resolveMatchOfficial(pos("K", 2), pos("L", 2)),
    resolveMatchOfficial(pos("H", 1), pos("J", 2)),
    resolveMatchOfficial(pos("D", 1), third(2)),
    resolveMatchOfficial(pos("G", 1), third(4)),
  ];

  const resolveKnockoutPair = (matchA, matchB) => {
    const wA = advanceSlot(matchA);
    const wB = advanceSlot(matchB);
    if (wA.id && wB.id) return resolveMatchOfficial(wA, wB);
    return buildMatch(
      wA.id ? wA : makeBracketSlot(null, null),
      wB.id ? wB : makeBracketSlot(null, null)
    );
  };

  const left_r16 = [
    resolveKnockoutPair(left_r32[0], left_r32[1]),
    resolveKnockoutPair(left_r32[2], left_r32[3]),
    resolveKnockoutPair(left_r32[4], left_r32[5]),
    resolveKnockoutPair(left_r32[6], left_r32[7]),
  ];
  const left_qf = [
    resolveKnockoutPair(left_r16[0], left_r16[1]),
    resolveKnockoutPair(left_r16[2], left_r16[3]),
  ];
  const left_sf = resolveKnockoutPair(left_qf[0], left_qf[1]);

  const right_r32 = [
    resolveMatchOfficial(pos("C", 1), pos("F", 2)),
    resolveMatchOfficial(pos("E", 2), pos("I", 2)),
    resolveMatchOfficial(pos("A", 1), third(0)),
    resolveMatchOfficial(pos("L", 1), third(7)),
    resolveMatchOfficial(pos("J", 1), pos("H", 2)),
    resolveMatchOfficial(pos("D", 2), pos("G", 2)),
    resolveMatchOfficial(pos("B", 1), third(1)),
    resolveMatchOfficial(pos("K", 1), third(6)),
  ];
  const right_r16 = [
    resolveKnockoutPair(right_r32[0], right_r32[1]),
    resolveKnockoutPair(right_r32[2], right_r32[3]),
    resolveKnockoutPair(right_r32[4], right_r32[5]),
    resolveKnockoutPair(right_r32[6], right_r32[7]),
  ];
  const right_qf = [
    resolveKnockoutPair(right_r16[0], right_r16[1]),
    resolveKnockoutPair(right_r16[2], right_r16[3]),
  ];
  const right_sf = resolveKnockoutPair(right_qf[0], right_qf[1]);

  const finalMatch = resolveKnockoutPair(left_sf, right_sf);
  const thirdPlaceMatch = resolveMatchOfficial(
    left_sf.hasScore && left_sf.loser ? makeBracketSlot(left_sf.loser, null) : makeBracketSlot(null, null),
    right_sf.hasScore && right_sf.loser ? makeBracketSlot(right_sf.loser, null) : makeBracketSlot(null, null)
  );

  return {
    left_r32,
    left_r16,
    left_qf,
    left_sf,
    right_r32,
    right_r16,
    right_qf,
    right_sf,
    finalMatch,
    thirdPlaceMatch,
    sortedThirds,
    qualifiedThirds,
    isTemplate: true,
  };
}
