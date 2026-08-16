// ==UserScript==
// @name         Clean YouTube Recommendations
// @version      1.2.1
// @description  YouTube の視聴ページで、再生回数が少ないゴミ動画を関連動画欄から取り除く
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const OPTIONS = {
    /** この再生回数以下の動画を関連動画から取り除く */
    viewCountThreshold: 1000,

    /** 非表示にした動画の一覧をおすすめ欄の上に表示する */
    verbose: true,

    /** 判定結果を DevTools のコンソールに出す */
    debug: false,
  };

  const CONTAINER_SELECTOR = "#secondary, #related";

  const CARD_SELECTOR = "yt-lockup-view-model, ytd-compact-video-renderer";

  const VIEW_COUNT_SELECTOR = [
    ".ytContentMetadataViewModelMetadataText",
    "#metadata-line .inline-metadata-item",
    "#metadata-line span",
  ].join(", ");

  const TITLE_SELECTOR = "h3[title], #video-title";

  const LINK_SELECTOR = "a.ytLockupMetadataViewModelTitle, a#video-title-link, a#thumbnail, a[href*='/watch']";

  const CHANNEL_SELECTOR = [
    "#channel-name #text",
    ".ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelMetadataText",
  ].join(", ");

  const PROCESSED_FLAG = "iyrProcessed";

  const PANEL_STATE = Symbol("iyrPanelState");

  const SCAN_DEBOUNCE_MS = 150;

  const UNIT_FACTORS = {
    億: 1e8,
    万: 1e4,
    千: 1e3,
    k: 1e3,
    m: 1e6,
    b: 1e9,
  };

  const VIEW_COUNT_PATTERN = /([\d,]+(?:\.\d+)?)\s*(億|万|千|[KMB])?\s*(?:回\s*視聴|\bviews?\b)/i;

  const ZERO_VIEW_PATTERN = /視聴回数なし|\bno views\b/i;

  const log = (...args) => {
    if (OPTIONS.debug) console.log("[clean-youtube-recommendations]", ...args);
  };

  const textOf = (element) => (element?.getAttribute("aria-label") || element?.textContent || "").trim();

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

  const findPublished = (viewCountElement) => {
    const row = viewCountElement.parentElement;
    if (!row) return null;

    const others = [...row.querySelectorAll(VIEW_COUNT_SELECTOR)].filter((element) => element !== viewCountElement);
    const text = textOf(others[others.length - 1]);
    return text && parseViewCount(text) === null ? text : null;
  };

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
    panel.open = false;

    const summary = document.createElement("summary");
    const list = document.createElement("ol");
    list.className = "iyr-removed__list";

    panel.append(summary, list);
    return { panel, summary, list };
  };

  const panelStates = new Set();

  const ensurePanel = (container) => {
    let state = container[PANEL_STATE];
    if (!state) {
      injectPanelStyle();
      state = { ...createPanel(), container, entries: [] };
      container[PANEL_STATE] = state;
      panelStates.add(state);
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

  const clearPanels = () => {
    for (const state of panelStates) {
      state.panel.remove();
      delete state.container[PANEL_STATE];
    }
    panelStates.clear();
  };

  const recordRemoval = (card, viewCount) => {
    const container = card.parentElement;
    if (!container) return;

    const state = ensurePanel(container);
    state.entries.push(readCardInfo(card, viewCount));
    renderPanel(state);
  };

  const processCard = (card) => {
    if (card.dataset[PROCESSED_FLAG]) return;

    const viewCount = findViewCount(card);

    if (viewCount === null) return;

    card.dataset[PROCESSED_FLAG] = "1";

    if (viewCount.count > OPTIONS.viewCountThreshold) {
      log("残す:", viewCount.count, textOf(card.querySelector(TITLE_SELECTOR)));
      return;
    }

    log("削除:", viewCount.count, textOf(card.querySelector(TITLE_SELECTOR)));
    if (OPTIONS.verbose) recordRemoval(card, viewCount);
    card.remove();
  };

  const currentPageKey = () => `${location.pathname}?${new URLSearchParams(location.search).get("v") ?? ""}`;

  let pageKey = currentPageKey();

  const syncPage = () => {
    const key = currentPageKey();
    if (key === pageKey) return;

    log("ページ切り替えを検知:", pageKey, "->", key);
    pageKey = key;
    clearPanels();
  };

  const scan = () => {
    syncPage();

    const listContainers = new Set();

    for (const container of document.querySelectorAll(CONTAINER_SELECTOR)) {
      for (const card of container.querySelectorAll(CARD_SELECTOR)) {
        if (card.parentElement?.[PANEL_STATE]) listContainers.add(card.parentElement);
        processCard(card);
      }
    }

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

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) {
      scheduleScan();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("yt-navigate-finish", scheduleScan);
  window.addEventListener("yt-page-data-updated", scheduleScan);

  scheduleScan();
})();
