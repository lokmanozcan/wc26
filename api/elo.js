/**
 * Vercel Serverless Function: /api/elo
 * eloratings.net/2026_World_Cup.tsv'den WC2026 takımlarının ELO puanlarını çeker.
 * Format: rank \t rank \t ISO3 \t ELO \t ...
 * Cache: 1 saat
 */

// eloratings.net 3-harf kodu → bizim proje kodu
const CODE_MAP = {
  ES:  "ESP", AR:  "ARG", FR:  "FRA", EN:  "ENG", BR:  "BRA",
  PT:  "POR", NL:  "NED", DE:  "GER", HR:  "CRO", EC:  "ECU",
  NO:  "NOR", CH:  "SUI", UY:  "URU", TR:  "TUR", JP:  "JPN",
  SN:  "SEN", BE:  "BEL", MA:  "MAR", CO:  "COL", MX:  "MEX",
  US:  "USA", AU:  "AUS", AT:  "AUT", JO:  "JOR", KR:  "KOR",
  CZ:  "CZE", SE:  "SWE", EG:  "EGY", IR:  "IRN", PA:  "PAN",
  GH:  "GHA", PY:  "PAR", DZ:  "ALG", SA:  "KSA", TN:  "TUN",
  NZ:  "NZL", IQ:  "IRQ", HT:  "HAI", ZA:  "RSA", UZ:  "UZB",
  CD:  "COD", CV:  "CPV", BA:  "BIH", QA:  "QAT", CI:  "CIV",
  CW:  "CUW", CA:  "CAN",
  SQ:  "SCO",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");

  try {
    const response = await fetch("https://www.eloratings.net/2026_World_Cup.tsv", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.eloratings.net/",
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const eloData = {};
    const unmapped = [];

    for (const line of text.trim().split("\n")) {
      const cols = line.split("\t");
      // cols[2] = ISO3 kod, cols[3] = ELO puanı
      if (cols.length < 4) continue;
      const isoCode = cols[2]?.trim();
      const elo = parseInt(cols[3]);
      if (!isoCode || isNaN(elo)) continue;

      const projectCode = CODE_MAP[isoCode];
      if (projectCode) {
        eloData[projectCode] = elo;
      } else {
        unmapped.push({ iso: isoCode, elo });
      }
    }

    return res.status(200).json({
      updated: new Date().toISOString(),
      count: Object.keys(eloData).length,
      elo: eloData,
      unmapped, // eşleşemeyen kodları görmek için
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
