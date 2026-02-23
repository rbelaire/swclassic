// Vercel serverless function: GET /api/weather
// Proxies OpenWeatherMap API to hide the API key.

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_URL = `https://api.openweathermap.org/data/2.5/weather?q=Lafayette,LA,US&units=imperial&appid=${OPENWEATHER_API_KEY}`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENWEATHER_API_KEY) {
    return res.status(500).json({ error: "Weather API key not configured" });
  }

  try {
    const response = await fetch(WEATHER_URL);
    if (!response.ok) {
      return res.status(502).json({ error: `Weather API error: ${response.status}` });
    }
    const data = await response.json();
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: `Weather fetch failed: ${e.message}` });
  }
};
