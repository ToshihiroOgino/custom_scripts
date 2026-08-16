// ==UserScript==
// @name         Improve YouTube Recommendations
// @namespace    https://github.com/tonigo/custom_scripts
// @version      1.0.0
// @description  YouTube の視聴ページで、再生回数が少ないゴミ動画を関連動画（おすすめ）欄から取り除く
// @author       tonigo
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ===========================================================================
  // 設定（ここだけ編集すればOK）
  // ===========================================================================

  /** この再生回数「以下」の動画を関連動画から取り除く */
  const VIEW_COUNT_THRESHOLD = 1000;

  /** 'remove' = DOM から削除する / 'hide' = display:none で隠すだけ */
  const REMOVAL_MODE = 'remove';

  /**
   * 再生回数が読み取れないカード（ミックス、ライブ配信、広告など）も消すか。
   * true にすると、YouTube がメタデータを描画し終える前のカードまで
   * 巻き添えで消える可能性があるので注意。
   */
  const REMOVE_UNKNOWN_VIEW_COUNT = false;

  /** true にすると、判定結果を DevTools のコンソールに出す */
  const DEBUG = false;

  // ===========================================================================
  // 以下、実装
  // ===========================================================================

  /** 関連動画リストのコンテナ。この中だけを走査する */
  const CONTAINER_SELECTOR = '#secondary, #related';

  /** おすすめカード 1 枚にあたる要素 */
  const CARD_SELECTOR = 'yt-lockup-view-model, ytd-compact-video-renderer';

  /** カードの中で再生回数が書かれている要素 */
  const VIEW_COUNT_SELECTOR = [
    '.ytContentMetadataViewModelMetadataText', // 現行レイアウト
    '#metadata-line .inline-metadata-item', // 旧レイアウト
    '#metadata-line span',
  ].join(', ');

  /** 処理済みカードに付ける dataset のキー（data-iyr-processed） */
  const PROCESSED_FLAG = 'iyrProcessed';

  /** 走査をまとめる間隔（ミリ秒） */
  const SCAN_DEBOUNCE_MS = 150;

  /** 「5.4万回視聴」「1.2M views」などの単位 */
  const UNIT_FACTORS = {
    '億': 1e8,
    '万': 1e4,
    '千': 1e3,
    k: 1e3,
    m: 1e6,
    b: 1e9,
  };

  /** 例: 「383回視聴」「4,517回視聴」「5.4万回視聴」「1.2M views」 */
  const VIEW_COUNT_PATTERN = /([\d,]+(?:\.\d+)?)\s*(億|万|千|[KMB])?\s*(?:回\s*視聴|\bviews?\b)/i;

  /** 再生回数ゼロの表記 */
  const ZERO_VIEW_PATTERN = /視聴回数なし|\bno views\b/i;

  const log = (...args) => {
    if (DEBUG) console.log('[improve-youtube-recommendations]', ...args);
  };

  /**
   * 再生回数の文字列を数値に変換する。
   * 再生回数として解釈できない場合は null を返す。
   * ライブ配信の「1,234人が視聴中」「1,234 watching」はここでマッチしない。
   */
  const parseViewCount = (text) => {
    if (!text) return null;
    if (ZERO_VIEW_PATTERN.test(text)) return 0;

    const matched = text.match(VIEW_COUNT_PATTERN);
    if (!matched) return null;

    const value = Number(matched[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;

    const unit = matched[2];
    if (!unit) return value;

    const factor = UNIT_FACTORS[unit] ?? UNIT_FACTORS[unit.toLowerCase()] ?? 1;
    return value * factor;
  };

  /**
   * カードから再生回数を読み取る。
   * 現行レイアウトは表示テキストが「383」だけで aria-label に「383回視聴」が入るため、
   * aria-label → textContent の順で見る。
   */
  const readViewCount = (card) => {
    for (const element of card.querySelectorAll(VIEW_COUNT_SELECTOR)) {
      const fromLabel = parseViewCount(element.getAttribute('aria-label'));
      if (fromLabel !== null) return fromLabel;

      const fromText = parseViewCount(element.textContent);
      if (fromText !== null) return fromText;
    }
    return null;
  };

  const removeCard = (card) => {
    if (REMOVAL_MODE === 'hide') {
      card.style.display = 'none';
    } else {
      card.remove();
    }
  };

  /** カードのタイトル（ログ用） */
  const cardTitle = (card) =>
    card.querySelector('h3[title], #video-title')?.getAttribute('title') ??
    card.textContent.trim().slice(0, 40);

  const processCard = (card) => {
    if (card.dataset[PROCESSED_FLAG]) return;

    const viewCount = readViewCount(card);

    if (viewCount === null) {
      // メタデータが描画される前かもしれないので、処理済みの印は付けずに次回もう一度見る
      if (!REMOVE_UNKNOWN_VIEW_COUNT) return;
      log('再生回数不明のため削除:', cardTitle(card));
      removeCard(card);
      return;
    }

    card.dataset[PROCESSED_FLAG] = '1';

    if (viewCount > VIEW_COUNT_THRESHOLD) {
      log('残す:', viewCount, cardTitle(card));
      return;
    }

    log('削除:', viewCount, cardTitle(card));
    removeCard(card);
  };

  const scan = () => {
    for (const container of document.querySelectorAll(CONTAINER_SELECTOR)) {
      for (const card of container.querySelectorAll(CARD_SELECTOR)) {
        processCard(card);
      }
    }
  };

  let scanTimer = null;
  const scheduleScan = () => {
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, SCAN_DEBOUNCE_MS);
  };

  // 関連動画は SPA 遷移・無限スクロールで後から差し込まれるので、
  // 要素が追加されたときだけ走査し直す
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) {
      scheduleScan();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // YouTube のページ遷移イベント
  window.addEventListener('yt-navigate-finish', scheduleScan);
  window.addEventListener('yt-page-data-updated', scheduleScan);

  scheduleScan();
})();
