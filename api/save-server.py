#!/usr/bin/env python3
"""
Tiny save API for The Classic 2026.
Accepts POST /save with JSON { password, data }.
Validates password, writes data.json, commits & pushes to GitHub.
"""

import json
import os
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

ADMIN_PASSWORD = "classic2026"
REPO_DIR = "/root/projects/swclassic"
WEB_DIR = "/var/www/theclassicgolf.org"
DATA_FILE = "data.json"


class SaveHandler(BaseHTTPRequestHandler):
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

        if password != ADMIN_PASSWORD:
            self.respond(401, {"error": "Invalid password"})
            return

        if not data or not isinstance(data, dict):
            self.respond(400, {"error": "No valid data provided"})
            return

        # Write data.json to both locations
        content = json.dumps(data, indent=2)
        try:
            for directory in [REPO_DIR, WEB_DIR]:
                path = os.path.join(directory, DATA_FILE)
                with open(path, "w") as f:
                    f.write(content)
                    f.write("\n")

            # Git commit and push
            subprocess.run(
                ["git", "add", DATA_FILE],
                cwd=REPO_DIR, check=True, capture_output=True
            )
            subprocess.run(
                ["git", "commit", "-m", "Update tournament data"],
                cwd=REPO_DIR, check=True, capture_output=True
            )
            subprocess.run(
                ["git", "push", "origin", "Main"],
                cwd=REPO_DIR, check=True, capture_output=True
            )

            self.respond(200, {"success": True})

        except subprocess.CalledProcessError as e:
            # Commit may fail if no changes — that's OK
            stderr = e.stderr.decode() if e.stderr else ""
            if "nothing to commit" in stderr:
                self.respond(200, {"success": True})
            else:
                self.respond(500, {"error": f"Git error: {stderr}"})

        except Exception as e:
            self.respond(500, {"error": str(e)})

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "https://theclassicgolf.org")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
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
