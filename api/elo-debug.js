export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  // eloratings.net'in kullandığı bilinen data endpoint'lerini dene
  const urls = [
    "https://www.eloratings.net/World.tsv",
    "https://www.eloratings.net/World",
    "https://www.eloratings.net/2026_World_Cup.tsv",
    "https://www.eloratings.net/en.eloratings.net/World",
    "https://en.eloratings.net/World",
    "https://en.eloratings.net/2026_World_Cup",
  ];

  const results = {};
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://www.eloratings.net/",
          "Accept": "*/*",
        },
      });
      const text = await r.text();
      results[url] = {
        status: r.status,
        contentType: r.headers.get("content-type"),
        preview: text.substring(0, 300),
      };
    } catch(e) {
      results[url] = { error: e.message };
    }
  }
  
  return res.status(200).json(results);
}
