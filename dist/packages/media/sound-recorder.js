import { el, button } from "../core/dom.js";
import {
  DOCUMENTS,
  clamp,
  report,
  guarded,
  readAsDataURL,
  dataURLToBlob,
  mediaFileContent,
  exportBlob,
  timeLabel,
  filenameExtension,
  discardChanges,
  writeWav,
  sampleWav,
} from "./shared.js";

export const soundRecorder = {
  id: "soundrecorder",
  title: "Sound Recorder",
  icon: "soundrecorder",
  width: 470,
  height: 290,
  minWidth: 365,
  minHeight: 245,
  create(ctx, args = {}) {
    const { os, content } = ctx;
    content.classList.add("sr-app");
    let blob = null,
      decoded = null,
      path = "",
      filename = "UNTITLED.WAV",
      dirty = false,
      destroyed = false;
    let recorder = null,
      stream = null,
      captureContext = null,
      analyser = null,
      samples = null,
      chunks = [];
    let recordingStarted = 0,
      pausedAt = 0,
      pauseTotal = 0,
      knownDuration = 0,
      finishPromise = null,
      finishResolve = null;
    let saveFormat = "wav",
      decoding = null,
      revision = 0;
    const contexts = new Set();
    const audio = el("audio", { preload: "metadata" });
    const wave = el("canvas", {
      class: "sr-wave sunken",
      width: 420,
      height: 70,
      "aria-label": "Recorded sound waveform",
    });
    const waveContext = wave.getContext("2d");
    const position = el(
      "span",
      { class: "sr-position sunken" },
      "Position: 0.00 sec.",
    );
    const length = el(
      "span",
      { class: "sr-length sunken" },
      "Length: 0.00 sec.",
    );
    const seek = el("input", {
      class: "sr-seek",
      type: "range",
      min: 0,
      max: 1000,
      value: 0,
      step: 1,
      "aria-label": "Sound position",
    });
    const controls = el("div", { class: "sr-transport" });
    const action = (fn) => guarded(os, fn, "Sound Recorder");
    function control(label, title, fn) {
      const node = button(label, action(fn), {
        class: "win-button sr-control",
        title,
        "aria-label": title,
      });
      controls.append(node);
      return node;
    }
    const startButton = control("|◄", "Beginning", () => setPosition(0));
    const backButton = control("◄◄", "Back 5 seconds", () =>
      setPosition(audio.currentTime - 5),
    );
    const playButton = control("►", "Play", async () => {
      if (blob) {
        if (audio.ended) setPosition(0);
        await audio.play();
      }
    });
    const stopButton = control("■", "Stop", async () => {
      if (isRecording()) await stopRecording();
      else {
        audio.pause();
        setPosition(0);
      }
    });
    const recordButton = control(
      el("span", { class: "sr-record-dot", "aria-hidden": "true" }),
      "Record a new sound",
      startRecording,
    );
    const pauseButton = control("Ⅱ", "Pause or resume", pause);
    const endButton = control("►|", "End", () => setPosition(duration()));
    const state = el("span", {}, "Ready");
    const format = el("span", {}, "PCM WAV");
    const status = el("div", { class: "statusbar sr-status" }, state, format);
    const input = el("input", {
      type: "file",
      accept: "audio/*",
      hidden: true,
    });
    content.append(
      el("div", { class: "sr-wave-area" }, wave),
      el("div", { class: "sr-counters" }, position, length),
      seek,
      controls,
      status,
      audio,
      input,
    );

    function title() {
      ctx.setTitle(`${filename}${dirty ? " *" : ""} - Sound Recorder`);
    }
    function isRecording() {
      return Boolean(recorder && recorder.state !== "inactive");
    }
    function recordElapsed() {
      return Math.max(
        0,
        ((pausedAt || performance.now()) - recordingStarted - pauseTotal) /
          1000,
      );
    }
    function duration() {
      return (
        decoded?.duration ||
        (Number.isFinite(audio.duration) ? audio.duration : knownDuration) ||
        0
      );
    }
    function setPosition(value) {
      if (blob && !isRecording()) {
        audio.currentTime = clamp(value, 0, duration());
        update();
      }
    }
    function update() {
      if (destroyed) return;
      const recording = isRecording(),
        total = recording ? recordElapsed() : duration(),
        current = recording ? total : audio.currentTime || 0;
      position.textContent = `Position: ${current.toFixed(2)} sec.`;
      length.textContent = `Length: ${total.toFixed(2)} sec.`;
      seek.disabled = !blob || recording || !total;
      seek.value = total ? Math.round((current / total) * 1000) : 0;
      state.textContent = recording
        ? recorder.state === "paused"
          ? "Recording paused"
          : "Recording..."
        : !audio.paused
          ? "Playing"
          : blob
            ? audio.currentTime
              ? "Paused"
              : "Stopped"
            : "Ready";
      format.textContent = saveFormat === "wav" ? "PCM WAV" : "Original format";
      [startButton, backButton, playButton, endButton].forEach((node) => {
        node.disabled = !blob || recording;
      });
      recordButton.disabled = recording;
      recordButton.classList.toggle("is-down", recording);
      stopButton.disabled = !blob && !recording;
      pauseButton.disabled = !recording && (!blob || audio.paused);
      pauseButton.classList.toggle(
        "is-down",
        recording && recorder.state === "paused",
      );
      playButton.classList.toggle("is-down", !audio.paused);
      drawWave();
    }
    function drawWave() {
      const width = wave.width,
        height = wave.height;
      waveContext.fillStyle = "#000000";
      waveContext.fillRect(0, 0, width, height);
      waveContext.strokeStyle = "#004000";
      waveContext.lineWidth = 1;
      for (let x = 0; x < width; x += 35) {
        waveContext.beginPath();
        waveContext.moveTo(x + 0.5, 0);
        waveContext.lineTo(x + 0.5, height);
        waveContext.stroke();
      }
      waveContext.strokeStyle = "#00ff00";
      waveContext.beginPath();
      if (isRecording() && analyser && samples) {
        analyser.getByteTimeDomainData(samples);
        for (let x = 0; x < width; x++) {
          const value =
              samples[Math.floor((x / width) * samples.length)] / 128 - 1,
            y = height / 2 - value * height * 0.44;
          if (x) waveContext.lineTo(x, y);
          else waveContext.moveTo(x, y);
        }
      } else if (decoded) {
        const values = decoded.getChannelData(0),
          stride = Math.max(1, Math.floor(values.length / width));
        for (let x = 0; x < width; x++) {
          let min = 0,
            max = 0;
          const start = Math.floor((x / width) * values.length),
            end = Math.min(values.length, start + stride);
          for (let i = start; i < end; i++) {
            min = Math.min(min, values[i]);
            max = Math.max(max, values[i]);
          }
          waveContext.moveTo(x + 0.5, height / 2 - max * height * 0.45);
          waveContext.lineTo(x + 0.5, height / 2 - min * height * 0.45 + 0.5);
        }
      } else {
        waveContext.moveTo(0, height / 2 + 0.5);
        waveContext.lineTo(width, height / 2 + 0.5);
      }
      waveContext.stroke();
      if (!isRecording() && duration() && audio.currentTime) {
        const x = (audio.currentTime / duration()) * width;
        waveContext.strokeStyle = "#ffffff";
        waveContext.beginPath();
        waveContext.moveTo(x, 0);
        waveContext.lineTo(x, height);
        waveContext.stroke();
      }
    }
    async function decodeCurrent() {
      if (decoded) return decoded;
      if (decoding) return decoding;
      if (!blob) throw new Error("There is no sound to edit or save.");
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass)
        throw new Error(
          "This browser cannot decode audio for PCM WAV conversion. Choose Original Format to save the recording.",
        );
      const sourceBlob = blob,
        sourceRevision = revision;
      const decoder = new AudioContextClass();
      contexts.add(decoder);
      const pending = (async () => {
        try {
          const buffer = await decoder.decodeAudioData(
            await sourceBlob.arrayBuffer(),
          );
          if (sourceRevision === revision && !destroyed) {
            decoded = buffer;
            knownDuration = buffer.duration;
            update();
          }
          return buffer;
        } finally {
          contexts.delete(decoder);
          await decoder.close().catch(() => {});
        }
      })();
      decoding = pending;
      try {
        return await pending;
      } catch (_) {
        throw new Error(
          "This sound cannot be decoded as PCM WAV by your browser. You can save or export it using Original Format.",
        );
      } finally {
        if (decoding === pending) decoding = null;
      }
    }
    async function loadSound(
      soundBlob,
      name = "UNTITLED.WAV",
      sourcePath = "",
      modified = false,
      lengthHint = 0,
    ) {
      const nextRevision = ++revision;
      const data = await readAsDataURL(soundBlob);
      if (destroyed || nextRevision !== revision) return;
      audio.pause();
      blob = soundBlob;
      decoded = null;
      decoding = null;
      knownDuration = lengthHint;
      filename = name;
      path = sourcePath;
      dirty = modified;
      audio.src = data;
      audio.load();
      title();
      setMenus();
      update();
      decodeCurrent().catch(() => {});
    }
    async function cleanupCapture() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      analyser = null;
      samples = null;
      if (captureContext) {
        const context = captureContext;
        captureContext = null;
        contexts.delete(context);
        await context.close().catch(() => {});
      }
    }
    async function startRecording() {
      if (isRecording()) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Microphone recording requires a browser with MediaRecorder support and a secure connection. Imported audio can still be played and saved.",
        );
      if (!(await canDiscard())) return;
      audio.pause();
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (destroyed) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = microphone;
      try {
        const supported = [
          "audio/webm;codecs=opus",
          "audio/ogg;codecs=opus",
          "audio/webm",
          "audio/mp4",
        ].find((type) => MediaRecorder.isTypeSupported(type));
        recorder = supported
          ? new MediaRecorder(stream, { mimeType: supported })
          : new MediaRecorder(stream);
        const currentRecorder = recorder;
        chunks = [];
        recordingStarted = performance.now();
        pausedAt = 0;
        pauseTotal = 0;
        finishPromise = new Promise((resolve) => {
          finishResolve = resolve;
        });
        currentRecorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        currentRecorder.onerror = (event) => {
          if (!destroyed)
            report(
              os,
              event.error || new Error("The microphone recording failed."),
              "Sound Recorder",
            );
          cleanupCapture();
          finishResolve?.();
        };
        currentRecorder.onstop = async () => {
          const recordedLength = recordElapsed();
          const recorded = new Blob(chunks, {
            type: currentRecorder.mimeType || chunks[0]?.type || "audio/webm",
          });
          const extension = recorded.type.includes("ogg")
            ? "OGG"
            : recorded.type.includes("mp4")
              ? "M4A"
              : "WEBM";
          chunks = [];
          await cleanupCapture();
          try {
            if (!destroyed && recorded.size)
              await loadSound(
                recorded,
                `UNTITLED.${extension}`,
                "",
                true,
                recordedLength,
              );
          } catch (error) {
            if (!destroyed) await report(os, error, "Sound Recorder");
          } finally {
            finishResolve?.();
            finishResolve = null;
            update();
            setMenus();
          }
        };
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          captureContext = new AudioContextClass();
          contexts.add(captureContext);
          await captureContext.resume();
          analyser = captureContext.createAnalyser();
          analyser.fftSize = 512;
          samples = new Uint8Array(analyser.fftSize);
          captureContext.createMediaStreamSource(stream).connect(analyser);
        }
        currentRecorder.start(200);
        update();
        setMenus();
      } catch (error) {
        await cleanupCapture();
        recorder = null;
        throw error;
      }
    }
    async function stopRecording() {
      if (!isRecording()) return finishPromise;
      recorder.stop();
      await finishPromise;
    }
    function pause() {
      if (isRecording()) {
        if (recorder.state === "paused") {
          pauseTotal += performance.now() - pausedAt;
          pausedAt = 0;
          recorder.resume();
        } else {
          pausedAt = performance.now();
          recorder.pause();
        }
      } else audio.pause();
      update();
    }
    async function outputSound(formatName = saveFormat) {
      if (isRecording()) await stopRecording();
      if (!blob) throw new Error("Record or open a sound first.");
      if (formatName === "wav")
        return { blob: writeWav(await decodeCurrent()), extension: "WAV" };
      const type = blob.type;
      return {
        blob,
        extension: type.includes("wav")
          ? "WAV"
          : type.includes("ogg")
            ? "OGG"
            : type.includes("mp4")
              ? "M4A"
              : type.includes("mpeg")
                ? "MP3"
                : type.includes("webm")
                  ? "WEBM"
                  : (filename.split(".").pop() || "AUDIO").toUpperCase(),
      };
    }
    async function save(as = false) {
      const output = await outputSound();
      const suggested = filenameExtension(
        path || DOCUMENTS + filename,
        output.extension,
      );
      const destination =
        !as &&
        path &&
        path.toLowerCase().endsWith("." + output.extension.toLowerCase())
          ? path
          : await os.pickFile({
              title: "Save Sound As",
              save: true,
              filename: suggested,
            });
      if (!destination) return false;
      os.fs.writeFile(destination, await readAsDataURL(output.blob));
      path = destination;
      filename = os.fs.basename(destination);
      dirty = false;
      title();
      return true;
    }
    async function exportSound(formatName = saveFormat) {
      const output = await outputSound(formatName);
      await exportBlob(
        filenameExtension(filename, output.extension),
        output.blob,
      );
    }
    async function canDiscard() {
      return discardChanges(os, dirty, "Sound Recorder", save);
    }
    async function newSound() {
      if (isRecording()) await stopRecording();
      if (!(await canDiscard())) return;
      revision++;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      blob = null;
      decoded = null;
      decoding = null;
      path = "";
      filename = "UNTITLED.WAV";
      dirty = false;
      knownDuration = 0;
      title();
      update();
      setMenus();
    }
    async function openSound() {
      if (isRecording()) await stopRecording();
      if (!(await canDiscard())) return;
      const selected = await os.pickFile({ title: "Open Sound" });
      if (selected)
        await loadSound(
          dataURLToBlob(mediaFileContent(os.fs.readFile(selected))),
          os.fs.basename(selected),
          selected,
        );
    }
    async function importSound() {
      if (isRecording()) await stopRecording();
      if (await canDiscard()) input.click();
    }
    input.addEventListener(
      "change",
      action(async () => {
        const file = input.files?.[0];
        input.value = "";
        if (file) await loadSound(file, file.name, "", true);
      }),
    );
    async function editSound(kind) {
      if (isRecording()) await stopRecording();
      audio.pause();
      const buffer = await decodeCurrent();
      const position = Math.floor(
        clamp(audio.currentTime, 0, buffer.duration) * buffer.sampleRate,
      );
      let begin = kind === "before" ? position : 0,
        end = kind === "after" ? position : buffer.length;
      if (end <= begin)
        throw new Error(
          "This edit would leave an empty sound. Move the playback position, or choose File New to clear the sound.",
        );
      const channels = Math.min(buffer.numberOfChannels, 2),
        length = end - begin;
      const newData = Array.from({ length: channels }, (_, channel) => {
        const old = buffer.getChannelData(channel),
          data = new Float32Array(length);
        for (let i = 0; i < length; i++) {
          let value = old[kind === "reverse" ? end - i - 1 : begin + i];
          if (kind === "louder") value *= 1.25;
          if (kind === "quieter") value *= 0.8;
          data[i] = clamp(value, -1, 1);
        }
        return data;
      });
      const edited = {
        numberOfChannels: channels,
        sampleRate: buffer.sampleRate,
        length,
        duration: length / buffer.sampleRate,
        getChannelData: (channel) => newData[channel],
      };
      await loadSound(
        writeWav(edited),
        filenameExtension(filename, "WAV"),
        "",
        true,
        edited.duration,
      );
      decoded = edited;
      update();
    }
    function setMenus() {
      if (destroyed) return;
      const available = Boolean(blob) && !isRecording();
      ctx.setMenu([
        {
          label: "&File",
          items: [
            { label: "&New", shortcut: "Ctrl+N", action: action(newSound) },
            {
              label: "&Open...",
              shortcut: "Ctrl+O",
              action: action(openSound),
            },
            { label: "&Import Sound...", action: action(importSound) },
            { separator: true },
            {
              label: "&Save",
              shortcut: "Ctrl+S",
              action: action(() => save()),
              disabled: !blob && !isRecording(),
            },
            {
              label: "Save &As...",
              action: action(() => save(true)),
              disabled: !blob && !isRecording(),
            },
            {
              label: "&Export Sound...",
              action: action(() => exportSound()),
              disabled: !blob && !isRecording(),
            },
            {
              label: "Export &PCM WAV...",
              action: action(() => exportSound("wav")),
              disabled: !blob && !isRecording(),
            },
            { separator: true },
            { label: "E&xit", action: () => ctx.win.close() },
          ],
        },
        {
          label: "&Edit",
          items: [
            {
              label: "Delete &Before Current Position",
              action: action(() => editSound("before")),
              disabled: !available,
            },
            {
              label: "Delete &After Current Position",
              action: action(() => editSound("after")),
              disabled: !available,
            },
          ],
        },
        {
          label: "E&ffects",
          items: [
            {
              label: "&Increase Volume (25%)",
              action: action(() => editSound("louder")),
              disabled: !available,
            },
            {
              label: "&Decrease Volume (20%)",
              action: action(() => editSound("quieter")),
              disabled: !available,
            },
            {
              label: "&Reverse",
              action: action(() => editSound("reverse")),
              disabled: !available,
            },
          ],
        },
        {
          label: "&Options",
          items: [
            {
              label: "Save as &PCM WAV",
              checked: saveFormat === "wav",
              action: () => {
                saveFormat = "wav";
                setMenus();
                update();
              },
            },
            {
              label: "Save in &Original Format",
              checked: saveFormat === "original",
              action: () => {
                saveFormat = "original";
                setMenus();
                update();
              },
            },
            { separator: true },
            {
              label: "Open &Sample Sound",
              action: action(async () => {
                if (isRecording()) await stopRecording();
                if (await canDiscard())
                  await loadSound(
                    dataURLToBlob(await sampleWav()),
                    "CANYON.WAV",
                  );
              }),
            },
          ],
        },
        {
          label: "&Help",
          items: [
            {
              label: "&Help Topics",
              action: () =>
                os.message(
                  "Press the red Record button to request microphone access and record a new sound. Stop completes the recording. Play, Pause, and the position slider control playback. PCM WAV export decodes the recorded sound and writes real 16-bit PCM samples. Choose Original Format to preserve the browser’s recorded WebM, Ogg, or other supported format. Editing applies to the audio samples.",
                  "Sound Recorder Help",
                ),
            },
            {
              label: "&About Sound Recorder...",
              action: () =>
                os.about(
                  "Sound Recorder",
                  "Microphone capture through the browser, native audio playback, waveform display, sample edits, and real PCM WAV or original-format export.",
                ),
            },
          ],
        },
      ]);
    }
    const mediaEvents = [
      "timeupdate",
      "loadedmetadata",
      "durationchange",
      "play",
      "pause",
      "ended",
      "error",
    ];
    mediaEvents.forEach((event) => audio.addEventListener(event, update));
    seek.addEventListener("input", () =>
      setPosition((Number(seek.value) / 1000) * duration()),
    );
    const timer = setInterval(update, 80);
    ctx.onClose(async () => {
      if (isRecording()) await stopRecording();
      return canDiscard();
    });
    ctx.cleanup(() => {
      destroyed = true;
      revision++;
      clearInterval(timer);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      mediaEvents.forEach((event) => audio.removeEventListener(event, update));
      if (isRecording()) recorder.stop();
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      contexts.forEach((context) => context.close().catch(() => {}));
      contexts.clear();
      finishResolve?.();
      finishResolve = null;
    });
    title();
    setMenus();
    update();
    if (args.path || args.file)
      action(() => {
        const selected = args.path || args.file;
        return loadSound(
          dataURLToBlob(mediaFileContent(os.fs.readFile(selected))),
          os.fs.basename(selected),
          selected,
        );
      })();
  },
};
