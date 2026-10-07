# -*- coding: utf-8 -*-
"""Figurer till övningsbladen: små SVG:er som ritas in under en uppgift.

En uppgift är (text, extra) eller (text, extra, figur), där figuren är en
sträng härifrån. Alla mått är pixlar på bladet (1240 px brett), och
färgerna är bladens egna. Siffrorna i en figur ska stå i uppgiftens
text också: figuren visar, texten säger, och en figur som motsäger
texten är ett fel i bladet, inte i figuren.
"""
import html, math, re

SVART, BRUN, LJUS, SAND = '#2E2A20', '#9C4520', '#EFE6D6', '#C9B492'
TYP = "font-family:'Schibsted Grotesk',system-ui,sans-serif"


def _svg(b, h, inre):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
            'style="display:block;margin-top:10px;%s">%s</svg>' % (b, h, b, h, TYP, inre))


def _t(x, y, s, storlek=20, ankare='middle', farg=SVART, vikt=600):
    s = str(s)
    if re.match(r'^-\d', s):
        s = '\u2212' + s[1:]   # bladens text har riktigt minustecken, så figurerna också
    return ('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="%s" fill="%s" font-weight="%d">%s</text>'
            % (x, y, storlek, ankare, farg, vikt, html.escape(str(s))))


def klocka(timme, minut, mal=170, visare=True):
    """Analog klocka med tolv siffror. Visarna ritas med rätt vinkel, eller utelämnas (visare=False)."""
    c = mal
    r = mal - 14
    d = ['<circle cx="%d" cy="%d" r="%d" fill="#fff" stroke="%s" stroke-width="4"/>' % (c, c, r, SVART)]
    for i in range(60):
        v = math.radians(i * 6)
        l = 14 if i % 5 == 0 else 6
        x1, y1 = c + (r - l) * math.sin(v), c - (r - l) * math.cos(v)
        x2, y2 = c + r * math.sin(v), c - r * math.cos(v)
        d.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%d"/>'
                 % (x1, y1, x2, y2, SVART, 3 if i % 5 == 0 else 1.5))
    stl = max(14, int(r * 0.24))
    for n in range(1, 13):
        v = math.radians(n * 30)
        d.append(_t(c + (r * 0.70) * math.sin(v), c - (r * 0.70) * math.cos(v) + stl * 0.36, n, stl, vikt=700))
    if visare:
        vm = math.radians(minut * 6)
        vt = math.radians((timme % 12) * 30 + minut * 0.5)
        d.append('<line x1="%d" y1="%d" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="9" stroke-linecap="round"/>'
                 % (c, c, c + (r * 0.50) * math.sin(vt), c - (r * 0.50) * math.cos(vt), SVART))
        d.append('<line x1="%d" y1="%d" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="5" stroke-linecap="round"/>'
                 % (c, c, c + (r * 0.78) * math.sin(vm), c - (r * 0.78) * math.cos(vm), BRUN))
    d.append('<circle cx="%d" cy="%d" r="8" fill="%s"/>' % (c, c, SVART))
    return _svg(2 * c, 2 * c, ''.join(d))


def flera(*figurer, mellanrum=36):
    """Flera figurer bredvid varandra (varje är en _svg-sträng)."""
    return ('<div style="display:flex;gap:%dpx;align-items:flex-start;flex-wrap:wrap">%s</div>'
            % (mellanrum, ''.join(figurer).replace('margin-top:10px;', '')))


def klockor(*tider, mal=92, skrivfalt=True):
    """Rad med flera klockor. En tid är (timme, minut), eller None för en tom urtavla.
    skrivfalt=True lägger en skrivrad under varje klocka (för 'vad är klockan?')."""
    delar = []
    for t in tider:
        k = klocka(t[0], t[1], mal) if t else klocka(0, 0, mal, visare=False)
        under = ('<div style="margin-top:6px;border-bottom:2px solid %s;height:26px;width:%dpx"></div>' % (SVART, 2 * mal)
                 if skrivfalt else '')
        delar.append('<div style="text-align:center">%s%s</div>' % (k.replace('margin-top:10px;', ''), under))
    return '<div style="display:flex;gap:34px;margin-top:12px;flex-wrap:wrap">%s</div>' % ''.join(delar)


