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

    def translate_path(self, path):
        """Rena adresser, som cleanUrls i vercel.json.

           Sedan länkarna skrevs om pekar allt på /priser i stället för
           /priser.html. Utan det här svarar utvecklingsservern 404 på
           varenda länk, och lokalt blir sajten omöjlig att gå igenom
           fastän den fungerar i produktion. En server som beter sig
           annorlunda än den riktiga är värre än ingen server alls:
           man felsöker skillnaden i stället för sidan."""
        v = super().translate_path(path)
        if os.path.isdir(v) or os.path.exists(v):
            return v
        if not os.path.splitext(v)[1] and os.path.exists(v + '.html'):
            return v + '.html'
        return v


os.chdir(ROT)
print(f'Nextrum serveras från {ROT} på http://localhost:{PORT}', flush=True)
ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=ROT)).serve_forever()
