#!/usr/bin/env python3
"""Stub pyn-server for the image smoke test. /readyz answers 503 while /tmp/unready exists, else 200; /healthz answers 200;
everything else answers 404. Every reply names the stub in X-Stub."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        path = self.path.split("?")[0]
        status = 200 if path == "/healthz" else 404
        if path == "/readyz":
            status = 503 if os.path.exists("/tmp/unready") else 200
        body = json.dumps({"path": path, "stub": True}).encode()
        self.send_response(status)
        self.send_header("X-Stub", "1")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
