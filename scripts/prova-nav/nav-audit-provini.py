#!/usr/bin/env python3
"""NAV-AUDIT — i provini: un fotogramma ogni 2 s del video, un foglio (contact sheet) per ogni minuto, con l'istante su ogni riquadro.
   python3 scripts/prova-nav/nav-audit-provini.py docs/prove/video/nav-audit-1000.webm 1000
   Esce in docs/prove/video/provini/<tag>-minuto-NN.jpg (10 colonne x 3 righe = 30 riquadri = 60 s)."""
import subprocess, sys, tempfile, os, glob
from PIL import Image, ImageDraw, ImageFont
video, tag = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(video), 'provini'); os.makedirs(out, exist_ok=True)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', 'fps=1/2,scale=140:-1', os.path.join(tmp, 'f%04d.png')], check=True)
    frames = sorted(glob.glob(os.path.join(tmp, 'f*.png')))
    for m in range(0, (len(frames) + 29) // 30):
        gruppo = frames[m * 30:(m + 1) * 30]
        w, h = Image.open(gruppo[0]).size
        foglio = Image.new('RGB', (10 * w, 3 * (h + 16)), (24, 24, 24))
        d = ImageDraw.Draw(foglio)
        for i, f in enumerate(gruppo):
            t = (m * 30 + i) * 2
            x, y = (i % 10) * w, (i // 10) * (h + 16)
            foglio.paste(Image.open(f).convert('RGB'), (x, y + 16))
            d.text((x + 3, y + 1), f'{t // 60}:{t % 60:02d}', fill=(250, 140, 40), font=font)
        foglio.save(os.path.join(out, f'{tag}-minuto-{m + 1:02d}.jpg'), quality=78)
print(f'{len(frames)} fotogrammi, {(len(frames) + 29) // 30} fogli in {out}')
