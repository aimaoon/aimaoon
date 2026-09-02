#!/usr/bin/env python3
"""§13 progress.json と §14 manifest.json を実ファイルから生成する。

  python3 scripts/make_progress.py

推測で「完了済み」と書かない。存在しないファイルは present=false / NOT_RUN として出す。
再開時はこの sha256 と実ファイルを照合し、一致しないものは未完了として扱う（§13）。
"""
import datetime
import hashlib
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# §14 が求める最終成果物の一覧
DELIVERABLES = [
    "LINE_READY.zip",
    "previews/first-frames-180.png",
    "previews/first-frames-32.png",
    "previews/animated-contact-sheet.gif",
    "design-brief.md",
    "style-lock.json",
    "emoji-plan.json",
    "store-listing-text.md",
    "reports/environment.md",
    "reports/asset-pipeline.md",
    "reports/spec-snapshot.md",
    "reports/scale-audit.csv",
    "reports/design-quality-audit.csv",
    "reports/pose-manifest.csv",
    "reports/motion-audit.csv",
    "reports/anchor-config.json",
    "reports/jitter/jitter-audit.csv",
    "reports/identity-audit.csv",
    "reports/uniqueness-matrix.csv",
    "reports/collision-report.md",
    "reports/compression-audit.csv",
    "reports/apng-audit.json",
    "reports/submission-zip-audit.json",
    "reports/validator-selftest.txt",
    "reports/review-guideline-check.md",
    "reports/progress.json",
    "reports/manifest.json",
]
# 本制作で追加した補助成果物
EXTRA = [
    "character-master.png",
    "reports/asset-order.md",
    "reports/design-implementation-gates.md",
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def entry(rel):
    p = os.path.join(ROOT, rel)
    if not os.path.isfile(p):
        return {"path": rel, "present": False, "bytes": None, "sha256": None}
    return {"path": rel, "present": True, "bytes": os.path.getsize(p), "sha256": sha256(p)}


def main():
    with open(os.path.join(ROOT, "emoji-plan.json"), encoding="utf-8") as f:
        plan = json.load(f)
    numbers = [i["number"] for i in plan["items"]]

    # 検査結果があれば読む
    audit = {}
    ap = os.path.join(ROOT, "reports", "apng-audit.json")
    if os.path.isfile(ap):
        with open(ap, encoding="utf-8") as f:
            audit = {i["number"]: i["result"] for i in json.load(f).get("items", [])}

    # ポーズ承認の状況
    approved_poses = {}
    pm = os.path.join(ROOT, "reports", "pose-manifest.csv")
    if os.path.isfile(pm):
        import csv
        with open(pm, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                approved_poses.setdefault(r["number"], []).append(r["approval"])

    # ZIP の中身
    packaged = set()
    zp = os.path.join(ROOT, "LINE_READY.zip")
    if os.path.isfile(zp):
        try:
            with zipfile.ZipFile(zp) as z:
                packaged = {os.path.basename(n)[:3] for n in z.namelist()
                            if os.path.basename(n).endswith(".png")}
        except zipfile.BadZipFile:
            packaged = set()

    items = {}
    for n in numbers:
        first = os.path.join(ROOT, "OUTPUT", "first_frames", f"{n}.png")
        final = os.path.join(ROOT, "OUTPUT", "final", f"{n}.png")
        poses_dir = os.path.join(ROOT, "poses", n)
        n_poses = (len([x for x in os.listdir(poses_dir) if x.lower().endswith(".png")])
                   if os.path.isdir(poses_dir) else 0)
        appr = approved_poses.get(n, [])
        items[n] = {
            "planned": True,
            "first_frame_approved": os.path.isfile(first),
            "poses_present": n_poses,
            "poses_approved": bool(appr) and all(a == "approved" for a in appr),
            "animated": os.path.isfile(final),
            "validated": audit.get(n, "NOT_RUN"),
            "packaged": n in packaged,
            "final_path": os.path.relpath(final, ROOT) if os.path.isfile(final) else None,
            "sha256": sha256(final) if os.path.isfile(final) else None,
            "bytes": os.path.getsize(final) if os.path.isfile(final) else None,
        }

    master = os.path.join(ROOT, "character-master.png")
    progress = {
        "updated_at": datetime.datetime.now(datetime.timezone.utc)
                              .strftime("%Y-%m-%dT%H:%M:%SZ"),
        "spec_verified": False,
        "spec_verified_note": "creator.line.me is EGRESS_BLOCKED; see reports/spec-snapshot.md",
        "asset_pipeline_mode": "D",
        "character_master_approved": os.path.isfile(master),
        "submission_files_determined": False,
        "submission_files_note": "§2-2 undetermined; main.png / tab.png not decided",
        "counts": {
            "planned": len(numbers),
            "first_frames": sum(1 for v in items.values() if v["first_frame_approved"]),
            "animated": sum(1 for v in items.values() if v["animated"]),
            "validated_pass": sum(1 for v in items.values() if v["validated"] == "PASS"),
            "packaged": sum(1 for v in items.values() if v["packaged"]),
        },
        "items": items,
    }
    with open(os.path.join(ROOT, "reports", "progress.json"), "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    manifest = {
        "generated_at": progress["updated_at"],
        "note": "§14 の最終成果物の存在確認。present=false は未生成であり、完成扱いにしない。",
        "required": [entry(p) for p in DELIVERABLES],
        "additional": [entry(p) for p in EXTRA],
    }
    present = sum(1 for e in manifest["required"] if e["present"])
    manifest["summary"] = {"required_total": len(DELIVERABLES), "required_present": present,
                           "required_missing": len(DELIVERABLES) - present}
    with open(os.path.join(ROOT, "reports", "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"progress.json: mode={progress['asset_pipeline_mode']} "
          f"master_approved={progress['character_master_approved']}")
    print("  " + " ".join(f"{k}={v}" for k, v in progress["counts"].items()))
    print(f"manifest.json: required {present}/{len(DELIVERABLES)} present")
    for e in manifest["required"]:
        if not e["present"]:
            print(f"  missing: {e['path']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
