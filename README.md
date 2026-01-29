# The Classic 2026 - Live Leaderboard User Guide

## Table of Contents
1. [Overview](#overview)
2. [How to Update Scores](#how-to-update-scores)
3. [Updating Team Totals](#updating-team-totals)
4. [Match Status Options](#match-status-options)
5. [Deploying to GitHub Pages](#deploying-to-github-pages)
6. [Quick Reference Guide](#quick-reference-guide)
7. [Tips for Tournament Day](#tips-for-tournament-day)

---

## Overview

The live leaderboard displays real-time scoring for The Classic 2026 tournament. It shows:
- **Team scores** at the top (total points for each team)
- **Individual matches** broken down by foursome
- **Front 9 and Back 9 results** for each match
- **Match status** (Complete, In Progress, Not Started)
- **Tournament statistics** (matches complete, in progress, etc.)

---

## How to Update Scores

### Step 1: Open the HTML file
You can edit `leaderboard.html` in any text editor:
- **Windows:** Notepad, Notepad++, VS Code
- **Mac:** TextEdit, VS Code, Sublime Text
- **Online:** GitHub web editor (see deployment section)

### Step 2: Find the match you want to update
Each match is contained in a `<div class="matchup">` section. Search for the player names.

Example:
```html
<!-- Match 1A -->
<div class="matchup">
    <div class="matchup-header">
        <span class="player-name winner">Gavin (Brock)</span>
        <span style="font-size: 1.5em; color: #0d3d1f;">VS</span>
        <span class="player-name">Tyler (Jared)</span>
    </div>
```

### Step 3: Update the score displays

#### For Front 9 results:
```html
<div class="nine-score won">
    <div class="nine-label">Front 9</div>
    <div class="nine-result">Gavin 1-0</div>
</div>
```

**Class options:**
- `won` - Player won this nine (solid gold background)
- `tied` - Match tied (dashed border)
- No class - Default styling

**Result options:**
- `PlayerName 1-0` - Player won the nine
- `0.5-0.5` - Tied
- `In Progress` - Currently playing
- `-` - Not started

#### For Back 9 results:
Same format as Front 9. Update the class and result text.

### Step 4: Update match status
At the bottom of each match:
```html
<div class="match-status">Gavin wins 1.5 - 0.5</div>
```

**Status options:**
- `PlayerName wins X - Y` (when complete)
- `On Course` (in progress)
- `Not Started` (before tee time)

### Step 5: Mark the winner
Add the `winner` class to the winning player's name:
```html
<span class="player-name winner">Gavin (Brock)</span>
```

This makes their name display in gold.

---

## Updating Team Totals

### Location in code:
```html
<div class="team-card winning">
    <h2>TEAM BROCK</h2>
    <div class="total-score" id="team-brock-score">4.5</div>
    <div class="score-label">Total Points</div>
</div>
```

### To update:
1. **Change the number** inside `<div class="total-score">` tags
2. **Add/remove "winning" class** from the team-card with the higher score:
   - `<div class="team-card winning">` - Leading team (gold highlight)
   - `<div class="team-card">` - Trailing team (standard)

### Point calculation:
Each match is worth 2 points total:
- Win Front 9 = 1 point
- Win Back 9 = 1 point
- Tie = 0.5 points each

---

## Match Status Options

### Complete Match Example:
```html
<div class="matchup">
    <div class="matchup-header">
        <span class="player-name winner">Bel (Brock)</span>
        <span style="font-size: 1.5em; color: #0d3d1f;">VS</span>
        <span class="player-name">Hunter (Jared)</span>
    </div>
    <div class="score-display">
        <div class="nine-score won">
            <div class="nine-label">Front 9</div>
            <div class="nine-result">Bel 1-0</div>
        </div>
        <div class="nine-score won">
            <div class="nine-label">Back 9</div>
            <div class="nine-result">Bel 1-0</div>
        </div>
    </div>
    <div class="match-status">Bel wins 2 - 0</div>
</div>
```

### In Progress Example:
```html
<div class="matchup">
    <div class="matchup-header">
        <span class="player-name">Miles (Brock)</span>
        <span style="font-size: 1.5em; color: #0d3d1f;">VS</span>
        <span class="player-name">Lane (Jared)</span>
    </div>
    <div class="score-display">
        <div class="nine-score won">
            <div class="nine-label">Front 9</div>
            <div class="nine-result">Miles 1-0</div>
        </div>
        <div class="nine-score">
            <div class="nine-label">Back 9</div>
            <div class="nine-result">In Progress</div>
        </div>
    </div>
    <div class="match-status">On Course</div>
</div>
```

### Not Started Example:
```html
<div class="matchup">
    <div class="matchup-header">
        <span class="player-name">JV (Brock)</span>
        <span style="font-size: 1.5em; color: #0d3d1f;">VS</span>
        <span class="player-name">Alex (Jared)</span>
    </div>
    <div class="score-display">
        <div class="nine-score">
            <div class="nine-label">Front 9</div>
            <div class="nine-result">-</div>
        </div>
        <div class="nine-score">
            <div class="nine-label">Back 9</div>
            <div class="nine-result">-</div>
        </div>
    </div>
    <div class="match-status">Not Started</div>
</div>
```

---

## Deploying to GitHub Pages

### Initial Setup (One Time)

#### Option 1: GitHub Web Interface (Easiest)
1. Go to **GitHub.com** and create a new repository
2. Name it something like `classic-2026` (or anything you want)
3. Make it **Public**
4. Click **"Add file" → "Upload files"**
5. Upload all 4 HTML files:
   - `index.html`
   - `draft.html`
   - `rule.html`
   - `leaderboard.html`
6. Click **"Commit changes"**

#### Option 2: GitHub Desktop (For Regular Updates)
1. Download and install **GitHub Desktop**
2. Clone your repository to your computer
3. Copy the 4 HTML files into the repository folder
4. In GitHub Desktop:
   - Add commit message: "Initial website files"
   - Click **"Commit to main"**
   - Click **"Push origin"**

### Enable GitHub Pages
1. Go to your repository on GitHub.com
2. Click **"Settings"** (top menu)
3. Click **"Pages"** (left sidebar)
4. Under "Source":
   - Select **"Deploy from a branch"**
   - Choose **"main"** branch
   - Choose **"/ (root)"** folder
5. Click **"Save"**
6. Wait 2-3 minutes, refresh the page
7. Your site URL will appear at the top (looks like: `https://yourusername.github.io/classic-2026/`)

### Your Website URLs:
- **Homepage:** `https://yourusername.github.io/classic-2026/index.html`
- **Official Rankings:** `https://yourusername.github.io/classic-2026/draft.html`
- **The Draft:** `https://yourusername.github.io/classic-2026/rule.html`
- **Live Leaderboard:** `https://yourusername.github.io/classic-2026/leaderboard.html`

---

## Updating the Live Leaderboard During Tournament

### Method 1: GitHub Web Editor (No Software Needed)
1. Go to your repository on GitHub.com
2. Click on **`leaderboard.html`**
3. Click the **pencil icon** (Edit this file) in the top right
4. Make your changes directly in the browser
5. Scroll down and click **"Commit changes"**
6. Add a commit message like "Updated scores - 10:30 AM"
7. Click **"Commit changes"** again
8. Wait 30-60 seconds, then refresh your live site

**Advantages:**
- Can update from any device (phone, tablet, laptop)
- No software installation needed
- Easy for multiple people to update

### Method 2: GitHub Desktop (Faster for Frequent Updates)
1. Open GitHub Desktop
2. Click **"Fetch origin"** to get latest version
3. Open `leaderboard.html` in your text editor
4. Make changes and save
5. In GitHub Desktop:
   - Add commit message: "Updated Match 1A scores"
   - Click **"Commit to main"**
   - Click **"Push origin"**
6. Changes go live in 30-60 seconds

### Method 3: Mobile Editing Apps
For **iOS/Android**, use GitHub mobile app or Working Copy (iOS):
1. Download **GitHub Mobile App**
2. Navigate to your repository
3. Tap on `leaderboard.html`
4. Tap the **edit icon** (looks like a pencil)
5. Make changes
6. Commit with a message
7. Push changes

---

## Quick Reference Guide

### Common Edits Cheat Sheet

| What to Update | Where to Find It | What to Change |
|----------------|------------------|----------------|
| Team total scores | Team score sections near top | Change number in `<div class="total-score">` |
| Leading team highlight | Team card divs | Add/remove `winning` class |
| Front 9 winner | Inside each matchup | Change class to `won` and update result text |
| Back 9 winner | Inside each matchup | Change class to `won` and update result text |
| Tied nine | Score display | Use class `tied` and text `0.5-0.5` |
| Match winner name | Player name span | Add class `winner` |
| Match status | Match status div | Change text to "PlayerName wins X-Y" |
| In progress | Match status | Text: "On Course" |
| Last updated time | Bottom of page | Change text in "Last updated" div |

### HTML Classes Reference

```html
<!-- Winner styling (gold) -->
<span class="player-name winner">Gavin</span>

<!-- Won nine (solid gold background) -->
<div class="nine-score won">

<!-- Tied nine (dashed border) -->
<div class="nine-score tied">

<!-- Leading team (gold highlight) -->
<div class="team-card winning">
```

---

## Tips for Tournament Day

### Before the Tournament:
1. **Test the leaderboard** - Make sure all player names are correct
2. **Share the link** - Send the URL to all participants
3. **Assign a scorer** - Designate who will update scores (or multiple people)
4. **Bookmark the GitHub editor** - Have the edit page ready on your phone

### During the Tournament:
1. **Update after each nine** - Keep it current for excitement
2. **Use commit messages** - Help track updates: "Updated Foursome 1", "Match 2A complete"
3. **Double-check math** - Verify team totals before committing
4. **Mobile-friendly** - The site works great on phones for spectators

### Suggested Update Schedule:
- **After Front 9:** Update all front 9 scores at turn
- **Final Groups:** Update as they finish back 9
- **Team Totals:** Update whenever a match completes

### Auto-Refresh Option:
The leaderboard includes commented-out auto-refresh code. To enable:
1. Find this section in the JavaScript at bottom:
```javascript
// Auto-refresh functionality (optional)
// Uncomment to enable auto-refresh every 2 minutes
// setInterval(() => {
//     location.reload();
// }, 120000);
```
2. Remove the `//` from the last 3 lines:
```javascript
setInterval(() => {
    location.reload();
}, 120000);
```
3. Page will now auto-refresh every 2 minutes

---

## Troubleshooting

### Changes aren't showing on the live site
- **Wait 60 seconds** - GitHub Pages needs time to rebuild
- **Hard refresh** - Press Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
- **Clear cache** - Try incognito/private browsing mode
- **Check commit** - Make sure you clicked "Push origin" or "Commit changes"

### Formatting looks broken
- **Missing closing tag** - Check you didn't accidentally delete `</div>`
- **Wrong class name** - Make sure classes are spelled exactly: `winner`, `won`, `tied`, `winning`
- **Missing quotes** - All attributes need quotes: `class="player-name"`

### Multiple people editing at once
- **Use commit messages** - Say who's updating what
- **Coordinate updates** - Assign foursomes to different people
- **Pull before editing** - Click "Fetch origin" in GitHub Desktop first

---

## Example: Complete Update Workflow

Let's say Gavin just finished his front 9 and beat Tyler 1-0.

### Step 1: Find the match
Search for "Gavin" in leaderboard.html

### Step 2: Update the winner class
```html
<!-- BEFORE -->
<span class="player-name">Gavin (Brock)</span>

<!-- AFTER -->
<span class="player-name winner">Gavin (Brock)</span>
```

### Step 3: Update the front 9 score
```html
<!-- BEFORE -->
<div class="nine-score">
    <div class="nine-label">Front 9</div>
    <div class="nine-result">-</div>
</div>

<!-- AFTER -->
<div class="nine-score won">
    <div class="nine-label">Front 9</div>
    <div class="nine-result">Gavin 1-0</div>
</div>
```

### Step 4: Update match status
```html
<!-- BEFORE -->
<div class="match-status">Not Started</div>

<!-- AFTER -->
<div class="match-status">Gavin leads 1-0, Back 9 in progress</div>
```

### Step 5: Update Team Brock's total
Add 1 point to Team Brock's score

### Step 6: Save and commit
- **GitHub Web:** Commit with message "Gavin wins Front 9"
- **GitHub Desktop:** Commit → Push

### Step 7: Verify
Check the live site after 60 seconds!

---

## Advanced Features

### Custom Styling
Want to change colors? Edit the CSS at the top of `leaderboard.html`:
- Main green: `#0d3d1f`
- Gold accents: `#d4af37`
- Cream background: `#f5f3e8`

### Add Foursomes
To add more foursomes, copy an entire match-card section and paste it below the last one.

### Tournament Stats
Update the stats at the bottom:
```html
<div class="stat-item">
    <span class="stat-value">4</span>
    <span class="stat-label">Matches Complete</span>
</div>
```
Change the numbers to reflect current status.

---

## Support & Questions

For help with:
- **GitHub Pages issues:** https://docs.github.com/pages
- **HTML editing:** Search "HTML tutorial" on any search engine
- **Tournament scoring questions:** Refer back to index.html format rules

**Remember:** Save often, commit with clear messages, and have fun with it!

---

## Final Checklist

- [ ] All HTML files uploaded to GitHub
- [ ] GitHub Pages enabled in repository settings
- [ ] Website URL shared with participants
- [ ] Scorer assigned for tournament day
- [ ] Test update performed successfully
- [ ] Mobile access confirmed working
- [ ] Bookmark/save edit page for quick access

**You're ready for The Classic 2026!** 🏆⛳
