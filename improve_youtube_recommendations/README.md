# Improve YouTube Recommendations

## What I Want

Youtube の再生時にゴミみたいな再生回数の動画を非表示にしたい

https://www.youtube.com/watch?v=hoge で動画を再生する時、次に視聴する動画の候補が[このように](recommends.html)表示される。

このとき、再生回数が少ない動画がおすすめされる。Tempermonkeyのカスタムスクリプトによって[このような](trash.html)ElementをDOMから削除したい

trash.html は recommends.html に含まれる消したいElementの例。

削除する視聴回数のしきい値はとりあえず1000回以下とする。後で変えたいこともあるかもしれないので、スクリプトの最上部に定数として書いといて、編集しやすいようにして

## 使い方

1. Tampermonkey のダッシュボードで「新規スクリプトを作成」
2. [improve-youtube-recommendations.user.js](improve-youtube-recommendations.user.js) の中身をまるごと貼り付けて保存

## 設定

スクリプト冒頭の定数を編集する。

| 定数                        | 既定値     | 説明                                                                 |
| --------------------------- | ---------- | -------------------------------------------------------------------- |
| `VIEW_COUNT_THRESHOLD`      | `1000`     | この再生回数**以下**の動画を関連動画から取り除く                     |
| `REMOVAL_MODE`              | `'remove'` | `'remove'` = DOM から削除 / `'hide'` = `display:none` で隠すだけ      |
| `REMOVE_UNKNOWN_VIEW_COUNT` | `false`    | 再生回数が読めないカード（ミックス、ライブ配信、広告など）も消すか   |
| `DEBUG`                     | `false`    | `true` にすると各カードの判定結果を DevTools のコンソールに出力する  |

## 仕組み

- 関連動画欄（`#secondary` / `#related`）の中のカード（`yt-lockup-view-model`、旧レイアウトの `ytd-compact-video-renderer`）を走査する。
- 再生回数は、表示テキストが `383` のように数字だけになっているため `aria-label="383回視聴"` から読む。`5.4万回視聴` `1.2億回視聴` `1.2M views` のような単位付き表記にも対応。
- ライブ配信の `1,234人が視聴中` / `1,234 watching` は再生回数として扱わない（消えない）。
- 再生回数が読めないカードは、まだ描画途中の可能性があるため既定では残す。
- SPA 遷移と無限スクロールに追従するため、MutationObserver と `yt-navigate-finish` イベントで再走査する。
