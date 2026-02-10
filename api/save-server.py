#!/usr/bin/env python3
"""
Tiny save API for The Classic 2026.
Accepts POST /save with JSON { password, data }.
Validates password, writes data.json, commits & pushes to GitHub.
Also proxies weather API requests to hide the API key.
"""

import json
import os
import subprocess
import urllib.request
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler

ADMIN_PASSWORD_HASH = "5a40d95d61e29d6665ff382de6e0b0cc6a3bbb546aeececa59911e08d597587b"
OPENWEATHER_API_KEY = "69fa01a6d893ca9129d2f9314d521289"
REPO_DIR = "/root/projects/swclassic"
WEB_DIR = "/var/www/theclassicgolf.org"
DATA_FILE = "data.json"


class SaveHandler(BaseHTTPRequestHandler):
    def run_git(self, args):
        return subprocess.run(
            args,
            cwd=REPO_DIR,
            check=True,
            capture_output=True,
            text=True
        )

    def do_POST(self):
        if self.path != "/save":
            self.send_error(404)
            return

        # Read body
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.respond(400, {"error": "Invalid JSON"})
            return

        password = payload.get("password", "")
        data = payload.get("data")

        # Accept either the hash directly (new clients) or the plaintext password (older admin.js).
        ok = password == ADMIN_PASSWORD_HASH
        if not ok:
            try:
                ok = hashlib.sha256(password.encode("utf-8")).hexdigest() == ADMIN_PASSWORD_HASH
            except Exception:
                ok = False
        if not ok:
            self.respond(401, {"error": "Invalid password"})
            return

        if not data or not isinstance(data, dict):
            self.respond(400, {"error": "No valid data provided"})
            return

        # Optimistic locking: check lastUpdated matches current file
        expected_ts = payload.get("expectedLastUpdated")
        if expected_ts:
            try:
                current_path = os.path.join(REPO_DIR, DATA_FILE)
                with open(current_path, "r") as f:
                    current_data = json.load(f)
                current_ts = current_data.get("meta", {}).get("lastUpdated")
                if current_ts and current_ts != expected_ts:
                    self.respond(409, {"error": "Data was modified by another user. Reload and try again."})
                    return
            except Exception:
                pass  # If we can't read, allow the save

        # Write data.json to both locations
        content = json.dumps(data, indent=2)
        try:
            for directory in [REPO_DIR, WEB_DIR]:
                path = os.path.join(directory, DATA_FILE)
                with open(path, "w") as f:
                    f.write(content)
                    f.write("\n")

            # Git commit and push (if needed)
            self.run_git(["git", "add", DATA_FILE])
            status = self.run_git(["git", "status", "--porcelain", "--", DATA_FILE]).stdout.strip()
            if not status:
                self.respond(200, {"success": True})
                return

            try:
                self.run_git(["git", "commit", "-m", "Update tournament data"])
            except subprocess.CalledProcessError as e:
                combined = (e.stdout or "") + (e.stderr or "")
                if "nothing to commit" in combined:
                    self.respond(200, {"success": True})
                    return
                raise

            # Push the commit that was just created, regardless of which branch is checked out.
            self.run_git(["git", "push", "origin", "HEAD:Main"])

            self.respond(200, {"success": True})

        except subprocess.CalledProcessError as e:
            combined = ""
            try:
                combined = (e.stdout or "") + (e.stderr or "")
            except Exception:
                combined = str(e)
            combined = combined.strip()
            if "nothing to commit" in combined:
                self.respond(200, {"success": True})
            else:
                self.respond(500, {"error": f"Git error: {combined}"})

        except Exception as e:
            self.respond(500, {"error": str(e)})

    def do_GET(self):
        if self.path != "/weather":
            self.send_error(404)
            return

        try:
            url = (
                f"https://api.openweathermap.org/data/2.5/weather"
                f"?q=Lafayette,LA,US&units=imperial&appid={OPENWEATHER_API_KEY}"
            )
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                weather_data = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "https://theclassicgolf.org")
            self.end_headers()
            self.wfile.write(weather_data)
        except Exception as e:
            self.respond(502, {"error": f"Weather API error: {str(e)}"})

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "https://theclassicgolf.org")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def respond(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "https://theclassicgolf.org")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def log_message(self, fmt, *args):
        """Quiet logging."""
        pass


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 3001), SaveHandler)
    print("Save API running on 127.0.0.1:3001")
    server.serve_forever()
