import http.server
import socketserver
import os

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Find the web/ directory relative to this package script location
        # script: src/tide_clock/server.py -> web_dir: src/../web
        package_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(package_dir))
        web_dir = os.path.join(root_dir, "web")
        super().__init__(*args, directory=web_dir, **kwargs)

def start_server(port):
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"Server: Serving Tide Clock dashboard at http://localhost:{port}")
        print("Server: Press Ctrl+C to stop the service.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer: Shutting down.")
