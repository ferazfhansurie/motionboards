from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

W, H = 1080, 1350
ROOT = Path("/Users/faeez/motionboards")
ASSETS = ROOT / "FatHopes IMG"
OUT = ASSETS / "push-carousel-identify-collector-v2"
OUT.mkdir(parents=True, exist_ok=True)

CREAM = "#FBF8EF"
INK = "#10261D"
GREEN = "#0B4A2E"
LIME = "#B6DF3D"
TEAL = "#3FB39A"
RED = "#E35C4D"
PAPER = "#EFEBDD"

FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def open_img(path):
    return ImageOps.exif_transpose(Image.open(path)).convert("RGBA")


def crop_cover(im, box_w, box_h, anchor=(0.5, 0.5)):
    src_w, src_h = im.size
    target = box_w / box_h
    current = src_w / src_h
    if current > target:
        crop_w = int(src_h * target)
        left = int((src_w - crop_w) * anchor[0])
        im = im.crop((left, 0, left + crop_w, src_h))
    else:
        crop_h = int(src_w / target)
        top = int((src_h - crop_h) * anchor[1])
        im = im.crop((0, top, src_w, top + crop_h))
    return im.resize((box_w, box_h), Image.Resampling.LANCZOS)


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *size), radius, fill=255)
    return mask


def paste_round(canvas, image, xy, size, radius=34, angle=0, shadow=True):
    im = crop_cover(image, *size)
    if angle:
        im = im.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    pad = 18
    card = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), "white")
    card.putalpha(rounded_mask(card.size, radius + 12))
    card.alpha_composite(im, (pad, pad))
    if shadow:
        sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
        sh.putalpha(rounded_mask(card.size, radius + 12).filter(ImageFilter.GaussianBlur(13)))
        canvas.alpha_composite(sh, (xy[0] + 12, xy[1] + 15))
    canvas.alpha_composite(card, xy)
    return (xy[0] + pad, xy[1] + pad, im.width, im.height)


def text(draw, xy, value, size, fill=INK, bold=False, spacing=4, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=fill, spacing=spacing, anchor=anchor)


def multiline(draw, xy, value, size, fill=INK, bold=False, spacing=8, width=None):
    if not width:
        draw.multiline_text(xy, value, font=font(size, bold), fill=fill, spacing=spacing)
        return
    words, lines, line = value.split(), [], ""
    for word in words:
        trial = (line + " " + word).strip()
        if draw.textbbox((0, 0), trial, font=font(size, bold))[2] <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    draw.multiline_text(xy, "\n".join(lines), font=font(size, bold), fill=fill, spacing=spacing)


def base(slide_number, label="PUSH INVESTIGATION UNIT"):
    canvas = Image.new("RGBA", (W, H), CREAM)
    d = ImageDraw.Draw(canvas)
    d.rectangle((0, 0, W, 22), fill=GREEN)
    d.rectangle((58, 65, 430, 113), fill=LIME)
    text(d, (78, 76), label, 22, INK, True)
    d.line((60, 122, W - 60, 122), fill="#B9B5A9", width=2)
    text(d, (W - 60, 89), f"CASE {slide_number:02d}", 20, GREEN, True, anchor="ra")
    return canvas, d


def stamp(canvas, xy, value, color=RED, size=(375, 74), angle=-4):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((3, 3, size[0] - 4, size[1] - 4), 14, outline=color, width=6)
    text(d, (size[0] / 2, size[1] / 2 + 2), value, 25, color, True, anchor="mm")
    layer = layer.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    canvas.alpha_composite(layer, xy)


def check_badge(canvas, xy, value="VERIFIED"):
    d = ImageDraw.Draw(canvas)
    d.ellipse((xy[0], xy[1], xy[0] + 126, xy[1] + 126), fill=LIME, outline=GREEN, width=4)
    text(d, (xy[0] + 63, xy[1] + 58), "✓", 70, GREEN, True, anchor="mm")
    text(d, (xy[0] + 63, xy[1] + 144), value, 18, GREEN, True, anchor="ma")


