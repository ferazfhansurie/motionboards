from pathlib import Path
import zlib

OUT = Path('/Users/faeez/motionboards/aios/outputs/fathopes-energy-meta-ads-report-2026-07-16.pdf')
cmd = []

def esc(s):
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

def text(x, y, value, size=9, font='F1', color=(0.10, 0.14, 0.16)):
    cmd.append(f'{color[0]} {color[1]} {color[2]} rg BT /{font} {size} Tf {x} {y} Td ({esc(value)}) Tj ET')

def rect(x, y, w, h, fill):
    cmd.append(f'{fill[0]} {fill[1]} {fill[2]} rg {x} {y} {w} {h} re f')

def line(x1, y1, x2, y2):
    cmd.append(f'0.82 0.85 0.86 RG 0.7 w {x1} {y1} m {x2} {y2} l S')

rect(0, 0, 595, 842, (0.97, 0.98, 0.97))
rect(0, 780, 595, 62, (0.04, 0.24, 0.23))
text(38, 810, 'FAT HOPES ENERGY', 21, 'F2', (1, 1, 1))
text(38, 791, 'Meta Ads performance report  |  Thursday, 16 July 2026', 9, 'F1', (0.78, 0.94, 0.91))
text(480, 810, 'ONE-PAGER', 8, 'F2', (0.70, 0.90, 0.85))

cards = [('RM70.67', 'Spend'), ('11,212', 'Reach'), ('13,941', 'Impressions'), ('12', 'Leads'), ('RM5.89', 'Cost / lead')]
for i, (value, label) in enumerate(cards):
    x = 38 + i * 105
    rect(x, 714, 97, 48, (0.88, 0.94, 0.91))
    text(x + 8, 740, value, 15, 'F2', (0.04, 0.24, 0.23))
    text(x + 8, 724, label, 7.5, 'F1', (0.25, 0.34, 0.34))

text(38, 685, 'ACCOUNT SNAPSHOT', 9, 'F2', (0.04, 0.24, 0.23))
text(38, 668, 'FatHopes Energy Meta account: “Disable acc”  |  Currency: MYR', 9)
text(38, 652, 'Overall CTR: 4.43%   |   CPM: RM5.07   |   Account-level clicks: 618', 9)

text(38, 615, 'CAMPAIGN BREAKDOWN', 9, 'F2', (0.04, 0.24, 0.23))
rect(38, 589, 519, 21, (0.04, 0.24, 0.23))
for label, x in [('Campaign', 38), ('Spend', 280), ('Reach', 333), ('Clicks', 388), ('CTR', 438), ('Leads', 482), ('CPL', 526)]:
    text(x, 596, label, 7.5, 'F2', (1, 1, 1))

rows = [
    ('RANGER Ads Campaign', 'RM7.53', '740', '80', '10.47%', '0', '—'),
    ('PUSH Ads - Multi Location v2', 'RM25.82', '2,403', '63', '1.71%', '3', 'RM8.61'),
    ('PUSH Ads - Kelantan v2', 'RM18.11', '2,596', '93', '2.40%', '9', 'RM2.01'),
    ('Vendor App Ads - Daftar Peniaga', 'RM19.21', '5,351', '382', '6.80%', '0', '—'),
]
y = 568
for i, row in enumerate(rows):
    if i % 2 == 0:
        rect(38, y - 5, 519, 24, (0.92, 0.95, 0.94))
    text(38, y, row[0], 7.4)
    for value, x in zip(row[1:], [280, 333, 388, 438, 482, 526]):
        text(x, y, value, 7.4)
    y -= 27
line(38, 456, 557, 456)

text(38, 435, 'WHAT MATTERED', 9, 'F2', (0.04, 0.24, 0.23))
bullets = [
    'PUSH Kelantan was the clear winner: 9 of 12 leads at RM2.01 per lead.',
    'PUSH Multi Location generated leads, but CPL was 4.3x higher than Kelantan.',
    'Vendor App delivered the most traffic (382 clicks; 6.80% CTR) but no tracked leads.',
    'RANGER had the highest CTR (10.47%), but only 8 landing-page views — check tracking.',
]
y = 414
for bullet in bullets:
    text(43, y, '•', 10, 'F2', (0.04, 0.50, 0.40))
    text(56, y, bullet, 8.5)
    y -= 22

rect(38, 282, 519, 78, (0.86, 0.94, 0.90))
text(52, 340, 'RECOMMENDED NEXT MOVES', 9, 'F2', (0.04, 0.24, 0.23))
text(52, 321, '1. Maintain or cautiously scale PUSH Kelantan; it produced the lowest-cost leads.', 8.5)
text(52, 304, '2. Review Multi Location targeting and creative before adding budget.', 8.5)
text(52, 287, '3. Keep Vendor App as traffic and verify downstream app/signup tracking.', 8.5)

text(38, 238, 'REPORT NOTES', 9, 'F2', (0.04, 0.24, 0.23))
text(38, 220, 'Data source: Meta Graph API insights, account act_725484841474739.', 8)
text(38, 205, 'Date filter: 2026-07-16 to 2026-07-16. Lead totals use Meta “lead” actions.', 8)
text(38, 190, 'Reach is account-level deduplicated; campaign reach values are not additive.', 8)
text(38, 72, 'Prepared for FatHopes Energy  •  Internal performance summary', 7.5, 'F1', (0.38, 0.44, 0.43))

stream = '\n'.join(cmd).encode()
objects = [
    b'<< /Type /Catalog /Pages 2 0 R >>',
    b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
]
compressed = zlib.compress(stream)
objects.append(b'<< /Length ' + str(len(compressed)).encode() + b' /Filter /FlateDecode >>\nstream\n' + compressed + b'\nendstream')
pdf = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
offsets = [0]
for i, body in enumerate(objects, 1):
    offsets.append(len(pdf))
    pdf += f'{i} 0 obj\n'.encode() + body + b'\nendobj\n'
xref = len(pdf)
pdf += b'xref\n0 7\n0000000000 65535 f \n'
for offset in offsets[1:]:
    pdf += f'{offset:010d} 00000 n \n'.encode()
pdf += f'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(pdf)
print(OUT)
