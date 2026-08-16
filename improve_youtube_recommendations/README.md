# Improve YouTube Recommendations

## What I Want

Youtube の再生時にゴミみたいな再生回数の動画を非表示にしたい

https://www.youtube.com/watch?v=hoge で動画を再生する時、次に視聴する動画の候補が[このように](recommends.html)表示される。

このとき、再生回数が少ない動画がおすすめされる。Tempermonkeyのカスタムスクリプトによって[このような](trash.html)ElementをDOMから削除したい

trash.html は recommends.html に含まれる消したいElementの例。

削除する視聴回数のしきい値はとりあえず1000回以下とする。後で変えたいこともあるかもしれないので、スクリプトの最上部に定数として書いといて、編集しやすいようにして
