"""Liten statisk server för förhandsgranskning av Nextrum.
   http.server-modulens egen CLI anropar os.getcwd() vid uppstart,
   vilket inte är tillåtet i den här miljön — därför den här filen."""
import os, sys, functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8936

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(ROT)
print(f'Nextrum serveras från {ROT} på http://localhost:{PORT}', flush=True)
ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=ROT)).serve_forever()
