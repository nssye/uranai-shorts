// オリジナル文例辞書。表示用の改行は "\n"(1行13字程度まで)。
// 断定・不安をあおる表現・医療/投資の助言は書かない(npm run qa -- --dict で検査)

export type Sign = { id: string; ja: string; en: string; element: string; messages: string[] };

export const SIGNS: Sign[] = [
  { id: "aries", ja: "おひつじ座", en: "Aries", element: "火の星座", messages: ["直感で選んだことが\nいい流れを呼びそう", "小さな挑戦が\n明日の自信につながる日", "先に動くあなたに\n周りも励まされそう"] },
  { id: "taurus", ja: "おうし座", en: "Taurus", element: "地の星座", messages: ["丁寧に積み重ねたことが\n実を結びそう", "五感を満たす時間が\n心をととのえてくれそう", "マイペースを守るほど\n運気が安定しそう"] },
  { id: "gemini", ja: "ふたご座", en: "Gemini", element: "風の星座", messages: ["ふとした会話から\nいいヒントが届きそう", "気になったことは\nメモしておくと吉", "軽やかな好奇心が\n新しい縁を運びそう"] },
  { id: "cancer", ja: "かに座", en: "Cancer", element: "水の星座", messages: ["身近な人との時間が\n心の栄養になりそう", "あなたの気づかいが\nちゃんと届く日", "安心できる場所で\nゆっくり充電を"] },
  { id: "leo", ja: "しし座", en: "Leo", element: "火の星座", messages: ["あなたらしさを\n表に出すと輝けそう", "楽しむ姿勢が\n周りの笑顔を増やしそう", "ほめ言葉を\n素直に受け取ってみて"] },
  { id: "virgo", ja: "おとめ座", en: "Virgo", element: "地の星座", messages: ["身の回りを整えると\n頭もすっきりしそう", "小さな工夫が\n大きな助けになる日", "完璧より7割で\nちょうどいいかも"] },
  { id: "libra", ja: "てんびん座", en: "Libra", element: "風の星座", messages: ["人との調和が\nいい流れをつくりそう", "迷ったときは\n心地よさを基準に", "おしゃれを楽しむと\n気分が上がりそう"] },
  { id: "scorpio", ja: "さそり座", en: "Scorpio", element: "水の星座", messages: ["ひとつのことに\n深く向き合える日", "本音を話せる相手と\n絆が深まりそう", "直感が冴える日\n心の声を大切に"] },
  { id: "sagittarius", ja: "いて座", en: "Sagittarius", element: "火の星座", messages: ["いつもと違う道で\n発見がありそう", "遠くの目標を思い描くと\n前向きになれそう", "学びの時間が\n視野を広げてくれそう"] },
  { id: "capricorn", ja: "やぎ座", en: "Capricorn", element: "地の星座", messages: ["コツコツ続けたことが\n評価されそう", "計画を見直すと\n次の一手が見えそう", "がんばった自分を\nいたわってあげて"] },
  { id: "aquarius", ja: "みずがめ座", en: "Aquarius", element: "風の星座", messages: ["ひらめきを形にすると\n楽しくなりそう", "仲間との情報交換が\nヒントになりそう", "自分らしいやり方で\nうまく進めそう"] },
  { id: "pisces", ja: "うお座", en: "Pisces", element: "水の星座", messages: ["やさしい気持ちが\n縁をつないでくれそう", "音楽やアートに触れると\n心がほどけそう", "夢や想像の中に\nヒントがありそう"] },
];

export const LUCKY_COLORS = ["ラベンダー", "ミントグリーン", "ゴールド", "ネイビー", "コーラルピンク", "スカイブルー", "ホワイト", "ボルドー", "レモンイエロー", "オリーブ", "シルバー", "テラコッタ"];

export const LUCKY_ITEMS = ["ハンカチ", "手帳", "紅茶", "花の香り", "腕時計", "小さなノート", "お気に入りのペン", "リップ", "観葉植物", "イヤホン", "キャンドル", "本", "ハーブティー", "ブレスレット", "マグカップ", "手鏡", "チョコレート", "写真", "スニーカー", "香水"];

export const TIPS = [
  "朝に深呼吸を\n3回してみて",
  "感謝をひとこと\n伝えてみて",
  "寝る前は\nスマホを置いてみて",
  "お気に入りの曲を\n聴いてみて",
  "デスクの上を\n少し片づけてみて",
  "窓を開けて\n空気を入れかえて",
  "いつもより\nゆっくり歩いてみて",
  "やりたいことを\n1つ書き出してみて",
  "身近な人を\nほめてみて",
  "空を見上げて\nひと休みしてみて",
  "早めに\n準備を始めてみて",
  "あたたかい飲み物で\nひと息ついて",
  "笑顔で\nあいさつしてみて",
  "新しいお店を\nのぞいてみて",
  "好きな香りを\nまとってみて",
  "今日の良かったことを\nメモしてみて",
];

