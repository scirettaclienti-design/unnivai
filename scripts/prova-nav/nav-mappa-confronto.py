#!/usr/bin/env python3
"""NAV-MAPPA — confronto prima/dopo delle misure del nav-audit sugli stessi stati, e la schermata affiancata al canvas (schermata 1).
   python3 scripts/prova-nav/nav-mappa-confronto.py   (prima = tag 1000, dopo = tag p1000, entrambi sul sito pubblicato)"""
import json
from PIL import Image, ImageDraw, ImageFont
D = 'docs/prove/dati/2026-10-28-nav-audit-%s.json'
prima, dopo = json.load(open(D % '1000')), json.load(open(D % 'p1000'))
def riga(j, nome):
    v = j['stati'].get(nome)
    if not v: return None
    cop = [x['copertura'] for x in v]
    return dict(n=len(v), cmin=min(cop), cmax=max(cop),
                tasti=len({(p['nome'], p['w'], p['h']) for x in v for p in x.get('piccoli', [])}),
                tagl=len({(p['nome'], p['motivi']) for x in v for p in x.get('tagliati', [])}),
                sov=len({(p['a'], p['b']) for x in v for p in x.get('sovr', [])}))
print('| Stato | Mappa coperta prima | Mappa visibile prima | Coperta dopo | **Visibile dopo** | Tasti <44 prima→dopo | Testi tagliati prima→dopo | Sovrapposizioni prima→dopo |')
print('|---|---|---|---|---|---|---|---|')
for n in dict.fromkeys(list(prima['stati']) + list(dopo['stati'])):
    a, b = riga(prima, n), riga(dopo, n)
    if not a or not b: continue
    print(f"| {n} | {a['cmin']}–{a['cmax']} % | {round(100-a['cmax'],1)}–{round(100-a['cmin'],1)} % | {b['cmin']}–{b['cmax']} % | **{round(100-b['cmax'],1)}–{round(100-b['cmin'],1)} %** | {a['tasti']}→{b['tasti']} | {a['tagl']}→{b['tagl']} | {a['sov']}→{b['sov']} |")
# affiancato: canvas (ritaglio dalla resa già in repo) | prima | dopo | dopo senza avviso
P = 'docs/prove/schermate/nav-audit/'
def trova(j, nome, i=0): return P + j['stati'][nome][i]['file']
canvas = Image.open('docs/prove/schermate/nav-camera/affiancato-1-cammino.png').convert('RGB').crop((48, 48, 828, 1735))
pan = [('Canvas — schermata 1', canvas), ('Prima (sito, 28/10): copre ~67 %', Image.open(trova(prima, '4 cammino')).convert('RGB')),
       ('Dopo: cammino con avviso GPS', Image.open(trova(dopo, '4 cammino')).convert('RGB')), ('Dopo: svolta a 50 m', Image.open(trova(dopo, '5 svolta a 50 m')).convert('RGB'))]
H = 844
pan = [(t, im.resize((int(im.width * H / im.height), H))) for t, im in pan]
W = sum(im.width for _, im in pan) + 20 * (len(pan) + 1)
out = Image.new('RGB', (W, H + 80), (16, 15, 14)); d = ImageDraw.Draw(out); f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
x = 20
for t, im in pan:
    out.paste(im, (x, 20)); d.text((x, H + 32), t, fill=(240, 236, 230), font=f); x += im.width + 20
out.save('docs/prove/schermate/nav-audit/affiancato-canvas-1-prima-dopo.jpg', quality=84)
