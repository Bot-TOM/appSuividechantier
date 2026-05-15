"""
Script de floutage des zones sensibles des screenshots pour la landing page.
"""
from PIL import Image, ImageFilter, ImageDraw
import shutil, os

SRC = r"C:\Users\tomro\OneDrive\Bureau\ScreensLanding"
DST = r"C:\Users\tomro\OneDrive\Bureau\APPsuivichantier\public"

FILES = {
    "image-1778852354493.png": "screen-planning.png",
    "image-1778852389340.png": "screen-profil.png",
    "image-1778852403008.png": "screen-rapport.png",
    "image-1778852412956.png": "screen-etapes.png",
    "image-1778852420710.png": "screen-dashboard.png",
}

def blur_region(img, box, radius=25):
    """Floute une région rectangulaire (left, top, right, bottom)."""
    region = img.crop(box)
    for _ in range(10):
        region = region.filter(ImageFilter.GaussianBlur(radius))
    img.paste(region, box[:2])
    return img

def solid_region(img, box, color=(220, 220, 220)):
    """Couvre une région par un rectangle solide."""
    draw = ImageDraw.Draw(img)
    draw.rectangle(box, fill=color)
    return img

def process(src_name, dst_name, regions):
    src_path = os.path.join(SRC, src_name)
    dst_path = os.path.join(DST, dst_name)
    img = Image.open(src_path).convert("RGB")
    w, h = img.size
    print(f"{dst_name} - {w}x{h}px")
    for box in regions:
        # box en proportions (left%, top%, right%, bottom%)
        left   = int(box[0] * w)
        top    = int(box[1] * h)
        right  = int(box[2] * w)
        bottom = int(box[3] * h)
        img = blur_region(img, (left, top, right, bottom))
    img.save(dst_path, quality=95)
    print(f"  OK : {dst_path}")

# ── Planning desktop ──────────────────────────────────────────────────────────
# Zones : "ROMAND tom / Admin" (haut droite) + ligne des noms des techs
process("image-1778852354493.png", "screen-planning.png", [
    (0.67, 0.00, 0.86, 0.08),   # "ROMAND tom / Admin"
    (0.19, 0.41, 0.97, 0.50),   # avatars (photos) + noms techniciens
])

# ── Profil mobile ─────────────────────────────────────────────────────────────
# Pas de nom/email visible — pas de floutage nécessaire
shutil.copy(os.path.join(SRC, "image-1778852389340.png"),
            os.path.join(DST, "screen-profil.png"))
print("screen-profil.png - copie tel quel")

# ── Rapport mobile ────────────────────────────────────────────────────────────
# Zones : header client ("Jean Dupont / 12 Rue des acacias") + auteur "Tom ROMAND"
src_path = os.path.join(SRC, "image-1778852403008.png")
dst_path = os.path.join(DST, "screen-rapport.png")
img = Image.open(src_path).convert("RGB")
w, h = img.size
print(f"screen-rapport.png - {w}x{h}px")
# header flou (client name + adresse + progress bar)
img = blur_region(img, (int(0.00*w), int(0.00*h), int(1.00*w), int(0.20*h)))
# "Tom ROMAND + date" en rectangle solide
img = solid_region(img, (int(0.00*w), int(0.24*h), int(1.00*w), int(0.31*h)), color=(235, 235, 235))
img.save(dst_path, quality=95)
print(f"  OK : {dst_path}")

# ── Étapes mobile ─────────────────────────────────────────────────────────────
# Zones : header client ("Jean Dupont / 12 Rue des acacias")
process("image-1778852412956.png", "screen-etapes.png", [
    (0.06, 0.03, 0.90, 0.16),   # "Jean Dupont" + "Dupont" grand + adresse
])

# ── Dashboard mobile ──────────────────────────────────────────────────────────
# Pas de donnée sensible - copie directe
shutil.copy(os.path.join(SRC, "image-1778852420710.png"),
            os.path.join(DST, "screen-dashboard.png"))
print("screen-dashboard.png - copie tel quel")

print("\nTous les screens traites et copies dans public/")