export type Card = { numeral: string; ja: string; en: string; keyword: string; message: string; tip: string };

export const TAROT: Card[] = [
  { numeral: "0", ja: "愚者", en: "The Fool", keyword: "自由", message: "身軽な気持ちで\n始めてみるとよさそう", tip: "やったことのないことを\n1つ試してみて" },
  { numeral: "I", ja: "魔術師", en: "The Magician", keyword: "始まり", message: "今あるもので\nうまく工夫できそう", tip: "思いついたことを\nすぐメモしてみて" },
  { numeral: "II", ja: "女教皇", en: "The High Priestess", keyword: "直感", message: "静かな時間に\n答えが浮かびそう", tip: "ひとりで考える時間を\n少し作ってみて" },
  { numeral: "III", ja: "女帝", en: "The Empress", keyword: "豊かさ", message: "自分を満たすほど\n周りにもやさしくなれそう", tip: "好きなものを食べて\nひと息ついて" },
  { numeral: "IV", ja: "皇帝", en: "The Emperor", keyword: "安定", message: "計画を立てると\n物事が進みやすそう", tip: "今日のやることを\n3つに絞ってみて" },
  { numeral: "V", ja: "教皇", en: "The Hierophant", keyword: "信頼", message: "誰かの助言が\nいいヒントになりそう", tip: "信頼できる人に\n相談してみて" },
  { numeral: "VI", ja: "恋人", en: "The Lovers", keyword: "選択", message: "心がときめく方を\n選ぶとよさそう", tip: "好きなものを\n素直に選んでみて" },
  { numeral: "VII", ja: "戦車", en: "The Chariot", keyword: "前進", message: "勢いにのって\n進めそうな日", tip: "後回しにしていたことに\n手をつけてみて" },
  { numeral: "VIII", ja: "力", en: "Strength", keyword: "やさしい強さ", message: "やわらかい対応が\n状況を動かしそう", tip: "ひと呼吸おいてから\n話してみて" },
  { numeral: "IX", ja: "隠者", en: "The Hermit", keyword: "内省", message: "自分と向き合うことで\n大切なものが見えそう", tip: "日記をつけて\n気持ちを整理してみて" },
  { numeral: "X", ja: "運命の輪", en: "Wheel of Fortune", keyword: "流れ", message: "いい流れが\nめぐってきそう", tip: "誘いには\n前向きに乗ってみて" },
  { numeral: "XI", ja: "正義", en: "Justice", keyword: "バランス", message: "公平な視点が\n信頼につながりそう", tip: "迷ったら\n事実を書き出してみて" },
  { numeral: "XII", ja: "吊るされた男", en: "The Hanged Man", keyword: "視点を変える", message: "見方を変えると\n新しい道が見えそう", tip: "いつもと逆の順番で\nやってみて" },
  { numeral: "XIII", ja: "死神", en: "Death", keyword: "切り替え", message: "古いものを手放して\n新しい風を入れる時", tip: "使っていないものを\n1つ整理してみて" },
  { numeral: "XIV", ja: "節制", en: "Temperance", keyword: "調和", message: "ほどよいペースが\nいい結果につながりそう", tip: "予定を詰めすぎず\n余白を残して" },
  { numeral: "XV", ja: "悪魔", en: "The Devil", keyword: "本当の望み", message: "自分の本当の望みに\n気づけそう", tip: "やめたい習慣を\n1つ見直してみて" },
  { numeral: "XVI", ja: "塔", en: "The Tower", keyword: "変化", message: "思わぬ変化が\n新しいきっかけになりそう", tip: "予定の変更も\n楽しむつもりで" },
  { numeral: "XVII", ja: "星", en: "The Star", keyword: "希望", message: "遠くに見えていた願いが\n少し近づくかも", tip: "叶えたいことを\n言葉にしてみて" },
  { numeral: "XVIII", ja: "月", en: "The Moon", keyword: "想像力", message: "あいまいなことは\n焦らず様子を見てOK", tip: "感じたことを\n絵や言葉にしてみて" },
  { numeral: "XIX", ja: "太陽", en: "The Sun", keyword: "喜び", message: "明るい気持ちが\n楽しい出来事を呼びそう", tip: "日の光を\n浴びてみて" },
  { numeral: "XX", ja: "審判", en: "Judgement", keyword: "再出発", message: "あきらめかけたことに\nもう一度光があたりそう", tip: "昔の夢を\n思い出してみて" },
  { numeral: "XXI", ja: "世界", en: "The World", keyword: "完成", message: "ひと区切りがついて\n達成感を味わえそう", tip: "がんばった自分に\nごほうびを" },
];

