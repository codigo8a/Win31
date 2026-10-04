import { el } from "../core/dom.js";
import { guarded } from "./shared.js";

export const clock = {
  id: "clock",
  title: "Clock",
  icon: "clock",
  width: 292,
  height: 300,
  minWidth: 185,
  minHeight: 155,
  singleton: true,
  create(ctx) {
    const { os, content } = ctx;
    content.classList.add("clock-app");
    const settings = {
      mode: "analog",
      seconds: true,
      twelveHour: true,
      date: false,
      utc: false,
      face: "#ffffff",
      ink: "#000000",
      ...os.storage.get("media.clock", {}),
    };
    const face = el("canvas", {
      class: "clock-face",
      "aria-label": "Analog clock",
    });
    const digital = el("div", { class: "clock-digital", "aria-live": "off" });
    const date = el("div", { class: "clock-date" });
    content.append(face, digital, date);
    const paint = face.getContext("2d");
    let width = 0,
      height = 0;
    function save() {
      os.storage.set("media.clock", settings);
      setMenus();
      render();
    }
    function render() {
      const now = new Date(
        Date.now() + (Number(os.settings.clockOffsetMs) || 0),
      );
      const hours = settings.utc ? now.getUTCHours() : now.getHours();
      const minutes = settings.utc ? now.getUTCMinutes() : now.getMinutes();
      const seconds = settings.utc ? now.getUTCSeconds() : now.getSeconds();
      const displayHour = settings.twelveHour ? hours % 12 || 12 : hours;
      const text = `${String(displayHour).padStart(settings.twelveHour ? 1 : 2, "0")}:${String(minutes).padStart(2, "0")}${settings.seconds ? ":" + String(seconds).padStart(2, "0") : ""}${settings.twelveHour ? (hours >= 12 ? " PM" : " AM") : ""}`;
      digital.textContent = text;
      face.setAttribute("aria-label", `${text}${settings.utc ? " UTC" : ""}`);
      date.textContent =
        now.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          ...(settings.utc ? { timeZone: "UTC" } : {}),
        }) + (settings.utc ? " UTC" : "");
      face.hidden = settings.mode !== "analog";
      digital.hidden = settings.mode !== "digital";
      date.hidden = !settings.date;
      content.style.backgroundColor = settings.face;
      content.style.color = settings.ink;
      if (settings.mode !== "analog") return;
      const box = face.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(box.width * ratio)),
        nextHeight = Math.max(1, Math.round(box.height * ratio));
      if (nextWidth !== width || nextHeight !== height) {
        width = face.width = nextWidth;
        height = face.height = nextHeight;
      }
      paint.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint.clearRect(0, 0, width / ratio, height / ratio);
      const cx = box.width / 2,
        cy = box.height / 2,
        radius = Math.max(16, Math.min(box.width, box.height) / 2 - 10);
      paint.save();
      paint.translate(cx, cy);
      paint.fillStyle = settings.face;
      paint.strokeStyle = settings.ink;
      paint.beginPath();
      paint.arc(0, 0, radius, 0, Math.PI * 2);
      paint.fill();
      paint.lineWidth = 1;
      paint.stroke();
      for (let i = 0; i < 60; i++) {
        const angle = (i * Math.PI) / 30;
        const inner = radius - (i % 5 === 0 ? 10 : 4);
        paint.beginPath();
        paint.lineWidth = i % 5 === 0 ? 2 : 1;
        paint.moveTo(Math.sin(angle) * inner, -Math.cos(angle) * inner);
        paint.lineTo(
          Math.sin(angle) * (radius - 2),
          -Math.cos(angle) * (radius - 2),
        );
        paint.stroke();
      }
      if (radius > 47) {
        paint.fillStyle = settings.ink;
        paint.textAlign = "center";
        paint.textBaseline = "middle";
        paint.font = `${Math.max(12, Math.round(radius * 0.15))}px "Times New Roman", serif`;
        for (let hour = 1; hour <= 12; hour++) {
          const angle = (hour * Math.PI) / 6;
          paint.fillText(
            String(hour),
            Math.sin(angle) * (radius - 24),
            -Math.cos(angle) * (radius - 24) + 1,
          );
        }
      }
      function hand(angle, length, lineWidth) {
        paint.save();
        paint.rotate(angle);
        paint.beginPath();
        paint.lineWidth = lineWidth;
        paint.lineCap = "round";
        paint.moveTo(0, radius * 0.08);
        paint.lineTo(0, -length);
        paint.stroke();
        paint.restore();
      }
      hand(
        (((hours % 12) + minutes / 60) * Math.PI) / 6,
        radius * 0.49,
        Math.max(3, radius * 0.047),
      );
      hand(
        ((minutes + seconds / 60) * Math.PI) / 30,
        radius * 0.71,
        Math.max(2, radius * 0.031),
      );
      if (settings.seconds) hand((seconds * Math.PI) / 30, radius * 0.8, 1);
      paint.beginPath();
      paint.arc(0, 0, Math.max(2.5, radius * 0.027), 0, Math.PI * 2);
      paint.fillStyle = settings.ink;
      paint.fill();
      paint.restore();
    }
    async function colors() {
      const faceColor = el("input", { type: "color", value: settings.face });
      const inkColor = el("input", { type: "color", value: settings.ink });
      const body = el(
        "div",
        { class: "clock-color-dialog" },
        el("label", {}, "Background:", faceColor),
        el("label", {}, "Clock face:", inkColor),
      );
      if (
        (await os.dialog({
          title: "Clock Colors",
          body,
          buttons: [
            { label: "OK", value: "ok", default: true },
            { label: "Cancel", value: "cancel" },
          ],
          width: 280,
        })) === "ok"
      ) {
        settings.face = faceColor.value;
        settings.ink = inkColor.value;
        save();
      }
    }
    function setMenus() {
      ctx.setMenu([
        {
          label: "&Settings",
          items: [
            {
              label: "&Analog",
              checked: settings.mode === "analog",
              action: () => {
                settings.mode = "analog";
                save();
              },
            },
            {
              label: "&Digital",
              checked: settings.mode === "digital",
              action: () => {
                settings.mode = "digital";
                save();
              },
            },
            { separator: true },
            {
              label: "&Seconds",
              checked: settings.seconds,
              action: () => {
                settings.seconds = !settings.seconds;
                save();
              },
            },
            {
              label: "&12-Hour Format",
              checked: settings.twelveHour,
              action: () => {
                settings.twelveHour = !settings.twelveHour;
                save();
              },
            },
            {
              label: "Show &Date",
              checked: settings.date,
              action: () => {
                settings.date = !settings.date;
                save();
              },
            },
            {
              label: "&UTC Time",
              checked: settings.utc,
              action: () => {
                settings.utc = !settings.utc;
                save();
              },
            },
            { separator: true },
            { label: "&Colors...", action: guarded(os, colors, "Clock") },
            { separator: true },
            { label: "E&xit", action: () => ctx.win.close() },
          ],
        },
        {
          label: "&Help",
          items: [
            {
              label: "&About Clock...",
              action: () =>
                os.about(
                  "Clock",
                  "Analog and digital clocks using your browser’s current system time. Settings are saved between sessions.",
                ),
            },
          ],
        },
      ]);
    }
    setMenus();
    render();
    const timer = setInterval(render, 1000);
    ctx.onResize(render);
    const frame = requestAnimationFrame(render);
    ctx.cleanup(() => {
      clearInterval(timer);
      cancelAnimationFrame(frame);
    });
  },
};
