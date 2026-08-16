# Clean YouTube Recommendations

YouTube の視聴ページで、再生回数が一定以下の動画を関連動画欄から取り除く Tampermonkey 用のユーザースクリプト。SPA 遷移や無限スクロールにも追従して、あとから読み込まれたおすすめにも適用される。

## インストール

Tampermonkeyのダッシュボードで下記のURLからスクリプトをインストールできる。

Tampermonkeyダッシュボード: `chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=utils`

スクリプトURL: `https://raw.githubusercontent.com/ToshihiroOgino/custom_scripts/main/clean_youtube_recommendations/clean-youtube-recommendations.user.js`


## 設定

スクリプト冒頭の `OPTIONS` を編集する。

| キー                 | 既定値  | 説明                                                                |
| -------------------- | ------- | ------------------------------------------------------------------- |
| `viewCountThreshold` | `3000`  | この再生回数**以下**の動画を関連動画から取り除く                    |
| `verbose`            | `true`  | 非表示にした動画の一覧をおすすめ欄の上に表示する                    |
| `debug`              | `false` | `true` にすると各カードの判定結果を DevTools のコンソールに出力する |

### verbose 表示

`true` のとき、おすすめ一覧のすぐ上に「非表示にした動画 N 件」という折りたたみパネルを差し込み、消した動画をサムネイル無しで一覧表示する。

```
▼ 非表示にした動画 1 件
   Hoge Title
   Huga Channel ・ 123回視聴 ・ 2 週間前
```

一度開けば、そのあと動画が追加で消されても開いたまま。タイトルは元動画へのリンクになっているので、消された動画をそのまま開ける。

## 変更履歴

| Version | 変更内容 |
| ------- | -------- |
| 1.0.0   | 公開 |