export type NumberEntry = { keyword: string; message: string; tip: string; color: string };

export const NUMBERS: Record<number, NumberEntry> = {
  1: { keyword: "スタート", message: "新しいことを\n始めるのにいい日", tip: "最初の一歩を\n小さく踏み出して", color: "レッド" },
  2: { keyword: "協力", message: "誰かと力を合わせると\nうまくいきそう", tip: "相手の話を\nじっくり聞いてみて", color: "ホワイト" },
  3: { keyword: "楽しむ", message: "楽しむ気持ちが\nいい流れを呼びそう", tip: "好きなことに\n時間を使ってみて", color: "イエロー" },
  4: { keyword: "土台づくり", message: "コツコツ整えることに\n向いた日", tip: "部屋や予定を\n整えてみて", color: "グリーン" },
  5: { keyword: "変化", message: "変化を楽しむと\n新しい発見がありそう", tip: "いつもと違う道を\n通ってみて", color: "スカイブルー" },
  6: { keyword: "愛情", message: "身近な人を\n大切にしたくなる日", tip: "ありがとうを\n言葉にしてみて", color: "ピンク" },
  7: { keyword: "探求", message: "じっくり考えると\n答えが見えてきそう", tip: "ひとりの時間を\n楽しんでみて", color: "パープル" },
  8: { keyword: "実り", message: "がんばりが\n形になりやすい日", tip: "目標をはっきり\n書き出してみて", color: "ゴールド" },
  9: { keyword: "しめくくり", message: "区切りをつけると\n心が軽くなりそう", tip: "終わらせたいことを\n1つ片づけて", color: "ネイビー" },
  11: { keyword: "ひらめき", message: "ふとしたひらめきに\nヒントがありそう", tip: "直感を\nメモしておいて", color: "シルバー" },
  22: { keyword: "大きな構想", message: "大きな夢を\n描くのにいい日", tip: "理想の未来を\n書き出してみて", color: "ブロンズ" },
};

// フックの型(運用記録で反応を比較するためIDを持たせる)。{sign} は星座名に置換
export const HOOKS: Record<"zodiac" | "tarot" | "numerology", { id: string; text: string; narration: string }[]> = {
  zodiac: [
    { id: "daily", text: "{sign}さんの\n今日の運勢", narration: "{sign}さんの、今日の運勢です。" },
    { id: "question", text: "{sign}さん\n今日はどんな日？", narration: "{sign}さん、今日はどんな日になりそうでしょう。" },
    { id: "message", text: "{sign}のあなたへ\n今日のメッセージ", narration: "{sign}のあなたへ、今日のメッセージです。" },
  ],
  tarot: [
    { id: "daily", text: "今日のあなたに\n届く1枚", narration: "今日のあなたに届く、タロットを1枚引きます。" },
    { id: "question", text: "今のあなたに\n必要なメッセージは？", narration: "今のあなたに必要なメッセージは？タロットで見てみましょう。" },
    { id: "message", text: "この動画を見た\nあなたへ", narration: "この動画を見たあなたへ、今日の1枚です。" },
  ],
  numerology: [
    { id: "daily", text: "今日の数字で\n読むヒント", narration: "今日の数字で読む、過ごし方のヒントです。" },
    { id: "question", text: "今日の日付に\nかくれた数字は？", narration: "今日の日付に、かくれた数字は何でしょう。" },
    { id: "message", text: "数字が教える\n今日の過ごし方", narration: "数字が教える、今日の過ごし方です。" },
  ],
};

export const CTAS = [
  { text: "保存して\nあとで見返してね", narration: "保存して、あとで見返してね。" },
  { text: "フォローすると\n毎日届きます", narration: "フォローすると、毎日届きます。" },
];

// VOICEVOXで読み間違えやすい表記の置換
export const YOMI: Record<string, string> = { OK: "オーケー", "7割": "ななわり" };

export const BASE_HASHTAGS = ["#占い", "#今日の運勢"];
export const TYPE_HASHTAGS = {
  zodiac: ["#星座占い", "#12星座"],
  tarot: ["#タロット", "#タロット占い", "#今日のタロット", "#ワンオラクル"],
  numerology: ["#数秘術", "#数秘", "#今日の数字"],
};
