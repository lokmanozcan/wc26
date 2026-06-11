/**
 * Vercel Serverless Function: /api/elo
 * eloratings.net'ten WC2026 takımlarının güncel ELO puanlarını çeker.
 * Vercel'in edge cache'i sayesinde saatte bir güncellenir (s-maxage=3600).
 *
 * eloratings.net JavaScript ile render ediliyor ama arka planda
 * "en.eloratings.net/<TakımAdı>" endpoint'leri metin bazlı veri sunuyor.
 * Her takım için ayrı istek yerine ana sayfa HTML'inden parse ediyoruz.
 */

// Projemizdeki kod → eloratings.net isim eşleşme tablosu
const TEAM_NAME_MAP = {
  "Mexico":           "MEX",
  "South Africa":     "RSA",
  "Korea Republic":   "KOR",
  "Czech Republic":   "CZE",
  "Canada":           "CAN",
  "Bosnia-Herz.":     "BIH",
  "Bosnia & Herzeg.": "BIH",
  "Bosnia Herzegovina":"BIH",
  "Qatar":            "QAT",
  "Switzerland":      "SUI",
  "Brazil":           "BRA",
  "Morocco":          "MAR",
  "Haiti":            "HAI",
  "Scotland":         "SCO",
  "USA":              "USA",
  "United States":    "USA",
  "Paraguay":         "PAR",
  "Australia":        "AUS",
  "Turkey":           "TUR",
  "Germany":          "GER",
  "Curaçao":          "CUW",
  "Curacao":          "CUW",
  "Ivory Coast":      "CIV",
  "Côte d'Ivoire":    "CIV",
  "Ecuador":          "ECU",
  "Netherlands":      "NED",
  "Japan":            "JPN",
  "Sweden":           "SWE",
  "Tunisia":          "TUN",
  "Belgium":          "BEL",
  "Egypt":            "EGY",
  "Iran":             "IRN",
  "New Zealand":      "NZL",
  "Spain":            "ESP",
  "Cape Verde":       "CPV",
  "Cape Verde Is.":   "CPV",
  "Saudi Arabia":     "KSA",
  "Uruguay":          "URU",
  "France":           "FRA",
  "Senegal":          "SEN",
  "Iraq":             "IRQ",
  "Norway":           "NOR",
  "Argentina":        "ARG",
  "Algeria":          "ALG",
  "Austria":          "AUT",
  "Jordan":           "JOR",
  "Portugal":         "POR",
  "DR Congo":         "COD",
  "Congo DR":         "COD",
  "Uzbekistan":       "UZB",
  "Colombia":         "COL",
  "England":          "ENG",
  "Croatia":          "CRO",
  "Ghana":            "GHA",
  "Panama":           "PAN",
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // Vercel edge cache: 1 saat taze, 2 saat stale-while-revalidate
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");

  try {
    // eloratings.net/2026_World_Cup sayfasını çek
    const response = await fetch("https://www.eloratings.net/2026_World_Cup", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`eloratings.net HTTP ${response.status}`);
    }

    const html = await response.text();

    // Sayfada "data-team" veya tablo satırlarından ELO parse et
    // eloratings.net sayfasında takım adı ve puan şu pattern'de geçiyor:
    // <td class="teamName">Mexico</td> ... <td class="points">1892</td>
    // veya JSON embedded script içinde
    const eloData = {};

    // Pattern 1: JSON embed (script tag içinde)
    const jsonMatch = html.match(/var\s+teams\s*=\s*(\[[\s\S]*?\]);/);
    if (jsonMatch) {
      try {
        const teams = JSON.parse(jsonMatch[1]);
        teams.forEach(t => {
          const code = TEAM_NAME_MAP[t.name] || TEAM_NAME_MAP[t.n];
          if (code && t.points) eloData[code] = parseInt(t.points);
          else if (code && t.p) eloData[code] = parseInt(t.p);
        });
      } catch (_) {}
    }

    // Pattern 2: HTML tablo parse (fallback)
    if (Object.keys(eloData).length < 10) {
      // <tr> satırlarını bul
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(html)) !== null) {
        const row = rowMatch[1];
        // Takım adı
        const nameMatch = row.match(/class="[^"]*team[^"]*"[^>]*>([\w\s.\-'çéáöüãñ&;]+)</i);
        // Puan (3-4 basamaklı sayı)
        const pointsMatch = row.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
        if (nameMatch && pointsMatch) {
          const rawName = nameMatch[1].trim().replace(/&amp;/g, "&");
          const code = TEAM_NAME_MAP[rawName];
          if (code) eloData[code] = parseInt(pointsMatch[1]);
        }
      }
    }

    // Pattern 3: script içinde obje literal parse
    if (Object.keys(eloData).length < 10) {
      const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      for (const sm of scriptMatches) {
        const script = sm[1];
        // ["TeamName", 1234, ...] pattern
        const arrayMatches = script.matchAll(/\["([^"]+)",\s*(\d{4})/g);
        for (const am of arrayMatches) {
          const code = TEAM_NAME_MAP[am[1]];
          if (code) eloData[code] = parseInt(am[2]);
        }
      }
    }

    if (Object.keys(eloData).length === 0) {
      // Site yapısı değişmiş olabilir — raw HTML'i logla
      console.error("ELO parse başarısız. HTML snippet:", html.substring(0, 500));
      return res.status(502).json({
        error: "ELO verisi parse edilemedi",
        hint: "eloratings.net sayfa yapısı değişmiş olabilir"
      });
    }

    return res.status(200).json({
      updated: new Date().toISOString(),
      count: Object.keys(eloData).length,
      elo: eloData,
    });

  } catch (err) {
    console.error("ELO fetch hatası:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
