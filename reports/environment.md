# environment snapshot
checked_at_utc: 2026-09-02T03:18:26Z
python: 3.11.15 x86_64
pillow: 12.3.0
numpy: 2.4.6
apngasm: NOT_FOUND
oxipng: NOT_FOUND
pngquant: NOT_FOUND
zopflipng: NOT_FOUND
ffmpeg: NOT_FOUND
zip: /usr/bin/zip
unzip: /usr/bin/unzip
git: /usr/bin/git
python3: /usr/local/bin/python3

## notes
- pillow/numpy: NOT_FOUND at first probe; installed via 'pip install --quiet pillow numpy' (exit 0), then re-probed OK.
- apngasm/oxipng/pngquant/zopflipng: NOT_FOUND -> APNG write falls back to Pillow save_all + self-implemented diff-rect optimisation.
  This substitution must be recorded in reports/compression-audit.csv column 'optimization_pass'.
- ffmpeg: NOT_FOUND -> previews/animated-contact-sheet.gif must be produced with Pillow, not ffmpeg.
- zip/unzip: available -> 'zip -X' submission packaging per section 10 is possible.
