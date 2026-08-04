from collections import deque
from pathlib import Path
from PIL import Image
import sys

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
image = Image.open(src).convert("RGBA")
pix = image.load()
w, h = image.size

def is_background(x, y):
    r, g, b, _ = pix[x, y]
    black = r < 24 and g < 24 and b < 24
    magenta = r > 130 and b > 100 and g < 130 and (r - g) > 70 and (b - g) > 45
    return black or magenta

queue = deque()
seen = bytearray(w * h)
for x in range(w):
    for y in (0, h - 1):
        if is_background(x, y):
            queue.append((x, y)); seen[y * w + x] = 1
for y in range(h):
    for x in (0, w - 1):
        if is_background(x, y) and not seen[y * w + x]:
            queue.append((x, y)); seen[y * w + x] = 1

while queue:
    x, y = queue.popleft()
    r, g, b, _ = pix[x, y]
    pix[x, y] = (r, g, b, 0)
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_background(nx, ny):
            seen[ny * w + nx] = 1
            queue.append((nx, ny))

image.save(dst)