def phone(canvas, image, xy, size=(246, 532), title=None):
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((xy[0] - 10, xy[1] - 12, xy[0] + size[0] + 10, xy[1] + size[1] + 14), 36, fill=INK)
    im = crop_cover(image, *size, anchor=(0.5, 0.1))
    im.putalpha(rounded_mask(size, 25))
    canvas.alpha_composite(im, xy)
    if title:
        text(d, (xy[0] + size[0] / 2, xy[1] + size[1] + 43), title, 18, GREEN, True, anchor="ma")


logo = open_img(ASSETS / "poster-refs/LOGO-mark.png")
front = open_img(ASSETS / "drive-download-20260627T093124Z-3-001/PUX09986.JPG")
back = open_img(ASSETS / "drive-download-20260627T093938Z-3-001/PUX08646.JPG")
thief = open_img(ASSETS / "push-carousel-kenal-push-betul-BOARD/thief.jpeg")
login = open_img(ASSETS / "poster-refs/login.jpeg")
home = open_img(ASSETS / "poster-refs/home.jpeg")
qr = open_img(ASSETS / "poster-refs/qr code.jpeg")
tanker = open_img(ASSETS / "push-people/PUX02644.JPG")

# Slide 1 — anonymised CCTV cover
canvas, d = base(1)
text(d, (60, 164), "IDENTIFY A", 66, INK, True)
text(d, (60, 238), "FATHOPES ENERGY", 66, GREEN, True)
text(d, (60, 312), "PUSH COLLECTOR", 66, GREEN, True)
multiline(d, (63, 407), "Before you hand over your used cooking oil, check these signs.", 30, INK, False, 9, 710)
cctv = crop_cover(thief, 920, 535).filter(ImageFilter.GaussianBlur(1.2))
# Anonymise the two visible faces before making the public cover card.
for x, y, bw, bh in [(260, 60, 120, 155), (570, 42, 110, 150)]:
    patch = cctv.crop((x, y, x + bw, y + bh)).filter(ImageFilter.GaussianBlur(32))
    cctv.paste(patch, (x, y))
px, py, pw, ph = paste_round(canvas, cctv, (80, 590), (920, 535), 36, -1)
stamp(canvas, (370, 812), "NOT AN OFFICIAL PUSH COLLECTOR", RED, (560, 78), -4)
text(d, (95, 1167), "CHECK THE UNIFORM. CHECK THE APP.", 27, GREEN, True)
text(d, (95, 1205), "CHECK THE MINI TANKER. CHECK VERIFIED.", 27, GREEN, True)
logo_small = logo.copy(); logo_small.thumbnail((130, 120))
canvas.alpha_composite(logo_small, (890, 1170))
canvas.convert("RGB").save(OUT / "01-identify-push-collector.jpg", quality=95)

# Slide 2 — uniform front
canvas, d = base(2)
text(d, (60, 168), "STEP 1", 32, TEAL, True)
text(d, (60, 216), "UNIFORM", 72, GREEN, True)
multiline(d, (63, 310), "Check for the official FatHopes Energy polo.", 33, INK, False, 9, 730)
# Close crop maintains polo and left-chest logo; the tanker stays as context.
front_crop = front.crop((2400, 300, 4740, 3350))
fx, fy, fw, fh = paste_round(canvas, front_crop, (150, 455), (790, 690), 40, 1)
check_badge(canvas, (110, 1060), "OFFICIAL LOGO")
stamp(canvas, (553, 1086), "LOOK FOR THIS LOGO", TEAL, (365, 70), 3)
text(d, (60, 1225), "A shirt alone is not enough. Keep checking.", 26, INK, False)
canvas.convert("RGB").save(OUT / "02-step-1-uniform-front.jpg", quality=95)

# Slide 3 — uniform back
canvas, d = base(3)
text(d, (60, 168), "STEP 1", 32, TEAL, True)
text(d, (60, 216), "TURN AROUND", 66, GREEN, True)
multiline(d, (63, 307), "The official back print says waste to wealth conversion experts.", 31, INK, False, 9, 790)
back_crop = back.crop((2450, 680, 4200, 3220))
paste_round(canvas, back_crop, (185, 450), (690, 690), 40, -1)
stamp(canvas, (565, 1058), "BACK PRINT CHECK", TEAL, (368, 70), -3)
text(d, (60, 1217), "Logo and wording should be clear and professional.", 26, INK, False)
canvas.convert("RGB").save(OUT / "03-step-1-uniform-back.jpg", quality=95)