def rektangel(bredd_text, hojd_text, b=330, h=150, ruta=False):
    """Rektangel med sidornas längd utskrivna (text, t.ex. '8 cm' eller '?')."""
    x0, y0 = 70, 24
    d = ['<rect x="%d" y="%d" width="%d" height="%d" fill="%s" stroke="%s" stroke-width="3"/>'
         % (x0, y0, b, h, LJUS, SVART)]
    if ruta:
        for i in range(1, int(b // 30) + 1):
            d.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (x0 + 30 * i, y0, x0 + 30 * i, y0 + h, SAND))
        for j in range(1, int(h // 30) + 1):
            d.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (x0, y0 + 30 * j, x0 + b, y0 + 30 * j, SAND))
    d.append(_t(x0 + b / 2, y0 + h + 30, bredd_text, 22))
    d.append(_t(x0 - 12, y0 + h / 2 + 8, hojd_text, 22, 'end'))
    return _svg(x0 + b + 30, y0 + h + 44, ''.join(d))


def _punkt(p, q, t):
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def triangel(a, b, c, sida_a='', sida_b='', sida_c='', vinklar=('', '', ''), hojd=170, rattvinkel=None):
    """Triangel med hörnen A (vänster), B (höger) och C (topp). Sidorna är a (mitt emot A) osv.
    a, b, c är de riktiga längderna och bara proportionerna används. vinklar = text vid A, B, C.
    rattvinkel = 'A', 'B' eller 'C' markerar en rät vinkel med en liten ruta."""
    # lägg c längs basen: A=(0,0), B=(c,0), C ur a och b
    x = (b * b + c * c - a * a) / (2.0 * c)
    y = math.sqrt(max(b * b - x * x, 0.0001))
    skala = hojd / y if y * 1.0 > 0 else 1
    if c * skala > 560:
        skala = 560.0 / c
    ox, oy = 90, hojd + 40
    A = (ox, oy)
    B = (ox + c * skala, oy)
    C = (ox + x * skala, oy - y * skala)
    d = ['<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/>'
         % (A[0], A[1], B[0], B[1], C[0], C[1], LJUS, SVART)]
    def mitt(p, q, s, ut):
        mx, my = (p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0
        dx, dy = q[0] - p[0], q[1] - p[1]
        n = math.hypot(dx, dy)
        nx, ny = -dy / n, dx / n
        # normalen ska peka bort från triangelns mitt
        cx, cy = (A[0] + B[0] + C[0]) / 3.0, (A[1] + B[1] + C[1]) / 3.0
        if (mx + nx - cx) ** 2 + (my + ny - cy) ** 2 < (mx - cx) ** 2 + (my - cy) ** 2:
            nx, ny = -nx, -ny
        return _t(mx + nx * ut, my + ny * ut + 7, s, 22, 'middle')
    if sida_c: d.append(mitt(A, B, sida_c, 26))
    if sida_a: d.append(mitt(B, C, sida_a, 34))
    if sida_b: d.append(mitt(A, C, sida_b, 34))
    # vinkeltexten ligger inne i triangeln, längs vinkelhalveringslinjen, så att den inte krockar med sidorna
    for (p, q, r, v) in ((A, B, C, vinklar[0]), (B, C, A, vinklar[1]), (C, A, B, vinklar[2])):
        if not v:
            continue
        def e(u, w):
            n = math.hypot(w[0] - u[0], w[1] - u[1])
            return ((w[0] - u[0]) / n, (w[1] - u[1]) / n)
        e1, e2 = e(p, q), e(p, r)
        bx, by = e1[0] + e2[0], e1[1] + e2[1]
        n = math.hypot(bx, by)
        avstand = 70 if len(v) > 4 else 54
        d.append(_t(p[0] + bx / n * avstand, p[1] + by / n * avstand + 7, v, 20, 'middle', BRUN, 700))
    if rattvinkel:
        P = {'A': (A, B, C), 'B': (B, C, A), 'C': (C, A, B)}[rattvinkel]
        h, p, q = P
        def enhet(u, v):
            n = math.hypot(v[0] - u[0], v[1] - u[1])
            return ((v[0] - u[0]) / n, (v[1] - u[1]) / n)
        e1, e2 = enhet(h, p), enhet(h, q)
        s = 22
        p1 = (h[0] + e1[0] * s, h[1] + e1[1] * s)
        p2 = (h[0] + (e1[0] + e2[0]) * s, h[1] + (e1[1] + e2[1]) * s)
        p3 = (h[0] + e2[0] * s, h[1] + e2[1] * s)
        d.append('<polyline points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="none" stroke="%s" stroke-width="2.5"/>'
                 % (p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], SVART))
    return _svg(int(B[0] + 120), hojd + 80, ''.join(d))


def stapeldiagram(data, maxv, steg, enhet='', hojd=250, bredd=620, tomt_varden=False):
    """Stapeldiagram. data = [(etikett, värde)], maxv = högsta värdet på y-axeln, steg = avstånd mellan streck.
    tomt_varden=True ritar staplarna men skriver inte ut värdena."""
    vx, ty, by = 66, 38, 38 + hojd
    d = []
    n = int(maxv // steg)
    for i in range(n + 1):
        v = i * steg
        y = by - hojd * v / maxv
        d.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-width="%s"/>'
                 % (vx, y, vx + bredd, y, SVART if i == 0 else SAND, 2.5 if i == 0 else 1))
        d.append(_t(vx - 10, y + 7, v, 18, 'end', vikt=500))
    d.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="2.5"/>' % (vx, ty, vx, by, SVART))
    k = len(data)
    bredd_stapel = min(70.0, bredd / k * 0.6)
    for i, (namn, v) in enumerate(data):
        cx = vx + bredd * (i + 0.5) / k
        hh = hojd * v / maxv
        d.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" stroke="%s" stroke-width="2"/>'
                 % (cx - bredd_stapel / 2, by - hh, bredd_stapel, hh, SAND, SVART))
        if not tomt_varden:
            d.append(_t(cx, by - hh - 8, v, 17, vikt=700))
        d.append(_t(cx, by + 26, namn, 18, vikt=500))
    if enhet:
        d.append(_t(vx - 56, ty - 22, enhet, 16, 'start', '#665C49', 500))
    return _svg(vx + bredd + 20, by + 44, ''.join(d))


def koordinatsystem(xmin, xmax, ymin, ymax, punkter=(), enhet=34, linje=None, namn_axlar=True):
    """Koordinatsystem med rutnät. punkter = [(x, y, 'A')]. linje = ((x1,y1),(x2,y2)) ritar en sträcka."""
    b = (xmax - xmin) * enhet
    h = (ymax - ymin) * enhet
    ox, oy = 40, 30
    def px(x): return ox + (x - xmin) * enhet
    def py(y): return oy + (ymax - y) * enhet
    d = []
    for x in range(xmin, xmax + 1):
        d.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="1"/>' % (px(x), oy, px(x), oy + h, SAND))
    for y in range(ymin, ymax + 1):
        d.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-width="1"/>' % (ox, py(y), ox + b, py(y), SAND))
    d.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="2.5"/>' % (px(0), oy - 8, px(0), oy + h + 8, SVART))
    d.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-width="2.5"/>' % (ox - 8, py(0), ox + b + 8, py(0), SVART))
    for x in range(xmin, xmax + 1):
        if x != 0 and (x % 1 == 0) and (xmax - xmin <= 14 or x % 2 == 0):
            d.append(_t(px(x), py(0) + 22, x, 15, vikt=500))
    for y in range(ymin, ymax + 1):
        if y != 0 and (ymax - ymin <= 14 or y % 2 == 0):
            d.append(_t(px(0) - 8, py(y) + 5, y, 15, 'end', vikt=500))
    if namn_axlar:
        d.append(_t(ox + b + 22, py(0) + 6, 'x', 20, 'start', vikt=700))
        d.append(_t(px(0) + 10, oy - 12, 'y', 20, 'start', vikt=700))
    if linje:
        (x1, y1), (x2, y2) = linje
        d.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="3.5"/>' % (px(x1), py(y1), px(x2), py(y2), BRUN))
    for (x, y, n) in punkter:
        d.append('<circle cx="%.1f" cy="%.1f" r="6" fill="%s"/>' % (px(x), py(y), BRUN))
        if n:
            # under axeln hamnar bokstaven under punkten, så att den inte krockar med axelns siffror
            d.append(_t(px(x) + 10, py(y) + (24 if y < 0 else -10), n, 19, 'start', BRUN, 700))
    return _svg(int(ox + b + 50), int(oy + h + 40), ''.join(d))


def tallinje(a, b, markerade=(), steg=1, delar=1, bredd=900, etiketter=True):
    """Tallinje från a till b. Varje helt tal får ett långt streck, delar > 1 ger delstreck.
    markerade = [(värde, 'A')] ritar en prick med bokstav."""
    x0, x1, y = 40, 40 + bredd, 56
    d = ['<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>' % (x0 - 16, y, x1 + 16, y, SVART)]
    def px(v): return x0 + (v - a) * bredd / float(b - a)
    n = int(round((b - a) * delar))
    for i in range(n + 1):
        v = a + i / float(delar)
        hel = (i % delar == 0)
        d.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="%d"/>'
                 % (px(v), y - (14 if hel else 8), px(v), y + (14 if hel else 8), SVART, 3 if hel else 2))
        if hel and etiketter and (int(v) - a) % steg == 0:
            d.append(_t(px(v), y + 40, int(v), 20, vikt=600))
    for (v, namn) in markerade:
        d.append('<circle cx="%.1f" cy="%d" r="8" fill="%s"/>' % (px(v), y, BRUN))
        d.append(_t(px(v), y - 22, namn, 22, 'middle', BRUN, 800))
    return _svg(bredd + 80, 100, ''.join(d))


