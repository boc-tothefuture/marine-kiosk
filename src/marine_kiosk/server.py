import http.server
import os
from . import __version__

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Find the web/ directory relative to this package script location
        # script: src/tide_clock/server.py -> web_dir: src/../web
        package_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(package_dir))
        web_dir = os.path.join(root_dir, "web")
        super().__init__(*args, directory=web_dir, **kwargs)

    def do_GET(self):
        if self.path in ("/version", "/version/"):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            version_bytes = f"{__version__}\n".encode("utf-8")
            self.send_header("Content-Length", str(len(version_bytes)))
            self.end_headers()
            self.wfile.write(version_bytes)
        else:
            super().do_GET()

def start_server(port):
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", port), Handler) as httpd:
        print(f"Server: Serving Tide Clock dashboard at http://localhost:{port}")
        print("Server: Press Ctrl+C to stop the service.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer: Shutting down.")
