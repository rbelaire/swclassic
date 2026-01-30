<!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8" />
  <title>The Classic 2026 - Tournament Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="css/styles.css">
</head>

<body>

  <!-- HEADER -->

  <div class="admin-header">
    <div class="admin-header-content">
      <div class="admin-title">
        <h1>🏆 Tournament Admin</h1>
        <p class="admin-subtitle">The Classic 2026 | Live Score Management</p>
      </div>
      <div class="admin-actions">
        <button onclick="saveToGitHub()" class="btn-primary">
          💾 Save to GitHub
        </button>
        <a href="leaderboard.html" target="_blank" class="btn-secondary">
          👁️ View Live Board
        </a>
      </div>
    </div>
  </div>

  <!-- PROGRESS DASHBOARD -->

  <div class="admin-container">
    <div class="dashboard-section">
      <h2>📊 Tournament Progress</h2>
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card">
          <div class="stat-number" id="stat-complete">0</div>
          <div class="stat-label">Matches Complete</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="stat-in-progress">0</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" id="stat-not-started">16</div>
          <div class="stat-label">Not Started</div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-number" id="stat-progress">0%</div>
          <div class="stat-label">Overall Progress</div>
        </div>
      </div>
    </div>

```
<!-- TEAM TOTALS -->
<div class="totals-section" id="totals">
  <div class="total-card brock">
    <div class="team-name">Team Brock</div>
    <div class="team-score" id="total-brock">0.0</div>
  </div>
  <div class="vs-divider">VS</div>
  <div class="total-card jared">
    <div class="team-name">Team Jared</div>
    <div class="team-score" id="total-jared">0.0</div>
  </div>
</div>

<!-- QUICK ACTIONS -->
<div class="quick-actions">
  <button onclick="markAllNotStarted()" class="action-btn">
    🔄 Reset All Scores
  </button>
  <button onclick="markAllInProgress()" class="action-btn">
    ▶️ Mark All In Progress
  </button>
  <button onclick="expandAll()" class="action-btn">
    📂 Expand All
  </button>
  <button onclick="collapseAll()" class="action-btn">
    📁 Collapse All
  </button>
</div>

<!-- MATCHES -->
<div class="matches-section">
  <h2>⛳ Match Scores</h2>
  <p class="section-note">Click on a match to expand and enter scores</p>
  <div id="matches"></div>
</div>

<!-- SAVE REMINDER -->
<div class="save-reminder" id="save-reminder" style="display: none;">
  <div class="reminder-content">
    ⚠️ You have unsaved changes! 
    <button onclick="saveToGitHub()" class="btn-primary-small">Save Now</button>
  </div>
</div>
```

  </div>

  <script src="admin.js"></script>

  <style>
    /* ======================
       ADMIN-SPECIFIC STYLES
       ====================== */
    
    body {
      background: #f5f3e8;
      margin: 0;
      padding: 0;
    }

    .admin-header {
      background: linear-gradient(135deg, #0d3d1f 0%, #1a5c2f 100%);
      color: #f5f3e8;
      padding: 25px 20px;
      box-shadow: 0 4px 20px rgba(13,61,31,0.3);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .admin-header-content {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }

    .admin-title h1 {
      margin: 0;
      font-size: 2em;
      letter-spacing: 2px;
    }

    .admin-subtitle {
      margin: 5px 0 0 0;
      opacity: 0.9;
      font-size: 0.95em;
    }

    .admin-actions {
      display: flex;
      gap: 10px;
    }

    .btn-primary {
      background: #d4af37;
      color: #0d3d1f;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 1em;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(212,175,55,0.4);
    }

    .btn-secondary {
      background: transparent;
      color: #f5f3e8;
      padding: 12px 24px;
      border: 2px solid #f5f3e8;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 1em;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .btn-secondary:hover {
      background: #f5f3e8;
      color: #0d3d1f;
    }

    .btn-primary-small {
      background: #d4af37;
      color: #0d3d1f;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.9em;
      margin-left: 10px;
    }

    .admin-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 30px 20px;
    }

    /* Dashboard */
    .dashboard-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      border: 2px solid #0d3d1f;
      box-shadow: 0 4px 15px rgba(13,61,31,0.08);
    }

    .dashboard-section h2 {
      margin: 0 0 20px 0;
      color: #0d3d1f;
      font-size: 1.8em;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .stat-card {
      background: #f5f3e8;
      padding: 25px;
      border-radius: 10px;
      text-align: center;
      border: 2px solid #0d3d1f;
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 20px rgba(13,61,31,0.15);
    }

    .stat-card.highlight {
      background: linear-gradient(135deg, #d4af37 0%, #f4d976 100%);
      border-color: #d4af37;
    }

    .stat-number {
      font-size: 3em;
      font-weight: bold;
      color: #0d3d1f;
      margin-bottom: 10px;
    }

    .stat-label {
      font-size: 1em;
      color: #0d3d1f;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* Team Totals */
    .totals-section {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 20px;
      margin-bottom: 30px;
      align-items: center;
    }

    .total-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      text-align: center;
      border: 3px solid #0d3d1f;
      transition: all 0.3s ease;
    }

    .total-card.winning {
      border-color: #d4af37;
      background: linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.05) 100%);
      transform: scale(1.05);
    }

    .team-name {
      font-size: 1.5em;
      font-weight: bold;
      color: #0d3d1f;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .team-score {
      font-size: 4em;
      font-weight: bold;
      color: #0d3d1f;
    }

    .total-card.winning .team-score {
      color: #d4af37;
    }

    .vs-divider {
      font-size: 2.5em;
      font-weight: bold;
      color: #0d3d1f;
      text-align: center;
    }

    /* Quick Actions */
    .quick-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }

    .action-btn {
      background: white;
      color: #0d3d1f;
      padding: 12px 20px;
      border: 2px solid #0d3d1f;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.95em;
      transition: all 0.3s ease;
    }

    .action-btn:hover {
      background: #0d3d1f;
      color: #f5f3e8;
      transform: translateY(-2px);
    }

    /* Matches Section */
    .matches-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      border: 2px solid #0d3d1f;
      box-shadow: 0 4px 15px rgba(13,61,31,0.08);
    }

    .matches-section h2 {
      margin: 0 0 10px 0;
      color: #0d3d1f;
      font-size: 1.8em;
    }

    .section-note {
      margin: 0 0 25px 0;
      color: #0d3d1f;
      opacity: 0.7;
      font-style: italic;
    }

    .match {
      background: #f5f3e8;
      border: 2px solid #0d3d1f;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 15px;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .match:hover {
      border-color: #d4af37;
      transform: translateX(5px);
    }

    .match.expanded {
      background: white;
      border-color: #d4af37;
      border-width: 3px;
    }

    .match.invalid {
      background: #ffecec;
      border-color: #c62828;
    }

    .match.complete {
      background: #e8f5e9;
      border-color: #2e7d32;
    }

    .match-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .match-title {
      font-size: 1.3em;
      font-weight: bold;
      color: #0d3d1f;
    }

    .match-status-badge {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.85em;
      font-weight: bold;
      text-transform: uppercase;
    }

    .match-status-badge.not-started {
      background: #e0e0e0;
      color: #666;
    }

    .match-status-badge.in-progress {
      background: #fff8e1;
      color: #f57c00;
    }

    .match-status-badge.complete {
      background: #c8e6c9;
      color: #2e7d32;
    }

    .match-preview {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #0d3d1f;
    }

    .match-details {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #0d3d1f;
      display: none;
    }

    .match.expanded .match-details {
      display: block;
    }

    .players-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }

    .player-select-wrap {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border: 2px solid #0d3d1f;
    }

    .player-select-wrap label {
      display: block;
      font-weight: bold;
      margin-bottom: 8px;
      color: #0d3d1f;
    }

    .player-select-wrap select {
      width: 100%;
      padding: 10px;
      border: 2px solid #0d3d1f;
      border-radius: 6px;
      font-size: 1em;
      background: white;
    }

    .scores-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }

    .score-wrap {
      background: #f5f3e8;
      padding: 15px;
      border-radius: 8px;
      border: 2px solid #0d3d1f;
    }

    .score-wrap label {
      display: block;
      font-weight: bold;
      margin-bottom: 8px;
      color: #0d3d1f;
    }

    .score-wrap select {
      width: 100%;
      padding: 10px;
      border: 2px solid #0d3d1f;
      border-radius: 6px;
      font-size: 1.1em;
      background: white;
      font-weight: bold;
    }

    .score-wrap select:disabled {
      opacity: 0.5;
      background: #e0e0e0;
      cursor: not-allowed;
    }

    .match-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .match-btn {
      padding: 10px 20px;
      border: 2px solid #0d3d1f;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.95em;
      transition: all 0.3s ease;
      background: white;
      color: #0d3d1f;
    }

    .match-btn:hover {
      background: #0d3d1f;
      color: white;
    }

    /* Save Reminder */
    .save-reminder {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff9800;
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 6px 25px rgba(255,152,0,0.4);
      z-index: 1000;
      animation: slideInUp 0.3s ease;
    }

    @keyframes slideInUp {
      from {
        transform: translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .reminder-content {
      display: flex;
      align-items: center;
      gap: 15px;
      font-weight: bold;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .admin-header-content {
        flex-direction: column;
        text-align: center;
      }

      .admin-actions {
        flex-direction: column;
        width: 100%;
      }

      .btn-primary, .btn-secondary {
        width: 100%;
      }

      .totals-section {
        grid-template-columns: 1fr;
      }

      .vs-divider {
        transform: rotate(90deg);
        margin: 10px 0;
      }

      .players-grid,
      .scores-grid {
        grid-template-columns: 1fr;
      }

      .match-actions {
        flex-direction: column;
      }

      .match-btn {
        width: 100%;
      }
    }
  </style>

</body>
</html>