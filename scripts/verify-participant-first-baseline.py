"""Verify approved reference assets before participant-first release. No database access."""
from pathlib import Path
import hashlib
import re
import sys

root = Path(__file__).resolve().parents[1] / 'docs/design-baselines/state-3573/participant-first-v1'
expected = {f'reference-screens/R{i:02}.png' for i in range(1, 11)}
manifest = root / 'SHA256SUMS'
if not manifest.is_file():
    sys.exit('BLOCKED: approved R01–R10 screenshots and SHA256SUMS not yet committed')
seen = set()
for line in manifest.read_text().splitlines():
    match = re.fullmatch(r'([a-f0-9]{64})  (reference-screens/R\d{2}\.png)', line)
    if not match:
        sys.exit(f'Invalid manifest entry: {line}')
    digest, name = match.groups()
    if name not in expected or name in seen:
        sys.exit(f'Unexpected or duplicate reference: {name}')
    seen.add(name)
    path = root / name
    if not path.is_file() or path.is_symlink():
        sys.exit(f'Missing or invalid reference: {name}')
    data = path.read_bytes()
    if not data.startswith(b'\x89PNG\r\n\x1a\n') or hashlib.sha256(data).hexdigest() != digest:
        sys.exit(f'Reference integrity failure: {name}')
if seen != expected:
    sys.exit(f'Missing references: {sorted(expected - seen)}')
print('PASS: all ten reference PNGs match manifest; visual comparison still required')
