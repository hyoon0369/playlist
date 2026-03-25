export default async function handler(req, res) {
  const { endpoint, ...params } = req.query;

  if (endpoint !== "search" && endpoint !== "lookup") {
    return res.status(400).json({ error: "Invalid endpoint" });
  }

  const url = new URL(`https://itunes.apple.com/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.status(response.status).json({ error: "iTunes API error" });
    }
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Proxy error", message: e.message });
  }
}
