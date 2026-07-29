#!/usr/bin/env python3
"""marketing/*.md を Notion インポート向けに整形し、投稿カレンダーCSVを生成する。"""
import csv
import pathlib
import re

SRC = pathlib.Path("/home/user/aimaoon/marketing")
PAGES = SRC / "notion" / "pages"
DBS = SRC / "notion" / "databases"

# ---------- 1. ページ整形：相対リンクを平文の参照に変換 ----------
# [00_収益設計.md](./00_収益設計.md) -> **「00_収益設計」ページ**
LINK = re.compile(r"\[([^\]]+?)\.md\]\(\./[^)]+?\.md\)")
# [05](./05_コンテンツ設計.md) のようにラベルが .md で終わらない形式も拾う
LINK2 = re.compile(r"\[([^\]]+?)\]\(\./([^)]+?)\.md\)")


def to_ref(m):
    return f"「{m.group(1)}」ページ"


def to_ref2(m):
    return f"「{m.group(2)}」ページ"


converted = []
for md in sorted(SRC.glob("*.md")):
    text = md.read_text(encoding="utf-8")
    n = len(LINK.findall(text)) + len(LINK2.findall(text))
    new = LINK2.sub(to_ref2, LINK.sub(to_ref, text))
    (PAGES / md.name).write_text(new, encoding="utf-8")
    converted.append((md.name, n))

print("=== ページ整形 ===")
for name, n in converted:
    print(f"  {name}: リンク{n}件を平文化")

# ---------- 2. 投稿カレンダー90 CSV ----------
posts_md = (SRC / "11_Threads初月90投稿.md").read_text(encoding="utf-8")

HEAD = re.compile(r"^### D(\d+)-(朝|昼|夜)\s*｜(.+?)$", re.M)
TIME = {"朝": "07:00", "昼": "12:00", "夜": "21:00"}
CATS = ["共感", "ノウハウ", "プロセス", "日常", "導線"]

rows = []
matches = list(HEAD.finditer(posts_md))
for i, m in enumerate(matches):
    day, slot, meta = int(m.group(1)), m.group(2), m.group(3).strip()

    cat = next((c for c in CATS if c in meta), "")

    hook = ""
    hm = re.search(r"書き出し:(\S+)", meta)
    if hm:
        hook = hm.group(1).split("※")[0].strip()

    note = ""
    nm = re.search(r"※(.+)$", meta)
    if nm:
        note = nm.group(1).strip()

    # 見出し直後の最初のコードブロックが本文
    tail = posts_md[m.end(): matches[i + 1].start() if i + 1 < len(matches) else len(posts_md)]
    bm = re.search(r"```\n(.*?)\n```", tail, re.S)
    body = bm.group(1).strip() if bm else ""

    rows.append({
        "投稿ID": f"D{day:02d}-{slot}",
        "日": day,
        "時間帯": slot,
        "投稿時刻": TIME[slot],
        "分類": cat,
        "書き出し型": hook,
        "本文": body,
        "状態": "未着手",
        "インプレッション": "",
        "いいね": "",
        "リプライ": "",
        "メモ": note,
    })

assert len(rows) == 90, f"投稿数が90ではありません: {len(rows)}"

with (DBS / "db_投稿カレンダー90.csv").open("w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), quoting=csv.QUOTE_ALL)
    w.writeheader()
    w.writerows(rows)

print("\n=== 投稿カレンダーCSV ===")
print(f"  {len(rows)}行を出力")
from collections import Counter
for cat, n in Counter(r["分類"] for r in rows).most_common():
    print(f"  {cat}: {n}本")
empty = [r["投稿ID"] for r in rows if not r["本文"]]
print(f"  本文が空の行: {empty if empty else 'なし'}")