def brakrutor(delar, farg, per_rad=None, ruta=64):
    """Rad med lika stora rutor där 'farg' av 'delar' är ifyllda (bråk som del av en helhet)."""
    per = per_rad or delar
    rader = int(math.ceil(delar / float(per)))
    d = []
    for i in range(delar):
        x, y = 8 + (i % per) * (ruta + 6), 8 + (i // per) * (ruta + 6)
        d.append('<rect x="%d" y="%d" width="%d" height="%d" rx="6" fill="%s" stroke="%s" stroke-width="3"/>'
                 % (x, y, ruta, ruta, BRUN if i < farg else '#fff', SVART))
    return _svg(16 + per * (ruta + 6), 16 + rader * (ruta + 6), ''.join(d))


def cirkel_delad(delar, farg, mal=70):
    """Cirkel delad i lika stora delar där 'farg' är ifyllda."""
    c = mal
    r = mal - 6
    d = []
    for i in range(delar):
        a0 = -math.pi / 2 + 2 * math.pi * i / delar
        a1 = -math.pi / 2 + 2 * math.pi * (i + 1) / delar
        x0, y0 = c + r * math.cos(a0), c + r * math.sin(a0)
        x1, y1 = c + r * math.cos(a1), c + r * math.sin(a1)
        stor = 1 if (a1 - a0) > math.pi else 0
        if delar == 1:
            d.append('<circle cx="%d" cy="%d" r="%d" fill="%s" stroke="%s" stroke-width="3"/>' % (c, c, r, BRUN if farg else '#fff', SVART))
        else:
            d.append('<path d="M%d,%d L%.1f,%.1f A%d,%d 0 %d 1 %.1f,%.1f Z" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"/>'
                     % (c, c, x0, y0, r, r, stor, x1, y1, BRUN if i < farg else '#fff', SVART))
    return _svg(2 * c, 2 * c, ''.join(d))


def prickar(n, rader=1, storlek=15, mellan=9):
    """n prickar, utspridda på 'rader' rader."""
    per = int(math.ceil(n / float(rader)))
    d = []
    for i in range(n):
        d.append('<circle cx="%d" cy="%d" r="%d" fill="%s"/>'
                 % (storlek + (i % per) * (2 * storlek + mellan), storlek + (i // per) * (2 * storlek + mellan), storlek, BRUN))
    return _svg(2 * storlek + per * (2 * storlek + mellan), rader * (2 * storlek + mellan) + 4, ''.join(d))


def vinkel(grader, langd=170, namn=''):
    """Vinkel i grader ritad som två strålar från samma punkt. Bilden anpassas efter vinkeln, så att
    också en trubbig vinkel ryms: den andra strålen pekar då åt vänster om spetsen."""
    v = math.radians(grader)
    ox = 30 + max(0.0, -langd * math.cos(v))
    oy = 20 + langd * max(math.sin(v), 0.25)
    x2, y2 = ox + langd * math.cos(v), oy - langd * math.sin(v)
    d = ['<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="4" stroke-linecap="round"/>' % (ox, oy, ox + langd, oy, SVART),
         '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="4" stroke-linecap="round"/>' % (ox, oy, x2, y2, SVART),
         '<path d="M%.1f,%.1f A40,40 0 0 0 %.1f,%.1f" fill="none" stroke="%s" stroke-width="3"/>'
         % (ox + 40, oy, ox + 40 * math.cos(v), oy - 40 * math.sin(v), BRUN)]
    if namn:
        d.append(_t(ox + 64 * math.cos(v / 2), oy - 64 * math.sin(v / 2) + 7, namn, 22, 'middle', BRUN, 800))
    return _svg(int(ox + langd + 20), int(oy + 24), ''.join(d))


def tabell(rubriker, rader, bredd_kol=150, tom_efter=None):
    """Enkel tabell som HTML (ingen SVG). Tom cell: '' ritas som ett fält att fylla i."""
    th = ''.join('<th style="border:2px solid %s;background:%s;padding:7px 14px;font-size:20px;min-width:%dpx">%s</th>'
                 % (SVART, LJUS, bredd_kol, html.escape(str(r))) for r in rubriker)
    tr = ''
    for rad in rader:
        tr += '<tr>' + ''.join('<td style="border:2px solid %s;padding:7px 14px;font-size:20px;height:44px;text-align:center">%s</td>'
                               % (SVART, html.escape(str(c))) for c in rad) + '</tr>'
    return ('<table style="border-collapse:collapse;margin-top:10px"><tr>%s</tr>%s</table>' % (th, tr))


def kompassros(givna=('N',), storlek=130):
    """Kompassros med fyra armar. Väderstrecken i 'givna' (N, Ö, S, V) skrivs ut, de andra blir tomma rutor."""
    c = storlek + 30
    d = ['<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-width="2.5"/>' % (c, c, storlek - 30, SAND)]
    for (namn, dx, dy) in (('N', 0, -1), ('Ö', 1, 0), ('S', 0, 1), ('V', -1, 0)):
        x1, y1 = c + dx * 18, c + dy * 18
        x2, y2 = c + dx * (storlek - 36), c + dy * (storlek - 36)
        d.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="5" stroke-linecap="round"/>' % (x1, y1, x2, y2, SVART))
        tx, ty = c + dx * (storlek + 4), c + dy * (storlek + 4)
        if namn in givna:
            d.append(_t(tx, ty + 9, namn, 28, vikt=800))
        else:
            d.append('<rect x="%d" y="%d" width="64" height="40" rx="6" fill="#fff" stroke="%s" stroke-width="2.5"/>'
                     % (tx - 32, ty - 20, SVART))
    d.append('<circle cx="%d" cy="%d" r="8" fill="%s"/>' % (c, c, BRUN))
    return _svg(2 * c + 20, 2 * c + 20, ''.join(d))


def stickfigurer(*antal, sida=50):
    """Mönster av tändstickor: figur n är en rad med antal[n-1] kvadrater som delar sidor.
    Varje sticka ritas för sig, så att det går att räkna dem på bladet."""
    delar = []
    for nr, k in enumerate(antal, 1):
        b = k * sida + 24
        d = []
        def sticka(x1, y1, x2, y2):
            d.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#A07A45" stroke-width="6" stroke-linecap="round"/>'
                     % (x1, y1, x2, y2))
            d.append('<circle cx="%.1f" cy="%.1f" r="5.5" fill="%s"/>' % (x2, y2, BRUN))
        x0, y0, g = 12, 12, 5
        for i in range(k):
            x = x0 + i * sida
            sticka(x + g, y0, x + sida - g, y0)                  # överkant
            sticka(x + g, y0 + sida, x + sida - g, y0 + sida)    # underkant
        for i in range(k + 1):
            x = x0 + i * sida
            sticka(x, y0 + g, x, y0 + sida - g)                  # lodräta
        d.append(_t(b / 2.0, y0 + sida + 30, 'Figur %d' % nr, 18, vikt=600))
        delar.append(_svg(int(b), int(y0 + sida + 40), ''.join(d)).replace('margin-top:10px;', ''))
    return '<div style="display:flex;gap:44px;align-items:flex-end;margin-top:10px">%s</div>' % ''.join(delar)