# Slide 4 — app
canvas, d = base(4)
text(d, (60, 168), "STEP 2", 32, TEAL, True)
text(d, (60, 216), "VENDOR APP", 68, GREEN, True)
multiline(d, (63, 310), "Every genuine collection is recorded in the FatHopes Vendor App.", 31, INK, False, 9, 820)
phone(canvas, login, (75, 465), (250, 540), "LOG IN")
phone(canvas, home, (415, 420), (250, 540), "HOME")
phone(canvas, qr, (755, 465), (250, 540), "OUTLET QR")
stamp(canvas, (357, 1080), "NO APP = RED FLAG", RED, (375, 74), -2)
text(d, (60, 1225), "Ask to see the transaction inside the app.", 26, INK, False)
canvas.convert("RGB").save(OUT / "04-step-2-vendor-app.jpg", quality=95)

# Slide 5 — mini tanker
canvas, d = base(5)
text(d, (60, 168), "STEP 3", 32, TEAL, True)
text(d, (60, 216), "MINI TANKER", 68, GREEN, True)
multiline(d, (63, 310), "Official PUSH collectors arrive in a FatHopes mini tanker.", 31, INK, False, 9, 810)
paste_round(canvas, tanker, (70, 450), (940, 620), 40, -1)
stamp(canvas, (410, 1012), "NOT A NORMAL VAN OR CAR", RED, (510, 74), 2)
check_badge(canvas, (92, 1084), "FATHOPES")
text(d, (60, 1230), "Look for the branded cab and collection tank.", 26, INK, False)
canvas.convert("RGB").save(OUT / "05-step-3-mini-tanker.jpg", quality=95)

# Slide 6 — verified
canvas, d = base(6)
text(d, (60, 168), "STEP 4", 32, TEAL, True)
text(d, (60, 216), "GET VERIFIED", 65, GREEN, True)
multiline(d, (63, 310), "Not verified in the app? Do not hand over your oil.", 32, INK, False, 9, 790)
phone(canvas, qr, (408, 420), (264, 570), "SCAN / CHECK")
check_badge(canvas, (145, 790), "VERIFIED")
stamp(canvas, (360, 1048), "CHECK FIRST", GREEN, (320, 72), -2)
text(d, (60, 1208), "A proper collection leaves a clear record.", 27, INK, False)
canvas.convert("RGB").save(OUT / "06-step-4-verified.jpg", quality=95)

# Slide 7 — summary / CTA
canvas, d = base(7, "FATHOPES ENERGY")
text(d, (60, 174), "CASE CLOSED.", 66, GREEN, True)
text(d, (60, 250), "CHECK BEFORE", 62, INK, True)
text(d, (60, 320), "YOU COLLECT.", 62, TEAL, True)
items = [
    ("01", "OFFICIAL POLO"),
    ("02", "VENDOR APP"),
    ("03", "MINI TANKER"),
    ("04", "VERIFIED IN APP"),
]
for i, (num, label) in enumerate(items):
    y = 460 + i * 135
    d.rounded_rectangle((65, y, 1000, y + 96), 28, fill="#EAE6D8", outline="#C7C2B4", width=2)
    d.ellipse((84, y + 17, 147, y + 80), fill=LIME)
    text(d, (116, y + 49), num, 23, GREEN, True, anchor="mm")
    text(d, (180, y + 48), label, 31, GREEN, True, anchor="lm")
    text(d, (937, y + 48), "✓", 42, TEAL, True, anchor="mm")
stamp(canvas, (354, 1042), "COLLECT WITH CONFIDENCE", TEAL, (470, 74), -2)
multiline(d, (66, 1167), "If one thing does not match, pause and verify before handing over your used cooking oil.", 27, INK, False, 9, 855)
canvas.convert("RGB").save(OUT / "07-case-closed.jpg", quality=95)

print(f"Created 7 carousel slides in {OUT}")
