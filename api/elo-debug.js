export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const response = await fetch("https://www.eloratings.net/2026_World_Cup", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(html.substring(0, 3000));
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
