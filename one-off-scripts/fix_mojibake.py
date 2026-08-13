# One-off script: repair double-encoded UTF-8 (mojibake) in source files.
# Symbols like "⌘", "…", "•" were saved as UTF-8, re-read as Latin-1, and
# re-saved as UTF-8 — producing sequences like "â¦". Reversal: encode the
# corrupted run back to Latin-1 bytes, then decode those bytes as UTF-8.
import re
import sys
import unicodedata

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()

# Mojibake only ever produces chars in U+0080-U+00FF (Latin-1 view of UTF-8
# bytes). Genuine symbols (e.g. a real "↑") are > U+00FF and stay untouched.
run_re = re.compile("[\\u0080-\\u00ff]+")

fixed_count = 0
failed = []

def repair(m):
    global fixed_count
    s = m.group(0)
    try:
        out = s.encode("latin-1").decode("utf-8")
        fixed_count += 1
        return out
    except UnicodeDecodeError:
        failed.append(repr(s))
        return s

new_text = run_re.sub(repair, text)

with open(path, "w", encoding="utf-8") as f:
    f.write(new_text)

print(f"{path}: repaired {fixed_count} runs")
if failed:
    print("UNFIXED (left as-is):")
    for s in sorted(set(failed)):
        print("  ", s)

leftover = sorted({c for c in new_text if 0x80 <= ord(c) <= 0xFF})
if leftover:
    print("Remaining U+0080-U+00FF chars:", [f"U+{ord(c):04X} {unicodedata.name(c, '?')}" for c in leftover])
