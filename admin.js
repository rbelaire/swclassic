/*************************
 * IMPROVED ADMIN INTERFACE
 * The Classic 2026
 *************************/

const ADMIN_PASSWORD = "classic2026";
let hasUnsavedChanges = false;
let expandedMatches = new Set(); // Track which matches are expanded

// Password check
if (sessionStorage.getItem("adminAuth") !== "true") {
  const entered = prompt("Enter admin password:");
  if (entered !== ADMIN_PASSWORD) {
    alert("Access denied");
    window.location.href = "index.html";
  }
  sessionStorage.setItem("adminAuth", "true");
}

/*************************
 * LOAD DATA
 *************************/
let data;
const DATA_CACHE_KEY = "classicAdminData";
const LEADERBOARD_CACHE_KEY = "classicLeaderboardData";

function getCachedData() {
  try {
    const cached = localStorage.getItem(DATA_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn("Unable to read cached data.", error);
    return null;
  }
}

function saveCachedData(updatedData) {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.warn("Unable to cache data.", error);
  }
}


function saveLeaderboardCache(updatedData) {
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.warn("Unable to cache leaderboard data.", error);
  }
}

function isNewerData(nextData, currentData) {
  if (!currentData?.meta?.lastUpdated) return true;
  if (!nextData?.meta?.lastUpdated) return false;
  return Date.parse(nextData.meta.lastUpdated) >= Date.parse(currentData.meta.lastUpdated);
}

function loadData() {
  const cached = getCachedData();
  if (cached) {
    data = cached;
    render();
  
  }

  fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => res.json())
    .then(json => {
      if (!data || isNewerData(json, data)) {
        data = json;
        render();
        saveCachedData(json);
        saveLeaderboardCache(json);
      }
    })
    .catch(err => {
      alert("Error loading tournament data. Please refresh.");
      console.error(err);
    });
}

loadData();

/*************************
 * RENDER
 *************************/
function render() {
  renderStats();
  renderTotals();
  renderFoursomes();
}

/*************************
 * STATISTICS DASHBOARD
 *************************/
function renderStats() {
  let complete = 0;
  let inProgress = 0;
  let notStarted = 0;

  data.matches.forEach(match => {
    const front = match.points.front9;
    const back = match.points.back9;

    if (front !== null && back !== null) {
      complete++;
    } else if (front !== null || back !== null) {
@@ -377,39 +425,42 @@ function saveToGitHub() {
      Authorization: `token ${token}`
    }
  })
    .then(res => res.json())
    .then(file => {
      const sha = file.sha;

      // Step 2: Update file
      return fetch("https://api.github.com/repos/rbelaire/swclassic/contents/data.json", {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Update tournament scores",
          content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
          sha: sha
        })
      });
    })
    .then(res => res.json())
    .then(resp => {
      if (resp.content) {
        markSaved();
        saveCachedData(data);
        saveLeaderboardCache(data);
        loadData();
        alert("✅ Scores saved successfully!\n\nThe leaderboard will update automatically within 30 seconds.");
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      } else {
        throw new Error("Save failed");
      }
    })
    .catch(err => {
      console.error(err);
      alert("❌ Save failed. Check your token and try again.");
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    });
}
