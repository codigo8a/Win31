import { el } from "../core/dom.js";

export const DOCUMENTS = "C:\\DOCUMENTS\\";
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const report = (os, error, title = "Windows") =>
  os.message(error?.message || String(error), title);
export const guarded =
  (os, action, title) =>
  (...args) =>
    Promise.resolve()
      .then(() => action(...args))
      .catch((error) => report(os, error, title));

export function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error || new Error("The file could not be read."));
    reader.readAsDataURL(blob);
  });
}

export function dataURLToBlob(dataURL) {
  const match = /^data:([^,]*),([\s\S]*)$/i.exec(dataURL);
  if (!match)
    throw new Error(
      "This file does not contain supported embedded media. Use Import to choose a file from your computer.",
    );
  const encoded = /(?:^|;)base64(?:;|$)/i.test(match[1]);
  const mime = match[1].replace(/(?:^|;)base64(?=;|$)/i, "");
  const binary = encoded ? atob(match[2]) : decodeURIComponent(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

export function mediaFileContent(raw) {
  if (typeof raw !== "string")
    throw new Error("The selected file is not a supported media file.");
  if (raw.startsWith("data:")) return raw;
  try {
    const parsed = JSON.parse(raw);
    const value = parsed.dataURL || parsed.dataUrl || parsed.content;
    if (typeof value === "string" && value.startsWith("data:")) return value;
  } catch (_) {
    /* Text files are not media. */
  }
  throw new Error(
    "This file is not an embedded image, sound, or video. Use Import to choose an original media file.",
  );
}

export function exportDataURL(filename, dataURL) {
  const link = el("a", { href: dataURL, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
}

export async function exportBlob(filename, blob) {
  exportDataURL(filename, await readAsDataURL(blob));
}

export function timeLabel(seconds, fractions = false) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const secs = Math.floor(seconds) % 60;
  const base = `${hours ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return fractions
    ? `${base}.${Math.floor((seconds % 1) * 100)
        .toString()
        .padStart(2, "0")}`
    : base;
}

export function filenameExtension(filename, extension) {
  return (
    String(filename || "UNTITLED").replace(/\.[^./\\]+$/, "") +
    "." +
    extension.toUpperCase()
  );
}

export async function discardChanges(os, dirty, title, save) {
  if (!dirty) return true;
  const choice = await os.dialog({
    title,
    body: "Save changes before continuing?",
    buttons: [
      { label: "Yes", value: "save", default: true },
      { label: "No", value: "discard" },
      { label: "Cancel", value: "cancel" },
    ],
    width: 330,
  });
  if (choice === "save") return Boolean(await save());
  return choice === "discard";
}

export function writeWav(buffer) {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const samples = buffer.length;
  const result = new ArrayBuffer(44 + samples * channels * 2);
  const view = new DataView(result);
  const chars = (offset, text) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i));
  };
  chars(0, "RIFF");
  view.setUint32(4, result.byteLength - 8, true);
  chars(8, "WAVE");
  chars(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  chars(36, "data");
  view.setUint32(40, samples * channels * 2, true);
  const data = Array.from({ length: channels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  let offset = 44;
  for (let i = 0; i < samples; i++)
    for (let channel = 0; channel < channels; channel++) {
      const value = clamp(data[channel][i], -1, 1);
      view.setInt16(offset, value < 0 ? value * 32768 : value * 32767, true);
      offset += 2;
    }
  return new Blob([result], { type: "audio/wav" });
}

let sampleSound;
export async function sampleWav() {
  if (sampleSound) return sampleSound;
  const sampleRate = 22050;
  const notes = [
    261.63, 329.63, 392, 523.25, 493.88, 392, 329.63, 293.66, 349.23, 440,
    523.25, 587.33, 523.25, 440, 392, 523.25,
  ];
  const beat = 0.3;
  const length = Math.ceil(sampleRate * (notes.length * beat + 0.55));
  const samples = new Float32Array(length);
  notes.forEach((frequency, note) => {
    const begin = Math.floor(note * beat * sampleRate);
    const noteLength = Math.floor(0.45 * sampleRate);
    for (let i = 0; i < noteLength && begin + i < samples.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, t / 0.008) * Math.exp(-t * 10);
      samples[begin + i] +=
        (Math.sin(2 * Math.PI * frequency * t) +
          0.25 * Math.sin(2 * Math.PI * frequency * 2 * t)) *
        envelope *
        0.28;
    }
  });
  sampleSound = await readAsDataURL(
    writeWav({
      numberOfChannels: 1,
      sampleRate,
      length,
      getChannelData: () => samples,
    }),
  );
  return sampleSound;
}

export function scopedKeys(ctx, handler) {
  const listener = (event) => {
    if (
      event.defaultPrevented ||
      event.target.closest('input,textarea,select,[contenteditable="true"]')
    )
      return;
    handler(event);
  };
  ctx.win.element.addEventListener("keydown", listener);
  ctx.cleanup(() => ctx.win.element.removeEventListener("keydown", listener));
}
