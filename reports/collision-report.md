# collision report

本ファイルは `python3 scripts/check_plan_gates.py` の出力である。手書きの数値は含まない。

## §7 機械検査

```
motion-key duplicates: NONE
```

```
variation-key duplicates: NONE
```

変動キーは motion_family / spatial_path / tempo_class / beat_pattern / peak_hold_ms / loop_return_type の6項目の組み合わせ。

## 類似候補ごとの差分軸数（最低3軸が必要）

01-32 は §7 の列挙（構図・表情・目・口・手・体勢・身体変形・エフェクト・感情強度）を
そのまま軸に使う。33-40 は顔・手・体勢を持たないため、同じ「最低3軸の差」を
記号の属性（第1フレームのシルエット・軌道・拍数・テンポ・主役要素・部品・エフェクト・
変形・強度）へ写像して適用した。写像したのは軸の中身であって合格基準ではない。

| 番号 | 類似候補 | 差のある軸数 | 差のある軸 |
|---|---|---:|---|
| 001 | 003 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 002 | 001 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 003 | 001 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 003 | 025 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 004 | 005 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 005 | 004 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 006 | 022 | 7 | eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 007 | 008 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 008 | 002 | 7 | eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 008 | 007 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 009 | 019 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 010 | 005 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 011 | 019 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 011 | 025 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 012 | 005 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 013 | 023 | 6 | eyes, mouth, hands, body_deformation, dominant_effect, emotion_intensity |
| 014 | 015 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 015 | 016 | 7 | eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 016 | 015 | 7 | eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 017 | 021 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 017 | 034 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, emotion_intensity |
| 018 | 030 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 019 | 009 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 019 | 025 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 020 | 032 | 6 | composition_type, eyes, mouth, hands, posture, dominant_effect |
| 021 | 017 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 021 | 026 | 4 | eyes, mouth, hands, posture |
| 022 | 006 | 7 | eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 022 | 038 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 023 | 008 | 7 | eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 023 | 013 | 6 | eyes, mouth, hands, body_deformation, dominant_effect, emotion_intensity |
| 024 | 016 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 024 | 039 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 025 | 026 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 025 | 031 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 026 | 021 | 4 | eyes, mouth, hands, posture |
| 026 | 025 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 027 | 024 | 6 | composition_type, eyes, mouth, hands, posture, dominant_effect |
| 027 | 028 | 6 | eyes, mouth, hands, posture, dominant_effect, emotion_intensity |
| 028 | 027 | 6 | eyes, mouth, hands, posture, dominant_effect, emotion_intensity |
| 028 | 032 | 6 | eyes, mouth, hands, posture, dominant_effect, emotion_intensity |
| 029 | 028 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 030 | 018 | 6 | eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 030 | 031 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 031 | 025 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 031 | 032 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 032 | 020 | 6 | composition_type, eyes, mouth, hands, posture, dominant_effect |
| 032 | 031 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 033 | 036 | 7 | first_frame_silhouette, spatial_path, beat_pattern, dominant_visual_element, prop_or_symbol, body_deformation, emotion_intensity |
| 034 | 017 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, emotion_intensity |
| 034 | 038 | 6 | first_frame_silhouette, spatial_path, beat_pattern, dominant_visual_element, prop_or_symbol, dominant_effect |
| 035 | 032 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 035 | 038 | 7 | first_frame_silhouette, spatial_path, beat_pattern, dominant_visual_element, prop_or_symbol, dominant_effect, body_deformation |
| 036 | 033 | 7 | first_frame_silhouette, spatial_path, beat_pattern, dominant_visual_element, prop_or_symbol, body_deformation, emotion_intensity |
| 036 | 037 | 9 | first_frame_silhouette, spatial_path, beat_pattern, tempo_class, dominant_visual_element, prop_or_symbol, dominant_effect, body_deformation, emotion_intensity |
| 037 | 036 | 9 | first_frame_silhouette, spatial_path, beat_pattern, tempo_class, dominant_visual_element, prop_or_symbol, dominant_effect, body_deformation, emotion_intensity |
| 038 | 022 | 8 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect, emotion_intensity |
| 038 | 034 | 6 | first_frame_silhouette, spatial_path, beat_pattern, dominant_visual_element, prop_or_symbol, dominant_effect |
| 039 | 024 | 7 | composition_type, eyes, mouth, hands, posture, body_deformation, dominant_effect |
| 040 | 035 | 8 | first_frame_silhouette, spatial_path, beat_pattern, tempo_class, dominant_visual_element, prop_or_symbol, body_deformation, emotion_intensity |

## 付録B-1 分散条件

| 条件 | 実測 | 判定 |
|---|---|---|
| 動作ファミリー+軌道+拍数 の重複 | 0 件 | PASS |
| テンポ分散 低速/中速/高速 | 10/16/14 （目安 12/16/12 前後） | PASS |
| 同一テンポの3連続 | 0 件 | PASS |
| 主要部品の移動量20px未満 | 0 件 | PASS |
| 主動作が全身移動のみの項目 | 0 件 | PASS |
| 移動量の実際の範囲 | 24〜60px | PASS |
| 移動量と安全域の両立 (d <= 164 - max(w,h)) | 違反 0 件 | PASS |

## §7-A 構図バランス

| 構図タグ | 個数 | 目安 | 判定 |
|---|---:|---|---|
| face_centered | 10 | 10〜14 | PASS |
| upper_body | 10 | 6〜10 | PASS |
| full_body | 13 | 10〜14 | PASS |
| seated_lying_back | 6 | 6〜10 | PASS |
| deformation_or_effect_led | 9 | 6〜10 | PASS |
| prop_acting | 5 | 4〜8 | PASS |

主構図の3連続: 0 件 → PASS

## 総合

計画段階のゲートはすべて PASS。未解決の重複候補は0件。

## この検査で確認していないこと

- 生成後の見た目重複・動き重複（実画像が必要。現時点では NOT_RUN）
- 第1フレームの意味伝達（実画像の目視が必要。現時点では NOT_RUN）
- 32px表示での取り違え（実画像が必要。現時点では NOT_RUN）
