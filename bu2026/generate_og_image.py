#!/usr/bin/env python3
"""Gera capa estática para prévias do WhatsApp, Facebook e outras redes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1200, 630
TARGET = Path(__file__).resolve().parent / "preview-whatsapp.jpg"
REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(size, bold=False):
    source = BOLD if bold else REGULAR
    try:
        return ImageFont.truetype(source, size=size)
    except OSError:
        return ImageFont.load_default()

img = Image.new("RGB", (WIDTH, HEIGHT), "#0b0f14")
draw = ImageDraw.Draw(img)

# Fundo escuro com gradiente e elementos geométricos da marca DW Tech.
for y in range(HEIGHT):
    t = y / HEIGHT
    draw.line((0, y, WIDTH, y), fill=(int(9 + 10*t), int(12 + 15*t), int(17 + 22*t)))
draw.polygon([(775, 0), (1200, 0), (1200, 630), (1060, 630)], fill="#151e28")
draw.polygon([(1075, 0), (1200, 0), (1200, 630), (1170, 630)], fill="#25303b")
draw.polygon([(1130, 0), (1190, 0), (930, 630), (870, 630)], fill="#f36a18")
draw.polygon([(1190, 0), (1200, 0), (940, 630), (930, 630)], fill="#fba65b")
draw.rectangle((0, 0, WIDTH, 10), fill="#ff650d")
draw.rectangle((0, 619, WIDTH, 630), fill="#ff650d")

# Logomarca tipográfica, título e descrição legíveis mesmo em miniaturas.
draw.text((72, 54), "DW", font=font(66, True), fill="#ffffff", stroke_width=0)
draw.text((190, 69), "Tech", font=font(45, True), fill="#ff741d")
draw.text((73, 149), "BOLETIM DE URNA 2026  /  PAINEL ELEITORAL", font=font(18, True), fill="#b7c1cb")
draw.rounded_rectangle((68, 218, 356, 266), radius=15, fill="#f06b1c")
draw.text((89, 226), "ELEIÇÕES 2026", font=font(23, True), fill="#ffffff")

draw.text((65, 303), "2º TURNO", font=font(88, True), fill="#ffffff")
draw.text((68, 409), "PRESIDENCIAL", font=font(59, True), fill="#ffffff")
draw.rounded_rectangle((70, 505, 640, 510), radius=2, fill="#ff741d")
draw.text((70, 528), "APURAÇÃO OFICIAL • TSE", font=font(26, True), fill="#ffae7b")
draw.text((70, 578), "BRASIL  •  MARANHÃO  •  MUNICÍPIOS", font=font(17, True), fill="#c6cbd2")

# Elemento visual secundário com a data do segundo turno.
draw.rounded_rectangle((901, 176, 1126, 422), radius=22, fill="#111821", outline="#4d5b66", width=3)
draw.text((934, 198), "25", font=font(96, True), fill="#ffffff")
draw.text((955, 318), "OUT", font=font(43, True), fill="#ff9852")
draw.text((971, 377), "2026", font=font(27, True), fill="#c3cbd5")
img.save(TARGET, "JPEG", quality=83, optimize=True, subsampling=0)
size = TARGET.stat().st_size
if size > 300_000:
    img.save(TARGET, "JPEG", quality=74, optimize=True, subsampling=2)
print(f"Prévia: {TARGET} | {WIDTH} x {HEIGHT} | {TARGET.stat().st_size} bytes")
