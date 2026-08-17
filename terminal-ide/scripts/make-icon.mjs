/**
 * Build Windows .ico + PNG icons from resources/icon-source.jpg (or icon.png).
 * Dark Java + Terminal branded logo for Terminal - IDE.
 *
 * Usage: node scripts/make-icon.mjs
 * Requires: Python 3 + Pillow  (pip install pillow)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const resources = path.join(root, 'resources');
const publicDir = path.join(root, 'public');

// Prefer your official logo first (put your file here, then run this script)
const sourceCandidates = [
  path.join(resources, 'official-logo.png'),
  path.join(resources, 'official-logo.jpg'),
  path.join(resources, 'official-logo.jpeg'),
  path.join(resources, 'logo.png'),
  path.join(resources, 'logo.jpg'),
  path.join(resources, 'icon-source.jpg'),
  path.join(resources, 'icon-source.png'),
  path.join(resources, 'icon.png'),
  path.join(resources, 'icon-preview.jpg'),
];

const source = sourceCandidates.find((p) => fs.existsSync(p));
if (!source) {
  console.error(
    'No source image found.\n' +
      '  Put your official logo at:  resources/official-logo.png\n' +
      '  Then run:  node scripts/make-icon.mjs',
  );
  process.exit(1);
}
console.log('Using logo source:', source);

const py = `
from PIL import Image, ImageDraw
import os, sys

src, resources, public = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(resources, exist_ok=True)
os.makedirs(public, exist_ok=True)

from PIL import ImageEnhance
img = Image.open(src).convert("RGBA")
w, h = img.size
side = min(w, h)
left, top = (w - side) // 2, (h - side) // 2
img = img.crop((left, top, left + side, top + side))
master = img.resize((1024, 1024), Image.Resampling.LANCZOS)
# Brighten for dark taskbar / chrome visibility
master = ImageEnhance.Brightness(master).enhance(1.35)
master = ImageEnhance.Contrast(master).enhance(1.2)
master = ImageEnhance.Color(master).enhance(1.15)
lift = Image.new("RGBA", master.size, (70, 90, 120, 40))
master = Image.alpha_composite(master, lift)

def round_corners(im, radius_ratio=0.2):
    size = im.size[0]
    r = int(size * radius_ratio)
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0))
    out.putalpha(mask)
    return out

rounded = round_corners(master)
rounded.save(os.path.join(resources, "icon.png"))
rounded.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(resources, "icon-512.png"))
rounded.resize((256, 256), Image.Resampling.LANCZOS).save(os.path.join(resources, "icon-256.png"))

bg = Image.new("RGBA", master.size, (40, 52, 70, 255))
ico_base = Image.alpha_composite(bg, master)
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
imgs = [ico_base.resize(s, Image.Resampling.LANCZOS) for s in sizes]
imgs[-1].save(os.path.join(resources, "icon.ico"), format="ICO", sizes=sizes, append_images=imgs[:-1])
master.convert("RGB").save(os.path.join(resources, "icon-preview.jpg"), quality=92)

# Vite public copies (used inside the app UI after install)
import shutil
for name in ("icon.png", "icon-256.png", "icon-512.png", "icon.svg"):
    srcp = os.path.join(resources, name)
    if os.path.exists(srcp):
        shutil.copy2(srcp, os.path.join(public, name))
shutil.copy2(os.path.join(resources, "icon.ico"), os.path.join(public, "favicon.ico"))
print("OK: resources/icon.ico + icon.png  and  public/ copies")
print("Re-run:  npm run dist:win   to embed logo in Setup.exe")
`;

const result = spawnSync(
  'python3',
  ['-c', py, source, resources, publicDir],
  { encoding: 'utf8' },
);
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'python failed');
  process.exit(result.status ?? 1);
}
console.log(result.stdout.trim());
