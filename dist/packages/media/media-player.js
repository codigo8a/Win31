import { el, button } from "../core/dom.js";
import {
  DOCUMENTS,
  clamp,
  report,
  guarded,
  readAsDataURL,
  mediaFileContent,
  exportDataURL,
  sampleWav,
  timeLabel,
  scopedKeys,
} from "./shared.js";

export const mediaPlayer = {
  id: "mediaplayer",
  title: "Media Player",
  icon: "mediaplayer",
  width: 530,
  height: 300,
  minWidth: 360,
  minHeight: 230,
  create(ctx, args = {}) {
    const { os, content } = ctx;
    content.classList.add("mp-app");
    let dataURL = "",
      filename = "",
      path = "",
      media,
      destroyed = false,
      loop = false,
      speed = 1,
      opening = 0;
    const video = el("video", {
      class: "mp-video sunken",
      preload: "metadata",
      playsInline: true,
    });
    const audio = el("audio", { preload: "metadata" });
    media = audio;
    const trackTitle = el(
      "span",
      { class: "mp-track-title" },
      "No media loaded",
    );
    const trackDetail = el(
      "span",
      { class: "mp-track-detail" },
      "Choose File Open or Device Sample Melody.",
    );
    const audioCard = el(
      "div",
      { class: "mp-audio-card sunken" },
      el(
        "div",
        { class: "mp-sound-symbol", "aria-hidden": "true" },
        el("i"),
        el("i"),
        el("i"),
        el("i"),
        el("i"),
        el("i"),
        el("i"),
      ),
      trackTitle,
      trackDetail,
    );
    const display = el("div", { class: "mp-display" }, video, audioCard);
    const elapsed = el(
      "span",
      { class: "mp-time-readout sunken" },
      "00:00 / 00:00",
    );
    const seek = el("input", {
      class: "mp-seek",
      type: "range",
      min: 0,
      max: 1000,
      step: 1,
      value: 0,
      "aria-label": "Playback position",
    });
    const markerRow = el(
      "div",
      { class: "mp-markers" },
      el("span", {}, "0"),
      el("span", {}, "¼"),
      el("span", {}, "½"),
      el("span", {}, "¾"),
      el("span", {}, "End"),
    );
    const seekPanel = el("div", { class: "mp-seek-panel" }, seek, markerRow);
    const controls = el("div", { class: "mp-transport" });
    const controlButtons = [];
    function transport(label, title, action) {
      const node = button(label, guarded(os, action, "Media Player"), {
        class: "win-button mp-control",
        title,
        "aria-label": title,
      });
      controls.append(node);
      controlButtons.push(node);
      return node;
    }
    transport("|◄", "Beginning", () => seekTo(0));
    transport("◄◄", "Back 5 seconds", () => seekTo(media.currentTime - 5));
    const playButton = transport("►", "Play", play);
    const pauseButton = transport("Ⅱ", "Pause", () => media.pause());
    transport("■", "Stop", stop);
    transport("►►", "Forward 5 seconds", () => seekTo(media.currentTime + 5));
    transport("►|", "End", () => seekTo(media.duration));
    const volume = el("input", {
      type: "range",
      min: 0,
      max: 100,
      step: 1,
      value: 75,
      class: "mp-volume",
      "aria-label": "Volume",
    });
    const muteButton = button(
      "Vol",
      () => {
        media.muted = !media.muted;
        update();
      },
      {
        class: "win-button mp-mute",
        title: "Mute sound",
        "aria-label": "Mute sound",
      },
    );
    const stateText = el("span", {}, "Stopped");
    const typeText = el("span", {}, "Media Player");
    const status = el(
      "div",
      { class: "statusbar mp-status" },
      stateText,
      typeText,
    );
    const importInput = el("input", {
      type: "file",
      accept: "audio/*,video/*",
      hidden: true,
    });
    content.append(
      display,
      seekPanel,
      el("div", { class: "mp-controls-row" }, controls, elapsed),
      el("div", { class: "mp-volume-row" }, muteButton, volume),
      status,
      audio,
      importInput,
    );
    video.hidden = true;
    function seekTo(value) {
      if (Number.isFinite(media.duration))
        media.currentTime = clamp(
          Number.isFinite(value) ? value : 0,
          0,
          media.duration,
        );
      update();
    }
    async function play() {
      if (!dataURL) await loadSample();
      if (!destroyed && dataURL) await media.play();
    }
    function stop() {
      media.pause();
      seekTo(0);
      update();
    }
    function update() {
      if (destroyed) return;
      const duration = Number.isFinite(media.duration) ? media.duration : 0;
      seek.disabled = !duration;
      seek.value = duration
        ? Math.round((media.currentTime / duration) * 1000)
        : 0;
      elapsed.textContent = `${timeLabel(media.currentTime)} / ${timeLabel(duration)}`;
      stateText.textContent = !dataURL
        ? "Ready"
        : media.error
          ? "Format not supported"
          : media.ended
            ? "Finished"
            : media.paused
              ? media.currentTime
                ? "Paused"
                : "Stopped"
              : "Playing";
      typeText.textContent = `${media === video ? "Video" : "Sound"}${loop ? " · Repeat" : ""}${speed !== 1 ? ` · ${speed}×` : ""}`;
      pauseButton.disabled = media.paused;
      playButton.classList.toggle("is-down", !media.paused);
      muteButton.classList.toggle("is-down", media.muted);
      muteButton.textContent = media.muted ? "Mute" : "Vol";
      controlButtons.forEach((node) => {
        if (node !== playButton && node !== pauseButton)
          node.disabled = !dataURL;
      });
      audioCard.classList.toggle("mp-playing", !media.paused);
      volume.value = Math.round(media.volume * 100);
    }
    seek.addEventListener("input", () => {
      if (Number.isFinite(media.duration))
        seekTo((Number(seek.value) / 1000) * media.duration);
    });
    volume.addEventListener("input", () => {
      audio.volume = video.volume = Number(volume.value) / 100;
      media.muted = false;
      update();
    });
    audio.volume = video.volume = 0.75;
    const events = [
      "timeupdate",
      "durationchange",
      "loadedmetadata",
      "ended",
      "play",
      "pause",
      "volumechange",
      "ratechange",
      "error",
      "emptied",
    ];
    events.forEach((type) => {
      audio.addEventListener(type, update);
      video.addEventListener(type, update);
    });
    async function load(data, name, sourcePath = "") {
      if (destroyed) return;
      opening++;
      if (!/^data:(audio|video|application\/octet-stream)/i.test(data))
        throw new Error(
          "Select a supported audio or video file. Browser codec support determines which formats can play.",
        );
      audio.pause();
      video.pause();
      audio.removeAttribute("src");
      video.removeAttribute("src");
      audio.load();
      video.load();
      const mime = data.slice(
        5,
        data.indexOf(";") > 0 ? data.indexOf(";") : data.indexOf(","),
      );
      const isVideo =
        mime.startsWith("video/") ||
        (!mime.startsWith("audio/") && /\.(mp4|m4v|mov|ogv|webm)$/i.test(name));
      media = isVideo ? video : audio;
      media.src = data;
      media.loop = loop;
      media.playbackRate = speed;
      dataURL = data;
      filename = name || (isVideo ? "UNTITLED.MP4" : "UNTITLED.WAV");
      path = sourcePath;
      trackTitle.textContent = filename;
      trackDetail.textContent =
        mime.replace(/^audio\//, "").toUpperCase() + " audio";
      video.hidden = !isVideo;
      audioCard.hidden = isVideo;
      ctx.setTitle(`${filename} - Media Player`);
      media.load();
      update();
      setMenus();
    }
    async function loadSample() {
      const token = ++opening;
      const sample = await sampleWav();
      if (destroyed || token !== opening) return;
      await load(sample, "CANYON.WAV");
      trackDetail.textContent = "Locally synthesized PCM sample melody";
    }
    async function openFile() {
      const selected = await os.pickFile({ title: "Open Media File" });
      if (selected)
        await load(
          mediaFileContent(os.fs.readFile(selected)),
          os.fs.basename(selected),
          selected,
        );
    }
    importInput.addEventListener(
      "change",
      guarded(
        os,
        async () => {
          const file = importInput.files?.[0];
          importInput.value = "";
          if (file) await load(await readAsDataURL(file), file.name);
        },
        "Media Player",
      ),
    );
    async function saveFile(as = false) {
      if (!dataURL) return;
      const destination =
        !as && path
          ? path
          : await os.pickFile({
              title: "Save Media As",
              save: true,
              filename: path || DOCUMENTS + filename,
            });
      if (destination) {
        os.fs.writeFile(destination, dataURL);
        path = destination;
        filename = os.fs.basename(path);
        ctx.setTitle(`${filename} - Media Player`);
        trackTitle.textContent = filename;
      }
    }
    function closeMedia() {
      opening++;
      stop();
      audio.removeAttribute("src");
      video.removeAttribute("src");
      audio.load();
      video.load();
      dataURL = "";
      filename = "";
      path = "";
      video.hidden = true;
      audioCard.hidden = false;
      trackTitle.textContent = "No media loaded";
      trackDetail.textContent = "Choose File Open or Device Sample Melody.";
      ctx.setTitle("Media Player");
      setMenus();
      update();
    }
    function changeSpeed(value) {
      speed = value;
      audio.playbackRate = video.playbackRate = value;
      setMenus();
      update();
    }
    function setMenus() {
      const act = (action) => guarded(os, action, "Media Player");
      ctx.setMenu([
        {
          label: "&File",
          items: [
            { label: "&Open...", shortcut: "Ctrl+O", action: act(openFile) },
            { label: "&Import Media...", action: () => importInput.click() },
            {
              label: "&Save As...",
              action: act(() => saveFile(true)),
              disabled: !dataURL,
            },
            {
              label: "&Export Media...",
              action: () => exportDataURL(filename, dataURL),
              disabled: !dataURL,
            },
            { separator: true },
            { label: "&Close Media", action: closeMedia, disabled: !dataURL },
            { label: "E&xit", action: () => ctx.win.close() },
          ],
        },
        {
          label: "&Device",
          items: [
            { label: "&Sample Melody", action: act(loadSample) },
            {
              label: "&Sound Recorder...",
              action: () => os.open("soundrecorder"),
            },
            {
              label: "Supported &Formats...",
              action: () =>
                os.message(
                  "Media Player uses your browser’s native audio and video support. Common formats include WAV, MP3, Ogg, WebM, and MP4 when the browser supplies the needed codec. Import opens a file from your computer. Open reads media previously saved or imported to the virtual disk.",
                  "Media Player Formats",
                ),
            },
          ],
        },
        {
          label: "&Control",
          items: [
            { label: "&Play", shortcut: "Space", action: act(play) },
            {
              label: "P&ause",
              action: () => media.pause(),
              disabled: !dataURL,
            },
            { label: "&Stop", action: stop, disabled: !dataURL },
            { label: "&Rewind", action: () => seekTo(0), disabled: !dataURL },
            {
              label: "&End",
              action: () => seekTo(media.duration),
              disabled: !dataURL,
            },
            { separator: true },
            {
              label: "&Repeat",
              checked: loop,
              action: () => {
                loop = !loop;
                audio.loop = video.loop = loop;
                setMenus();
                update();
              },
            },
            {
              label: "Playback S&peed",
              items: [0.5, 1, 1.5, 2].map((value) => ({
                label: `${value}×${value === 1 ? " (Normal)" : ""}`,
                checked: speed === value,
                action: () => changeSpeed(value),
              })),
            },
          ],
        },
        {
          label: "&Help",
          items: [
            {
              label: "&About Media Player...",
              action: () =>
                os.about(
                  "Media Player",
                  "Audio and video playback with real seeking, volume, repeat, and speed controls. The built-in sample is synthesized locally as PCM WAV.",
                ),
            },
          ],
        },
      ]);
    }
    scopedKeys(ctx, (event) => {
      if (event.code === "Space" && !event.target.closest("button")) {
        event.preventDefault();
        if (media.paused) guarded(os, play, "Media Player")();
        else media.pause();
      }
    });
    ctx.cleanup(() => {
      destroyed = true;
      opening++;
      audio.pause();
      video.pause();
      events.forEach((type) => {
        audio.removeEventListener(type, update);
        video.removeEventListener(type, update);
      });
      audio.removeAttribute("src");
      video.removeAttribute("src");
      audio.load();
      video.load();
    });
    setMenus();
    update();
    if (args.path || args.file)
      guarded(
        os,
        () => {
          const selected = args.path || args.file;
          return load(
            mediaFileContent(os.fs.readFile(selected)),
            os.fs.basename(selected),
            selected,
          );
        },
        "Media Player",
      )();
    else if (args.sample) guarded(os, loadSample, "Media Player")();
  },
};
