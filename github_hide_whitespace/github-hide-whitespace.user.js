// ==UserScript==
// @name         GitHub Hide Whitespace
// @namespace    https://github.com/ToshihiroOgino/custom_scripts
// @version      1.0.0
// @description  GitHub の diff ページで空白の変更を常に非表示にする
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

  const DIFF_PATH = /^\/[^/]+\/[^/]+\/(pull\/\d+\/(changes|files)|commit\/[0-9a-f]+|compare\/.+)$/;

  const apply = () => {
    if (!DIFF_PATH.test(location.pathname)) return;
    const url = new URL(location.href);
    if (url.searchParams.has("w")) return;
    url.searchParams.set("w", "1");
    location.replace(url.toString());
  };

  apply();
  document.addEventListener("turbo:load", apply);
  window.addEventListener("popstate", apply);
})();
