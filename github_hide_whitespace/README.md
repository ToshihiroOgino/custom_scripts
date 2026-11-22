# GitHub Hide Whitespace

GitHub の PR・コミット・compare の diff ページを開いたとき、リンクと URL に自動で `?w=1` を付けて空白だけの変更を非表示にする Tampermonkey 用のユーザースクリプト。

## インストール

[Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)のダッシュボードで下記のURLからスクリプトをインストールできる。

スクリプトURL: `https://raw.githubusercontent.com/ToshihiroOgino/custom_scripts/main/github_hide_whitespace/github-hide-whitespace.user.js`

## 変更履歴

| Version | 変更内容 |
| ------- | -------- |
| 1.0.0   | 公開 |
| 1.1.0   | diff へのリンクに `?w=1` を付与する方式に変更 |
