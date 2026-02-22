// Vercel serverless function: POST /api/save
// Writes updated data.json to GitHub via the Contents API.
// Requires GITHUB_TOKEN env var with repo Contents read+write permission.

const ADMIN_PASSWORD_HASH = "5a40d95d61e29d6665ff382de6e0b0cc6a3bbb546aeececa59911e08d597587b";
const GITHUB_REPO = "rbelaire/swclassic";
const GITHUB_BRANCH = "Main";
const DATA_FILE_PATH = "data.json";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password, data, expectedLastUpdated } = req.body || {};

  if (password !== ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ error: "Invalid password" });
  }

  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "No valid data provided" });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "GitHub token not configured" });
  }

  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Get current file SHA (required for update) and check optimistic lock
  const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers });
  if (!getRes.ok) {
    const err = await getRes.text();
    return res.status(500).json({ error: `Failed to fetch current file: ${err}` });
  }
  const fileInfo = await getRes.json();
  const sha = fileInfo.sha;

  // Optimistic locking: decode current content and compare lastUpdated
  if (expectedLastUpdated) {
    try {
      const currentContent = JSON.parse(Buffer.from(fileInfo.content, "base64").toString("utf8"));
      const currentTs = currentContent?.meta?.lastUpdated;
      if (currentTs && currentTs !== expectedLastUpdated) {
        return res.status(409).json({ error: "Data was modified by another user. Reload and try again." });
      }
    } catch (_) {
      // If we can't parse, allow the save
    }
  }

  // Encode new content as base64
  const newContent = Buffer.from(JSON.stringify(data, null, 2) + "\n").toString("base64");

  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "Update tournament data",
      content: newContent,
      sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return res.status(500).json({ error: `GitHub write failed: ${err}` });
  }

  return res.status(200).json({ success: true });
}
