// Vercel serverless function: GET /api/data
// Returns the current data.json straight from GitHub (the committed source of
// truth) so the live leaderboard reflects a save within seconds, instead of
// waiting for Vercel to rebuild and republish the static file.
//
// Edge-cached for a few seconds (s-maxage) so any number of spectators share
// one upstream read per window and GitHub's rate limit is never a concern.

const GITHUB_REPO = "rbelaire/swclassic";
const GITHUB_BRANCH = "main";
const DATA_FILE = "data.json";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: "GitHub token not configured" });
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}?ref=${GITHUB_BRANCH}`;
    const ghRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!ghRes.ok) {
      const err = await ghRes.text();
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({ error: `Failed to fetch data: ${err}` });
    }
    const info = await ghRes.json();
    const json = JSON.parse(Buffer.from(info.content, "base64").toString("utf8"));

    // Serve fresh within ~10s; allow brief stale-while-revalidate for smoothness.
    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=20");
    return res.status(200).json(json);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: `Data fetch failed: ${e.message}` });
  }
};
