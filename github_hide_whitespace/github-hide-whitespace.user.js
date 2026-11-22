// ==UserScript==
// @name         GitHub Hide Whitespace
// @namespace    https://github.com/ToshihiroOgino/custom_scripts
// @version      1.1.0
// @description  GitHub の diff ページへのリンクに ?w=1 を付けて空白の変更を非表示にする
// @author       ToshihiroOgino
// @match        https://github.com/*
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/ToshihiroOgino/custom_scripts
// @supportURL   https://github.com/ToshihiroOgino/custom_scripts/issues
// @downloadURL  https://raw.githubusercontent.com/ToshihiroOgino/custom_scripts/main/github_hide_whitespace/github-hide-whitespace.user.js
// @updateURL    https://raw.githubusercontent.com/ToshihiroOgino/custom_scripts/main/github_hide_whitespace/github-hide-whitespace.user.js
// ==/UserScript==

(() => {
  "use strict";

  const DIFF_PATH =
    /^\/[^/]+\/[^/]+\/(pull\/\d+\/(changes|files)(\/.*)?|pull\/\d+\/commits\/[0-9a-f]+|commit\/[0-9a-f]+|compare\/.+)$/;

  const withWhitespaceHidden = (href) => {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return null;
    if (!DIFF_PATH.test(url.pathname) || url.searchParams.has("w")) return null;
    url.searchParams.set("w", "1");
    return url.toString();
  };

  const findAnchor = (event) => {
    const anchor = event.target.closest?.("a[href]");
    return anchor instanceof HTMLAnchorElement ? anchor : null;
  };

  const isPlainClick = (event, anchor) =>
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) &&
    (!anchor.target || anchor.target === "_self");

  const redirect = withWhitespaceHidden(location.href);
  if (redirect) location.replace(redirect);

  document.addEventListener(
    "mousedown",
    (event) => {
      const anchor = findAnchor(event);
      if (!anchor || isPlainClick(event, anchor)) return;
      const target = withWhitespaceHidden(anchor.href);
      if (target) anchor.href = target;
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const anchor = findAnchor(event);
      if (!anchor || !isPlainClick(event, anchor)) return;
      const target = withWhitespaceHidden(anchor.href);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign(target);
    },
    true,
  );
})();
