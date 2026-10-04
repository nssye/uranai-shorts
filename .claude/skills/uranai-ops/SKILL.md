---
name: uranai-ops
description: 投稿後の反応(再生・保存・シェア等)を記録し、見本スタイル・フック・フォント別に比較レポートを出す。「反応を記録」「どのスタイルが良い?」「レポート」で使う。
---

# uranai-ops(運用管理)

記録先は `records/posts.csv`(BOM付きUTF-8。Excelで直接編集してもよい)。生成時に自動列(スタイル・フォント・アニメ・テンポ・ボイス・尺など)が埋まり、投稿後に反応列を足す。

- 未記録の一覧: `npm run record -- --list`
- 記録: `npm run record -- <jobId> --posted_at "2026-10-05 21:00" --views 1520 --reach 1300 --likes 80 --comments 4 --saves 42 --shares 6 --follows 3 --avg_watch_sec 9.8 --notes "メモ"`
- 比較: `npm run report`(`--min 3` で参考扱いにする件数)→ コンソール表 + `reports/report.html`

指標: 保存率 = Σsaves/Σreach(主指標)、シェア率、いいね率、フォロー/千リーチ、視聴完了率 = 平均視聴秒/尺。件数が少ない行は偶然の差が大きいので結論を急がない。比較したい要素以外(占い種別・投稿時間帯)はなるべく揃えて投稿するよう助言する。
