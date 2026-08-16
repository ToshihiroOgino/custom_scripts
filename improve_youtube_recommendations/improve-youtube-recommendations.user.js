// ==UserScript==
// @name         Improve YouTube Recommendations
// @namespace    https://github.com/ToshihiroOgino/custom_scripts
// @version      1.2.0
// @description  YouTube の視聴ページで、再生回数が少ないゴミ動画を関連動画（おすすめ）欄から取り除く
// @author       ToshihiroOgino
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // ===========================================================================
  // 設定（ここだけ編集すればOK）
  // ===========================================================================

  /** この再生回数「以下」の動画を関連動画から取り除く */
  const VIEW_COUNT_THRESHOLD = 1000;

  /**
   * true にすると、非表示にした動画のタイトル・チャンネル名・再生回数を
   * おすすめ一覧のすぐ上にサムネイル無しで一覧表示する。
   */
  const VERBOSE = true;

  /** true にすると、判定結果を DevTools のコンソールに出す */
  const DEBUG = false;

  // ===========================================================================
  // 以下、実装
  // ===========================================================================

  /** 関連動画リストのコンテナ。この中だけを走査する */
  const CONTAINER_SELECTOR = "#secondary, #related";

  /** おすすめカード 1 枚にあたる要素 */
  const CARD_SELECTOR = "yt-lockup-view-model, ytd-compact-video-renderer";

  /** カードの中で再生回数が書かれている要素 */
  const VIEW_COUNT_SELECTOR = [
    ".ytContentMetadataViewModelMetadataText", // 現行レイアウト
    "#metadata-line .inline-metadata-item", // 旧レイアウト
    "#metadata-line span",
  ].join(", ");

  /** カードのタイトル */
  const TITLE_SELECTOR = "h3[title], #video-title";

  /** カードのリンク */
  const LINK_SELECTOR = "a.ytLockupMetadataViewModelTitle, a#video-title-link, a#thumbnail, a[href*='/watch']";

  /** カードのチャンネル名 */
  const CHANNEL_SELECTOR = [
    "#channel-name #text", // 旧レイアウト
    ".ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelMetadataText", // 現行レイアウト（1 行目）
  ].join(", ");

  /** 処理済みカードに付ける dataset のキー（data-iyr-processed） */
  const PROCESSED_FLAG = "iyrProcessed";

  /** VERBOSE パネルの状態をコンテナ要素にぶら下げるためのキー */
  const PANEL_STATE = Symbol("iyrPanelState");

  /** 走査をまとめる間隔（ミリ秒） */
  const SCAN_DEBOUNCE_MS = 150;

  /** 「5.4万回視聴」「1.2M views」などの単位 */
  const UNIT_FACTORS = {
    億: 1e8,
    万: 1e4,
    千: 1e3,
    k: 1e3,
    m: 1e6,
    b: 1e9,
  };

  /** 例: 「383回視聴」「4,517回視聴」「5.4万回視聴」「1.2M views」 */
  const VIEW_COUNT_PATTERN = /([\d,]+(?:\.\d+)?)\s*(億|万|千|[KMB])?\s*(?:回\s*視聴|\bviews?\b)/i;

  /** 再生回数ゼロの表記 */
  const ZERO_VIEW_PATTERN = /視聴回数なし|\bno views\b/i;

  const log = (...args) => {
    if (DEBUG) console.log("[improve-youtube-recommendations]", ...args);
  };

  const textOf = (element) => (element?.getAttribute("aria-label") || element?.textContent || "").trim();

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

    const value = Number(matched[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) return null;

    const unit = matched[2];
    if (!unit) return value;

    const factor = UNIT_FACTORS[unit] ?? UNIT_FACTORS[unit.toLowerCase()] ?? 1;
    return value * factor;
  };

  /**
   * カードの中から再生回数の要素を探す。
   * 現行レイアウトは表示テキストが「383」だけで aria-label に「383回視聴」が入るため、
   * aria-label → textContent の順で見る。
   */
  const findViewCount = (card) => {
    for (const element of card.querySelectorAll(VIEW_COUNT_SELECTOR)) {
      const label = element.getAttribute("aria-label");
      const count = parseViewCount(label) ?? parseViewCount(element.textContent);
      if (count !== null) {
        return { element, count, text: (label || element.textContent).trim() };
      }
    }
    return null;
  };

  /** 再生回数と同じ行にある投稿日（「2 週間前」など）を拾う */
  const findPublished = (viewCountElement) => {
    const row = viewCountElement.parentElement;
    if (!row) return null;

    const others = [...row.querySelectorAll(VIEW_COUNT_SELECTOR)].filter((element) => element !== viewCountElement);
    const text = textOf(others[others.length - 1]);
    return text && parseViewCount(text) === null ? text : null;
  };

  /** VERBOSE 表示用に、カードから消す前の情報を取り出す */
  const readCardInfo = (card, viewCount) => {
    const channelElement = card.querySelector(CHANNEL_SELECTOR);
    const channel = channelElement && channelElement !== viewCount.element ? textOf(channelElement) : "";

    return {
      title: textOf(card.querySelector(TITLE_SELECTOR)) || "(タイトル不明)",
      href: card.querySelector(LINK_SELECTOR)?.getAttribute("href") ?? null,
      channel: parseViewCount(channel) === null ? channel : "",
      viewsText: viewCount.text,
      published: findPublished(viewCount.element),
    };
  };

  // --- VERBOSE パネル ---------------------------------------------------------

  const PANEL_STYLE_ID = "iyr-removed-style";
  const PANEL_CSS = `
    .iyr-removed {
      margin: 0 0 12px;
      padding: 8px 12px;
      border: 1px solid var(--yt-spec-10-percent-layer, rgba(128, 128, 128, 0.3));
      border-radius: 12px;
      font-family: "Roboto", "Arial", sans-serif;
      color: var(--yt-spec-text-secondary, #909090);
    }
    .iyr-removed > summary {
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--yt-spec-text-primary, #f1f1f1);
    }
    .iyr-removed__list {
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .iyr-removed__title {
      display: block;
      font-size: 12px;
      line-height: 1.3;
      color: var(--yt-spec-text-primary, #f1f1f1);
      text-decoration: none;
    }
    .iyr-removed__title:hover {
      text-decoration: underline;
    }
    .iyr-removed__meta {
      margin-top: 2px;
      font-size: 11px;
      line-height: 1.3;
    }
  `;

  const injectPanelStyle = () => {
    if (document.getElementById(PANEL_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PANEL_STYLE_ID;
    style.textContent = PANEL_CSS;
    (document.head ?? document.documentElement).appendChild(style);
  };

  const createPanel = () => {
    const panel = document.createElement("details");
    panel.className = "iyr-removed";
    // 開閉状態は再描画（renderPanel）では触らないので、手で開いたら開いたまま残る
    panel.open = false;

    const summary = document.createElement("summary");
    const list = document.createElement("ol");
    list.className = "iyr-removed__list";

    panel.append(summary, list);
    return { panel, summary, list };
  };

  /**
   * おすすめ一覧のコンテナに対応するパネルを用意し、一覧のすぐ上に挿し込む。
   * YouTube 側の再描画でパネルが外れても、呼ばれるたびに挿し直す。
   */
  const ensurePanel = (container) => {
    let state = container[PANEL_STATE];
    if (!state) {
      injectPanelStyle();
      state = { ...createPanel(), entries: [] };
      container[PANEL_STATE] = state;
    }

    const parent = container.parentElement;
    if (parent && state.panel.parentElement !== parent) {
      parent.insertBefore(state.panel, container);
    }
    return state;
  };

  const renderPanel = (state) => {
    state.summary.textContent = `非表示にした動画 ${state.entries.length} 件`;
    state.list.textContent = "";

    for (const entry of state.entries) {
      const item = document.createElement("li");

      const title = document.createElement(entry.href ? "a" : "span");
      title.className = "iyr-removed__title";
      title.textContent = entry.title;
      if (entry.href) title.href = entry.href;

      const meta = document.createElement("div");
      meta.className = "iyr-removed__meta";
      meta.textContent = [entry.channel, entry.viewsText, entry.published].filter(Boolean).join(" ・ ");

      item.append(title, meta);
      state.list.appendChild(item);
    }
  };

  /** 消す直前のカードをパネルに記録する */
  const recordRemoval = (card, viewCount) => {
    const container = card.parentElement;
    if (!container) return;

    const state = ensurePanel(container);
    state.entries.push(readCardInfo(card, viewCount));
    renderPanel(state);
  };

  // --- 走査 -------------------------------------------------------------------

  const processCard = (card) => {
    if (card.dataset[PROCESSED_FLAG]) return;

    const viewCount = findViewCount(card);

    // 再生回数が読めないカード（ミックス、ライブ配信、まだ描画途中のカードなど）は残す。
    // 処理済みの印は付けず、次の走査でもう一度見る。
    if (viewCount === null) return;

    card.dataset[PROCESSED_FLAG] = "1";

    if (viewCount.count > VIEW_COUNT_THRESHOLD) {
      log("残す:", viewCount.count, textOf(card.querySelector(TITLE_SELECTOR)));
      return;
    }

    log("削除:", viewCount.count, textOf(card.querySelector(TITLE_SELECTOR)));
    if (VERBOSE) recordRemoval(card, viewCount);
    card.remove();
  };

  const scan = () => {
    const listContainers = new Set();

    for (const container of document.querySelectorAll(CONTAINER_SELECTOR)) {
      for (const card of container.querySelectorAll(CARD_SELECTOR)) {
        if (card.parentElement?.[PANEL_STATE]) listContainers.add(card.parentElement);
        processCard(card);
      }
    }

    // YouTube の再描画でパネルが外れることがあるので、毎回挿し直しておく
    for (const container of listContainers) ensurePanel(container);
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
  window.addEventListener("yt-navigate-finish", scheduleScan);
  window.addEventListener("yt-page-data-updated", scheduleScan);

  scheduleScan();
})();
