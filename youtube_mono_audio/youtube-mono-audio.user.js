// ==UserScript==
// @name         YouTube Mono Audio
// @namespace    https://github.com/ToshihiroOgino/custom_scripts
// @version      1.0.0
// @description  YouTube の動画をボタンでモノラル再生に切り替える
// @author       ToshihiroOgino
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// @homepageURL  https://github.com/ToshihiroOgino/custom_scripts
// @supportURL   https://github.com/ToshihiroOgino/custom_scripts/issues
// @downloadURL  https://raw.githubusercontent.com/ToshihiroOgino/custom_scripts/main/youtube_mono_audio/youtube-mono-audio.user.js
// @updateURL    https://raw.githubusercontent.com/ToshihiroOgino/custom_scripts/main/youtube_mono_audio/youtube-mono-audio.user.js
// ==/UserScript==

(() => {
  "use strict";

  const BUTTON_CLASS = "yma-toggle";
  const PLAYER_SELECTOR = "#movie_player, #shorts-player";

  const outputs = new WeakMap();

  let audioContext = null;
  let isMono = false;
  let currentVideoId = null;

  const syncVideo = (player) => {
    const videoId = player?.getPlayerResponse?.()?.videoDetails?.videoId;
    if (!videoId || videoId === currentVideoId) return;

    currentVideoId = videoId;
    isMono = false;
  };

  const setChannels = (node) => {
    node.channelCount = isMono ? 1 : 2;
    node.channelCountMode = isMono ? "explicit" : "max";
  };

  const connect = (video) => {
    const source = audioContext.createMediaElementSource(video);
    const output = audioContext.createGain();
    source.connect(output).connect(audioContext.destination);
    outputs.set(video, output);
    return output;
  };

  const applyAudio = async () => {
    const videos = [...document.querySelectorAll("video")].filter(
      (video) => isMono || outputs.has(video),
    );
    if (videos.length === 0) return;

    audioContext ??= new AudioContext();
    await audioContext.resume();
    for (const video of videos) {
      setChannels(outputs.get(video) ?? connect(video));
    }
  };

  const renderButton = () => {
    const player = document.querySelector("#movie_player");
    const controls =
      player?.querySelector(".ytp-right-controls-left") ??
      player?.querySelector(".ytp-right-controls");
    if (!controls) return;

    let button = player.querySelector(`.${BUTTON_CLASS}`);
    if (!button) {
      button = document.createElement("button");
      button.className = `ytp-button ${BUTTON_CLASS}`;
      button.style.cssText =
        "color: #fff; opacity: 1; font-size: 11px; font-weight: 700; text-align: center; vertical-align: top;";
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        syncVideo(player);
        isMono = !isMono;
        update();
      });
      controls.prepend(button);
    }

    button.textContent = isMono ? "MONO" : "ST";
    button.title = isMono ? "モノラル" : "ステレオ";
  };

  const update = () => {
    renderButton();
    applyAudio().catch((error) => {
      console.error("[youtube-mono-audio]", error);
      isMono = false;
      for (const video of document.querySelectorAll("video")) {
        const output = outputs.get(video);
        if (output) setChannels(output);
      }
      renderButton();
    });
  };

  const handleMediaEvent = (event) => {
    syncVideo(event.target.closest(PLAYER_SELECTOR));
    update();
  };

  for (const type of ["loadeddata", "playing"]) {
    document.addEventListener(type, handleMediaEvent, true);
  }
  window.addEventListener("yt-navigate-finish", update);

  update();
})();
