"""Genera los íconos PNG de la app (se corre una sola vez)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
FONDO, TEXTO = (15, 118, 110), (255, 255, 255)
FUENTE = "C:/Windows/Fonts/arialbd.ttf"


def icono(tam, maskable=False):
    img = Image.new("RGBA", (tam, tam), FONDO if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not maskable:
        d.rounded_rectangle((0, 0, tam - 1, tam - 1), radius=tam * 0.22, fill=FONDO)
    # Las maskable necesitan el dibujo dentro del 80% central
    fuente = ImageFont.truetype(FUENTE, int(tam * (0.5 if maskable else 0.62)))
    d.text((tam / 2, tam / 2), "$", font=fuente, fill=TEXTO, anchor="mm")
    return img


for tam in (192, 512):
    icono(tam).save(RAIZ / "icons" / f"icon-{tam}.png")
icono(512, maskable=True).save(RAIZ / "icons" / "icon-maskable-512.png")
icono(180, maskable=True).save(RAIZ / "icons" / "apple-touch-icon.png")
print("Íconos generados")
