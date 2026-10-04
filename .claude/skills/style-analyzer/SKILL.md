---
name: style-analyzer
description: 見本動画(任意のmp4/mov)から配色・文字配置・フォントの雰囲気・テンポ・アニメ種別を数値解析し styles/<id>.json を作る。「この動画の雰囲気で作りたい」「見本を解析して」「スタイルを追加」と言われたら使う。
---

# style-analyzer

見本動画の「雰囲気」を数値化してスタイルJSONにする。画像・文字・音声・ロゴは一切コピーしない。APIは使わない(ffmpeg + 画素解析)。

## 手順
1. 見本を `samples/<id>/` に置いてもらう(gitには入らない)
2. `npm run analyze -- samples/<id>/<file>.mp4 --id <id> --name "表示名"`(既存IDの上書きは `--force`)
3. 出力 `styles/<id>.json` と参照画像 `.cache/analyze/<id>/sheet.jpg` を確認し、結果をユーザーに要約する
4. 推定がずれていそうな項目は JSON を直接直す(`styles/schema.json` で補完が効く)
5. `npm run make -- --type tarot --style <id> --no-tts` で見た目を試す

## 推定の信頼度(高→低)
- 高: 背景色/グラデ種別、文字色・縁取り、文字領域Y、揃え、文字サイズ、行数、カット秒数、粒子(星/ボケ)
- 中: フォントの雰囲気(明朝/ゴシック/丸/ポップ。丸とゴシックの区別は配色からの推測)、文字の登場アニメ、座布団
- 低: トランジション種別(フェード以外は誤判定しやすい)、カメラの動き(ゆっくりしたズームは検出しにくい)
- `analysis` 欄に判定根拠(投票結果・測定値)が残るので、迷ったらそこを見る

## フォント
`typography.fontCandidates` に商用利用可(Google Fonts / OFL)の候補を3つ出す。`fontFamily` を候補の別のものに替えてもよい。Google Fontsにある名前なら何でも描画できる。
