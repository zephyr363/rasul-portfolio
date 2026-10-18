"""Lossless content preservation: resize/re-encode supplied photos, no generative edits."""
from pathlib import Path
from PIL import Image, ImageOps

source = Path.home() / "Downloads"
destination = Path(__file__).resolve().parents[1] / "backend" / "seed_media"
destination.mkdir(parents=True, exist_ok=True)
names = {3884: "headshots", 3885: "tests", 3886: "looks", 3887: "portrait-board",
         3888: "styles", 3889: "smart", 3890: "minimal", 3891: "casual",
         3892: "editorial", 3893: "profile", 3895: "portrait"}
for suffix, name in names.items():
    image = ImageOps.exif_transpose(Image.open(source / f"537982872206987{suffix}.jpg"))
    image.thumbnail((1600, 1600))
    image.convert("RGB").save(destination / f"{name}.webp", "WEBP", quality=88, method=6)
    print(f"{name}: {image.width} x {image.height}")
