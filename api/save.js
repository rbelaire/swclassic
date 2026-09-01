// Vercel serverless function: POST /api/save
// Writes updated data.json to GitHub via the Contents API.
// Requires GITHUB_TOKEN env var with repo Contents read+write permission.
//
// Concurrency model (a live round has 3 foursomes scoring at once):
//   - Foursome scorers send { foursome: 0|1|2 }. The server merges ONLY that
//     foursome's two matches onto the latest committed data, so two groups
//     saving at the same time can never clobber each other's holes.
//   - The admin console sends a full document with expectedLastUpdated; the
//     server enforces that as an optimistic lock (409 on mismatch).
//   - Every write retries on a GitHub SHA conflict (two writers racing on the
//     same commit), re-reading and re-merging before giving up.

const ADMIN_PASSWORD_HASH = "5a40d95d61e29d6665ff382de6e0b0cc6a3bbb546aeececa59911e08d597587b";
const GITHUB_REPO = "rbelaire/swclassic";
const GITHUB_BRANCH = "main";
const DATA_FILE_PATH = "data.json";
const MAX_ATTEMPTS = 4;

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

  const { password, data, foursome, expectedLastUpdated } = req.body || {};

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

  const isFoursome =
    Number.isInteger(foursome) && foursome >= 0 && foursome <= 2;

  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 1. Read the current committed file (SHA + content)
    const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}&t=${Date.now()}`, {
      headers,
      cache: "no-store",
    });
    if (!getRes.ok) {
      const err = await getRes.text();
      return res.status(500).json({ error: `Failed to fetch current file: ${err}` });
    }
    const fileInfo = await getRes.json();
    const sha = fileInfo.sha;

    let currentData;
    try {
      currentData = JSON.parse(Buffer.from(fileInfo.content, "base64").toString("utf8"));
    } catch (e) {
      return res.status(500).json({ error: "Current data.json is not valid JSON" });
    }

    // 2. Build the document to write
    let toWrite;
    if (isFoursome && Array.isArray(currentData.matches) && Array.isArray(data.matches)) {
      // Merge only this foursome's two matches onto the latest server truth.
      toWrite = currentData;
      const idxA = foursome * 2;
      const idxB = foursome * 2 + 1;
      if (data.matches[idxA]) toWrite.matches[idxA] = data.matches[idxA];
      if (data.matches[idxB]) toWrite.matches[idxB] = data.matches[idxB];
      toWrite.meta = toWrite.meta || {};
      toWrite.meta.lastUpdated = new Date().toISOString();
    } else {
      // Full-document (admin) write. Enforce the optimistic lock if provided.
      const currentTs = currentData?.meta?.lastUpdated;
      if (expectedLastUpdated && currentTs && currentTs !== expectedLastUpdated) {
        return res.status(409).json({
          error: "conflict: data was modified by another user. Reload and try again.",
        });
      }
      toWrite = data;
      toWrite.meta = toWrite.meta || {};
      if (!toWrite.meta.lastUpdated) toWrite.meta.lastUpdated = new Date().toISOString();
    }

    // 3. Commit it
    const newContent = Buffer.from(JSON.stringify(toWrite, null, 2) + "\n").toString("base64");
    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: isFoursome
          ? `Update scores (foursome ${foursome + 1})`
          : "Update tournament data",
        content: newContent,
        sha,
        branch: GITHUB_BRANCH,
      }),
    });

    if (putRes.ok) {
      return res.status(200).json({ success: true, lastUpdated: toWrite.meta.lastUpdated });
    }

    // 409/422 => the SHA moved under us (another writer committed). Re-read and retry.
    if ((putRes.status === 409 || putRes.status === 422) && attempt < MAX_ATTEMPTS) {
      continue;
    }

    const err = await putRes.text();
    return res.status(500).json({ error: `GitHub write failed: ${err}` });
  }

  return res.status(503).json({ error: "Save is busy — please try again." });
};
