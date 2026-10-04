---
name: uranai-script
description: 占いショート(星座運勢/タロット1枚引き/数秘)の台本・キャプション・ハッシュタグを生成し、VOICEVOX音声付きでRemotionレンダリングまで行う。「動画を作って」「今日の分を作って」「タロットの動画」などで使う。
---

# uranai-script

台本はテンプレート+オリジナル文例辞書(`scripts/content/data.ts`)から日付で決定的に生成する(LLM不使用)。

## 作る
```
npm run make -- --type <zodiac|tarot|numerology> --style <styleId> [--date YYYY-MM-DD] [--sign leo] [--card 17] [--hook daily|question|message]
```
- 流れ: 台本生成 → QA → VOICEVOX(エンジン未起動なら自動起動)→ QA(実尺)→ レンダリング → `content/<jobId>/caption.txt` → `records/posts.csv` に登録
- 尺は15〜30秒。足りなければ各シーンを均等に引き延ばす。超える場合はQAエラー
- 出力: `out/<jobId>.mp4`。プレビューは `npm run studio -- <jobId>`
- 声を変える: `--speaker <ID>`(一覧 `npm run tts -- --list`)。クレジット「VOICEVOX:キャラ名」は動画右下とキャプションに自動で入る

## 文例を増やす・直す
`scripts/content/data.ts` を編集 → `npm run qa -- --dict` で禁止表現チェック。表示の改行は `\n`(1行13字程度まで)。断定せず「〜そう」「〜かも」で書く。
