# uranai-shorts

Instagram Reels 用の占いショート動画(1080x1920 / 15〜30秒)を、手元のPCだけで作るツール。
外部API・LLMは使わない。音声はローカルの VOICEVOX。

- **style-analyzer**: どんな動画でも、配色・文字配置・フォントの雰囲気・テンポ・アニメを数値解析して `styles/<id>.json` にする
- **Remotionテンプレ**: スタイルJSONを差し替えるだけでデザインが変わる汎用テンプレ(星座運勢 / タロット1枚引き / 数秘)
- **台本生成 + QA**: オリジナル文例辞書から日付で台本を作り、禁止表現・文字数・尺をルールでチェック
- **運用管理**: 投稿の反応を記録し、見本スタイル・フック・フォント別に比較

## 必要なもの
Node.js 20以上 / ffmpeg / VOICEVOX(アプリを入れておけば、エンジンは自動起動)

```
npm install
cd remotion && npm install && cd ..
```

## よく使うコマンド

| やりたいこと | コマンド |
|---|---|
| 動画を作る | `npm run make -- --type tarot --style mystic` |
| 星座を指定 | `npm run make -- --type zodiac --sign leo --style pastel` |
| 日付を指定 | `npm run make -- --type numerology --date 2026-10-05` |
| 音声なしで試す | `npm run make -- --type tarot --no-tts` |
| プレビュー(Studio) | `npm run studio -- <jobId>` |
| 見本動画を解析 | `npm run analyze -- samples/s01/video.mp4 --id s01` |
| 話者一覧 | `npm run tts -- --list` |
| 文例の禁止表現チェック | `npm run qa -- --dict` |
| 反応を記録 | `npm run record -- <jobId> --views 1500 --reach 1300 --saves 40 ...` |
| 比較レポート | `npm run report` → `reports/report.html` |

`--type` は `zodiac`(星座)/ `tarot`(タロット)/ `numerology`(数秘)。日本語の `星座` `タロット` `数秘` も可。

## 1本できるまでの流れ
```
npm run make
  ├ 台本生成 (scripts/content)      日付+種別から決定的に生成。同じ条件なら同じ台本
  ├ QA (scripts/qa.ts)              禁止表現・1行文字数・尺・セーフゾーン
  ├ VOICEVOX (scripts/tts.ts)       シーンごとにwav。音声の長さでシーン尺が決まる
  ├ QA(実尺)                        15秒未満なら各シーンを均等に延長
  ├ レンダリング (remotion/)         out/<jobId>.mp4
  ├ キャプション                     content/<jobId>/caption.txt(ハッシュタグ・クレジット込み)
  └ 運用記録                         records/posts.csv に1行追加
```
投稿は手動:mp4 と caption.txt を Instagram にアップする。

## 構成
```
samples/<id>/        見本動画(gitに入れない)
styles/<id>.json     スタイル定義。mystic / pastel / pop がプリセット、schema.json で補完が効く
remotion/            Remotionプロジェクト(src/schema.ts がスキーマの唯一の定義)
scripts/             make / analyze-style / qa / tts / record / report
content/<jobId>/     script.json / props.json / caption.txt
out/                 書き出した動画
records/posts.csv    運用記録(Excelで開ける)
.claude/skills/      style-analyzer / uranai-script / uranai-ops + Remotion公式Skill
.claude/agents/qa.md 公開前QAエージェント
```

## スタイルJSONの主な項目
| 項目 | 内容 |
|---|---|
| `palette` | 背景グラデ(1〜3色)、文字、アクセント2色、影 |
| `background` | グラデの種類、粒子(星/ボケ)、グレイン、ビネット |
| `typography` | 雰囲気(明朝/ゴシック/丸/ポップ)、フォント名(Google Fonts)と候補3つ、サイズ、縁取り、影 |
| `layout` | 文字領域(高さ比)、揃え、余白、1行の文字数、座布団 |
| `animation` | 文字の登場(fade/slideUp/pop/typewriter/blur/zoom)、強調、シーン切替(cut/fade/slide/wipe/flip)、カメラ |
| `tempo` / `text` | テンポ、最短シーン秒数、最大行数 |
| `voice` | VOICEVOXの話者ID・話速・抑揚 |
| `bgm` | 任意。`remotion/public/` 以下の商用可の音源ファイル と 音量 |

## ルール(素材・表現)
- 見本の画像・BGM・文章・ロゴは流用しない。解析で取り出すのは数値(色・位置・秒数・動きの種類)だけ
- フォントは Google Fonts(OFL、商用可)のみ
- VOICEVOXのクレジット(`VOICEVOX:キャラ名`)は動画とキャプションに自動で入る。キャラごとの利用規約も確認すること
- 占い文面は断定せず、不安をあおらず、医療・投資の助言をしない(QAでチェック)
- Reelsの画面UIと重ならないよう、文字は高さ 0.11〜0.83 の範囲に置く(はみ出すとQAで警告)

## 解析の精度について
推定はヒューリスティック。自動生成した3スタイルの動画で検証した結果、背景色・文字色・縁取り・文字領域・カット秒数・フォントの雰囲気・文字の登場アニメは元の設定を再現できた。トランジション(wipe/slide)とゆっくりしたズームは検出が弱いので、結果を見て `styles/<id>.json` を手で直す前提で使う。判定の根拠は `analysis` 欄に残る。
