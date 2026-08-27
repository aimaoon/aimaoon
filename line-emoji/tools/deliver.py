# -*- coding: utf-8 -*-
"""Previews, plan/lock JSON, manifest and the submission ZIP."""
import hashlib
import json
import os
import zipfile
import numpy as np
from PIL import Image, ImageDraw

import rig
import anim
import measure
import render
import preview
import apnginfo
import build as B
from rig import P

ROOT, OUT, PREVIEWS, REPORTS = B.ROOT, B.OUT, B.PREVIEWS, B.REPORTS


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for c in iter(lambda: f.read(65536), b''):
            h.update(c)
    return h.hexdigest()


def main():
    items = B.ITEMS
    all_frames, all_durs = [], []
    for it in items:
        fr, tl = anim.render_frames(it)
        all_frames.append([B.clean_rgb(f) for f in fr])
        all_durs.append(anim.durations(it['beat']))

    firsts = [f[0] for f in all_frames]

    # ---- previews ---------------------------------------------------------
    def labelled(images, cell, cols=8, bg=(252, 252, 254)):
        rows = (len(images) + cols - 1) // cols
        pad, lab = 8, 16
        s = Image.new('RGB', (cols * (cell + pad) + pad,
                              rows * (cell + pad + lab) + pad), bg)
        d = ImageDraw.Draw(s)
        for i, im in enumerate(images):
            x = pad + (i % cols) * (cell + pad)
            y = pad + (i // cols) * (cell + pad + lab)
            s.paste(render.flatten_on(im.resize((cell, cell), Image.LANCZOS), bg + (255,)),
                    (x, y))
            d.text((x + 2, y + cell + 3), '%03d %s' % (items[i]['n'], items[i]['en'][:16]),
                   fill=(96, 96, 110))
        return s

    labelled(firsts, 180).save(os.path.join(PREVIEWS, 'first-frames-180.png'))

    cell, cols, pad = 32, 10, 14
    rows = (len(firsts) + cols - 1) // cols
    s32 = Image.new('RGB', (cols * (cell + pad) + pad, rows * (cell + pad + 12) + pad),
                    (255, 255, 255))
    d = ImageDraw.Draw(s32)
    for i, im in enumerate(firsts):
        x = pad + (i % cols) * (cell + pad)
        y = pad + (i // cols) * (cell + pad + 12)
        s32.paste(render.flatten_on(im.resize((cell, cell), Image.LANCZOS)), (x, y))
        d.text((x + 4, y + cell + 1), '%02d' % items[i]['n'], fill=(120, 120, 132))
    s32.save(os.path.join(PREVIEWS, 'first-frames-32.png'))

    # animated contact sheet: every emoji playing at once
    cell, cols, pad = 88, 8, 6
    rows = (40 + cols - 1) // cols
    W = cols * (cell + pad) + pad
    H = rows * (cell + pad) + pad
    sheet = []
    for k in range(anim.FRAMES):
        s = Image.new('RGB', (W, H), (255, 255, 255))
        for i in range(40):
            x = pad + (i % cols) * (cell + pad)
            y = pad + (i // cols) * (cell + pad)
            s.paste(render.flatten_on(all_frames[i][k].resize((cell, cell), Image.LANCZOS)),
                    (x, y))
        sheet.append(s.convert('P', palette=Image.ADAPTIVE, colors=128))
    mean = [int(round(sum(d[k] for d in all_durs) / 40.0)) for k in range(anim.FRAMES)]
    sheet[0].save(os.path.join(PREVIEWS, 'animated-contact-sheet.gif'), save_all=True,
                  append_images=sheet[1:], duration=mean, loop=0, optimize=True)

    # per-emoji pose strips
    strips = os.path.join(PREVIEWS, 'pose-strips')
    os.makedirs(strips, exist_ok=True)
    for it, fr in zip(items, all_frames):
        preview.strip(it, size=90, frames=fr).save(
            os.path.join(strips, '%03d.png' % it['n']))

    # ---- style lock -------------------------------------------------------
    mb = measure.bbox(measure.core_only(P()))
    lm = measure.head_landmarks(P())
    lock = {
        'project_name': 'お眼鏡の女子 / Megane-no-Ko',
        'target_audience': 'メガネをかけている10〜30代の女性を中心に、日常のLINE会話で使う人',
        'use_cases': ['挨拶と返事', '感謝とお願い', 'ほめる・喜ぶ', '困った・謝る',
                      '文末に添える記号'],
        'character_or_motif': '大きな丸メガネのボブヘアの女の子',
        'one_sentence_product_concept':
            '厚手のビニールシールから抜いたような白フチのボディに、顔いっぱいの丸メガネが乗った女の子',
        'silhouette': '2.6頭身。頭が幅88px・高さ90pxの丸みのある塊で、'
                      'キャラクター左のジョーの毛先だけが外へ跳ねる非対称シルエット',
        'proportions': {'head_height_ratio': 0.63, 'body_height_ratio': 0.37,
                        'head_width_px': 88, 'shoulder_span_px': 42},
        'face_rules': '顔は幅66px・高さ62pxの楕円。目・鼻・口は下半分に寄せず、'
                      'レンズ内に目を置いて口はレンズ下7pxに置く',
        'eye_rules': 'レンズ中心に置く。基本は半径3.7pxの点目。'
                     'dot / big / happy / closed / sleepy / squeeze / sad / sparkle / '
                     'x / swirl / flat の11種のみ使用',
        'mouth_rules': 'smile / grin / w / o / open / shout / flat / frown / wave / '
                       'pout の10種のみ使用。線幅1.9〜2.3px',
        'line_color': '#3E3550',
        'line_width_rule': '本体輪郭1.7px固定。メガネのフレームのみ3.0pxで最も太い',
        'base_colors': ['#3E3550 (すみれ墨: 線・髪・フレーム・靴)',
                        '#F7CDBE (アプリコットミルク: 肌・エフェクト塗り)'],
        'effect_colors': ['#F7CDBE (ハート・星・炎・記号の塗り)',
                          '#FFF3EC (レンズ・涙・汗の水)'],
        'shading_rule': '陰影は使わない。面はベタ塗り1段のみ',
        'highlight_rule': '髪の左上に白40/255の三日月グロス1つ、レンズ左上に白の閃光線1本のみ',
        'shadow_rule': '落ち影を描かない（容量とちらつきを避けるため）',
        'gloss_rule': 'プニプニシールの艶は白フチ＋三日月グロスの2要素だけで表現する',
        'depth_rule': '重なり順のみで奥行きを出す。ぼかしや半透明グローは使わない',
        'layer_rule': 'back_hair → 後ろ腕 → 脚 → 胴 → 頭(顔→前髪→メガネ→顔パーツ) '
                      '→ 前腕 → 小物 → エフェクト',
        'material_concept': '厚手のビニール製プニプニシール',
        'texture_rule': 'テクスチャを持たない。素材感は白フチの太さと角の丸みで出す',
        'text_language': 'キャラクター32個は文字なし。記号8個のみ OK! / !? / ? / zzz を使う',
        'forbidden_changes': [
            '丸メガネを外す・形を変える', '髪型をボブ以外にする',
            'キャラクター左のジョーの跳ね毛をなくす', '白いヘアピンを外す',
            '2色＋白以外の色を足す', '輪郭線を太くする・二重にする',
            '陰影やグラデーションを足す', '白フチ（ダイカット）をなくす'],
        'copyright_safety_notes':
            '既存キャラクター・ロゴ・ブランド・実在人物・特定作家の絵柄を参照していない。'
            'すべての形状は本リポジトリの tools/rig.py と tools/fx.py のベクター定義から生成',
        'visual_hooks': [
            '顔幅いっぱい（左右のレンズ外径が顔の幅と一致）の丸メガネ',
            'ダイカットシールの白フチ2.6pxと髪の三日月グロス',
            'キャラクター左のジョーだけ外へ跳ねた非対称ボブ',
            '前髪のキャラクター右側に留めた白いスナップピン2本'],
        'deformable_parts': ['両腕', '両脚', '上半身の前傾と反り', '腰の沈み',
                             'スカートの開き', '肩の上下', '頭の傾きと上下'],
        'signature_effect_style':
            'すべてのエフェクトと記号は、本体と同じ1.7pxのすみれ墨の線＋アプリコットミルクの塗り'
            '＋2.6pxの白フチで描く。水（涙・汗）だけ塗りを#FFF3ECにする',
        'scale_lock': {
            'target_character_width_px': mb[2] - mb[0],
            'target_character_height_px': mb[3] - mb[1],
            'target_center_x_px': round((mb[0] + mb[2]) / 2.0, 1),
            'target_baseline_y_px': mb[3],
            'target_face_width_px': round(
                ((lm['lens_r'][0] - lm['lens_l'][0]) + 2 * rig.LENS_R), 1),
            'target_outline_width_px': rig.LW,
            'tolerance': {'width_pct': 5, 'height_pct': 5, 'center_px': 4,
                          'baseline_px': 3, 'face_width_pct': 5, 'outline_pct': 10},
            'measurement_note':
                '本体サイズは腕を除いた頭・胴・脚のコア外接矩形で測る。'
                '腕を伸ばした姿勢は外接矩形が広がるがキャラクターの見かけの大きさは変わらないため。'
                'お辞儀・跳躍・走行など姿勢が変わる項目は公式ガイドの方針に従い顔幅と線幅を優先判定にする',
        },
        'symbol_style_lock': {
            'line_color': '#3E3550', 'line_width_px': rig.LW,
            'glyph_core_width_px': 5.4, 'fill': '#F7CDBE', 'water_fill': '#FFF3EC',
            'corner_radius_px': 2.0, 'die_cut_border_px': rig.BORDER_PX,
            'highlight': '白の閃光線のみ', 'shadow': 'なし',
            'optical_center': [90, 92], 'safe_area_px': 8,
        },
    }
    with open(os.path.join(ROOT, 'style-lock.json'), 'w', encoding='utf-8') as f:
        json.dump(lock, f, ensure_ascii=False, indent=2)

    # ---- emoji plan -------------------------------------------------------
    plan = []
    for it, fr, du in zip(items, all_frames, all_durs):
        tl = None
        if it['poses'] is not None:
            tl = anim.timeline(it['poses'], it['stops'], it['eases'])
        margins = [measure.safe_margins(f) for f in fr]
        entry = {
            'number': it['n'], 'file': '%03d.png' % it['n'], 'group': it['group'],
            'meaning_ja': it['ja'], 'meaning_en': it['en'],
            'conversation_intent': it['intent'],
            'first_frame_emotion_cues': it['first_frame'],
            'primary_action_test': it['peak_frame'],
            'moving_parts': it['moving'], 'fixed_parts': it['fixed'],
            'motion_family': it['motion_family'], 'spatial_path': it['spatial_path'],
            'tempo_class': it['tempo'], 'beat_pattern': it['beat_pattern'],
            'loop_return_type': it['loop_return'],
            'composition_type': it['composition'], 'body_deformation': it['deform'],
            'emotion_intensity': it['intensity'], 'dominant_visual_element': it['hook'],
            'horizontal_anchor': it['h_anchor'],
            'allow_horizontal_travel': bool(it['travel']),
            'allow_stage_exit': bool(it['exitable']),
            'whole_sprite_only_motion': False,
            'frames': anim.FRAMES, 'cycle_ms': anim.CYCLE_MS, 'loop_count': 1,
            'frame_durations_ms': du,
            'peak_hold_ms': (sum(du[it['stops'][3]:it['stops'][3] + 2])
                             if it['stops'] else sum(du[10:12])),
            'safe_area_px': min(min(m) for m in margins if m),
            'target_bytes': B.TARGET_BYTES, 'hard_limit_bytes': B.HARD_LIMIT,
            'bytes': os.path.getsize(os.path.join(OUT, '%03d.png' % it['n'])),
            'fixed_region_byte_identity': True, 'full_frame_redraw': False,
        }
        if tl is not None:
            entry['keyframe_storyboard'] = [
                {'pose': ['P1-first', 'P2-anticipation', 'P3-transit', 'P4-peak',
                          'P5-recoil', 'P6-return'][k],
                 'frame': it['stops'][k],
                 'file': 'poses/%03d/%s.png' % (it['n'],
                                                B.POSE_ROLES[k])}
                for k in range(6)]
            entry['anchor_points'] = {
                'feet': [90, rig.FOOT_Y], 'hip': list(rig.HIP),
                'neck': [90, 116], 'shoulder_L': list(rig.SHOULDER[0]),
                'shoulder_R': list(rig.SHOULDER[1]),
                'head_pivot': [rig.HEAD_C[0], rig.HEAD_C[1] + rig.NECK_L[1]]}
            entry['character_identity_landmarks'] = {
                k: [round(v[0], 1), round(v[1], 1)]
                for k, v in measure.head_landmarks(tl[0]).items()}
            entry['target_character_bbox'] = list(measure.bbox(measure.core_only(tl[0])))
            entry['major_part_displacement_px'] = {
                k: round(v, 1) for k, v in measure.part_displacements(tl).items()}
        plan.append(entry)
    with open(os.path.join(ROOT, 'emoji-plan.json'), 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'generated': '2026-08-27', 'items': plan},
                  f, ensure_ascii=False, indent=2)

    # ---- ZIP --------------------------------------------------------------
    zpath = os.path.join(ROOT, 'LINE_READY.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in range(1, 41):
            z.write(os.path.join(OUT, '%03d.png' % n), '%03d.png' % n)

    # ---- manifest ---------------------------------------------------------
    files = []
    for n in range(1, 41):
        p = os.path.join(OUT, '%03d.png' % n)
        info = apnginfo.summary(p)
        files.append({'name': '%03d.png' % n, 'bytes': info['bytes'],
                      'width': info['w'], 'height': info['h'],
                      'colour_type': info['colour'], 'bit_depth': info['bitdepth'],
                      'frames': info['n_fctl'], 'total_ms': info['total_ms'],
                      'num_plays': info['num_plays'],
                      'ancillary_text_chunks': info['meta'],
                      'sha256': sha(p)})
    man = {
        'project': 'お眼鏡の女子 / Megane-no-Ko LINE animated emoji',
        'generated': '2026-08-27',
        'submission_zip': {'name': 'LINE_READY.zip', 'bytes': os.path.getsize(zpath),
                           'entries': 40, 'sha256': sha(zpath),
                           'flat': True, 'hidden_files': 0},
        'spec_used': {'size_px': 180, 'format': 'APNG', 'colour': 'RGBA 8bit',
                      'frames_per_emoji': 20, 'cycle_ms': 4000, 'loop_count': 1,
                      'per_file_target_bytes': B.TARGET_BYTES,
                      'per_file_hard_limit_bytes': B.HARD_LIMIT},
        'totals': {'max_file_bytes': max(f['bytes'] for f in files),
                   'sum_bytes': sum(f['bytes'] for f in files)},
        'files': files,
        'reports': sorted(os.path.relpath(os.path.join(dp, fn), ROOT)
                          for dp, _, fns in os.walk(REPORTS) for fn in fns),
        'previews': sorted(os.path.relpath(os.path.join(dp, fn), ROOT)
                           for dp, _, fns in os.walk(PREVIEWS) for fn in fns),
        'source_of_truth': ['tools/rig.py', 'tools/fx.py', 'tools/items_a.py',
                            'tools/items_b.py', 'tools/items_c.py', 'tools/items_d.py'],
    }
    with open(os.path.join(REPORTS, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
    print('zip %d bytes, max file %d bytes, sum %d bytes'
          % (man['submission_zip']['bytes'], man['totals']['max_file_bytes'],
             man['totals']['sum_bytes']))


if __name__ == '__main__':
    main()
