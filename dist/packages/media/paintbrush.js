import { el, button, clear } from "../core/dom.js";
import {
  DOCUMENTS,
  clamp,
  report,
  guarded,
  readAsDataURL,
  mediaFileContent,
  exportDataURL,
  discardChanges,
  scopedKeys,
  filenameExtension,
} from "./shared.js";

const COLORS = [
  "#000000",
  "#808080",
  "#800000",
  "#808000",
  "#008000",
  "#008080",
  "#000080",
  "#800080",
  "#808040",
  "#004040",
  "#0080ff",
  "#004080",
  "#400080",
  "#804000",
  "#ffffff",
  "#c0c0c0",
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ffff80",
  "#00ff80",
  "#80ffff",
  "#8080ff",
  "#ff0080",
  "#ff8040",
];
const TOOL_ICONS = {
  select:
    '<rect x="3" y="3" width="15" height="14" fill="none" stroke-dasharray="2 2"/>',
  picker: '<path d="m5 16 9-10 3 3-9 10H4v-4m8-10 3-3 5 5-3 3"/>',
  eraser:
    '<path d="m3 13 7-8 10 7-6 7H9Z" fill="#fff"/><path d="m7 9 10 7M3 19h17"/>',
  fill: '<path d="m4 10 7-7 8 8-7 7Z" fill="#fff"/><path d="m5 9 8 8M8 2l5 8m6 3 2 5c0 3-5 3-5 0Z"/>',
  pencil:
    '<path d="m4 18 2-6L16 2l4 4L9 17Z" fill="#fff"/><path d="m6 12 4 4M4 18l4-1M15 4l3 3"/>',
  brush:
    '<path d="m12 10 4-8 4 2-5 8Z" fill="#fff"/><path d="M12 10c-6 0-2 8-10 8 8 5 14-1 13-6Z" fill="#000"/>',
  spray:
    '<path d="M9 9h9v10H9Zm2-3h5v3M5 5h1m-4 3h1m2 2h1m-4 3h1m3 2h1m-1-9h1"/>',
  text: '<path d="M4 4h15M11 4v15M7 19h8M4 4v3m15-3v3" stroke-width="2"/>',
  line: '<path d="M3 18 19 3" stroke-width="2"/>',
  rect: '<rect x="3" y="4" width="16" height="14" fill="none" stroke-width="2"/>',
  roundrect:
    '<rect x="3" y="4" width="16" height="14" rx="4" fill="none" stroke-width="2"/>',
  ellipse:
    '<ellipse cx="11" cy="11" rx="8" ry="7" fill="none" stroke-width="2"/>',
};
const TOOL_NAMES = {
  select: "Select",
  picker: "Pick Color",
  eraser: "Color Eraser",
  fill: "Fill with Color",
  pencil: "Pencil",
  brush: "Brush",
  spray: "Airbrush",
  text: "Text",
  line: "Line",
  rect: "Rectangle",
  roundrect: "Rounded Rectangle",
  ellipse: "Ellipse",
};
let pictureClipboard = null;

export const paintbrush = {
  id: "paintbrush",
  title: "Paintbrush",
  icon: "paintbrush",
  width: 810,
  height: 570,
  minWidth: 420,
  minHeight: 330,
  create(ctx, args = {}) {
    const { os, content } = ctx;
    content.classList.add("paint-app");
    let tool = "pencil",
      foreground = COLORS[0],
      background = COLORS[14],
      lineWidth = 2,
      shapeMode = "outline";
    let zoom = 1,
      showTools = true,
      showPalette = true,
      showStatus = true,
      dirty = false,
      path = "",
      destroyed = false;
    let textSize = 18,
      textFamily = "Arial",
      textBold = false,
      lastText = "";
    let gesture = null,
      selection = null,
      undoStack = [],
      redoStack = [];
    const canvas = el("canvas", {
      width: 640,
      height: 350,
      tabIndex: 0,
      class: "paint-canvas",
      "aria-label": "Paintbrush drawing canvas",
    });
    const overlay = el("canvas", {
      width: 640,
      height: 350,
      class: "paint-overlay",
      "aria-hidden": "true",
    });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const overlayContext = overlay.getContext("2d");
    const canvasWrap = el("div", { class: "paint-paper" }, canvas, overlay);
    const viewport = el("div", { class: "paint-viewport sunken" }, canvasWrap);
    const tools = el("div", { class: "paint-tools" });
    const toolGrid = el("div", { class: "paint-tool-grid" });
    const toolButtons = {};
    for (const id of Object.keys(TOOL_ICONS)) {
      const image = el("span", {
        class: "paint-tool-icon",
        html: `<svg viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="square">${TOOL_ICONS[id]}</svg>`,
      });
      const node = button(image, () => selectTool(id), {
        class: "win-button paint-tool",
        title: TOOL_NAMES[id],
        "aria-label": TOOL_NAMES[id],
      });
      toolButtons[id] = node;
      toolGrid.append(node);
    }
    const widthPreview = el("div", {
      class: "paint-widths sunken",
      "aria-label": "Line widths",
    });
    [1, 2, 3, 5, 8, 12].forEach((width) =>
      widthPreview.append(
        button(
          el("span", { style: { height: `${Math.min(width, 9)}px` } }),
          () => {
            lineWidth = width;
            renderOptions();
            setMenus();
          },
          {
            class: "paint-width-option",
            title: `${width} pixel line`,
            "data-width": width,
            "aria-label": `${width} pixel line`,
          },
        ),
      ),
    );
    const shapeOptions = el(
      "select",
      {
        class: "win-select paint-shape-select",
        title: "Shape style",
        onChange: (event) => {
          shapeMode = event.target.value;
          setMenus();
        },
      },
      el("option", { value: "outline" }, "Outline"),
      el("option", { value: "filled" }, "Filled"),
      el("option", { value: "solid" }, "Solid"),
    );
    tools.append(toolGrid, widthPreview, shapeOptions);
    const body = el("div", { class: "paint-body" }, tools, viewport);
    const foregroundSwatch = el("span", { class: "paint-foreground" });
    const backgroundSwatch = el("span", { class: "paint-background" });
    const currentColors = button(
      el(
        "span",
        { class: "paint-swatches" },
        backgroundSwatch,
        foregroundSwatch,
      ),
      () => {
        [foreground, background] = [background, foreground];
        renderOptions();
      },
      {
        class: "paint-color-preview sunken",
        title: "Swap foreground and background colors",
        "aria-label": "Swap foreground and background colors",
      },
    );
    const paletteGrid = el("div", { class: "paint-palette-grid" });
    COLORS.forEach((color, index) => {
      const swatch = el("button", {
        class: "paint-color sunken",
        title: color + " — click for foreground, right-click for background",
        style: { backgroundColor: color },
        "aria-label": `Color ${index + 1}, ${color}`,
      });
      swatch.addEventListener("click", () => {
        foreground = color;
        renderOptions();
      });
      swatch.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        background = color;
        renderOptions();
      });
      swatch.addEventListener("dblclick", () => chooseColor(false));
      paletteGrid.append(swatch);
    });
    const palette = el(
      "div",
      { class: "paint-palette" },
      currentColors,
      paletteGrid,
    );
    const statusText = el(
      "span",
      {},
      "For Help, choose Help Topics from the Help menu.",
    );
    const positionText = el("span", { class: "paint-position" }, "640 × 350");
    const status = el(
      "div",
      { class: "statusbar paint-status" },
      statusText,
      positionText,
    );
    const importInput = el("input", {
      type: "file",
      accept: "image/*",
      hidden: true,
    });
    content.append(body, palette, status, importInput);

    function title() {
      ctx.setTitle(
        `${path ? os.fs.basename(path) : "Untitled"}${dirty ? " *" : ""} - Paintbrush`,
      );
    }
    function snapshot() {
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: context.getImageData(0, 0, canvas.width, canvas.height),
      };
    }
    function checkpoint() {
      undoStack.push(snapshot());
      redoStack = [];
      let bytes = undoStack.reduce(
        (total, entry) => total + entry.pixels.data.byteLength,
        0,
      );
      while (
        undoStack.length > 1 &&
        (undoStack.length > 20 || bytes > 64 * 1024 * 1024)
      )
        bytes -= undoStack.shift().pixels.data.byteLength;
    }
    function setDimensions(width, height) {
      canvas.width = width;
      canvas.height = height;
      overlay.width = width;
      overlay.height = height;
      layoutCanvas();
    }
    function layoutCanvas() {
      canvasWrap.style.width = `${canvas.width * zoom}px`;
      canvasWrap.style.height = `${canvas.height * zoom}px`;
      canvas.style.width = overlay.style.width = `${canvas.width * zoom}px`;
      canvas.style.height = overlay.style.height = `${canvas.height * zoom}px`;
      positionText.textContent = `${canvas.width} × ${canvas.height}  ${Math.round(zoom * 100)}%`;
    }
    function restore(entry) {
      setDimensions(entry.width, entry.height);
      context.putImageData(entry.pixels, 0, 0);
      selection = null;
      drawSelection();
    }
    function changed() {
      dirty = true;
      title();
      setMenus();
    }
    function undo() {
      if (!undoStack.length) return;
      redoStack.push(snapshot());
      restore(undoStack.pop());
      changed();
    }
    function redo() {
      if (!redoStack.length) return;
      undoStack.push(snapshot());
      restore(redoStack.pop());
      changed();
    }
    function selectTool(id) {
      tool = id;
      if (id !== "select") selection = null;
      drawSelection();
      renderOptions();
      statusText.textContent = TOOL_NAMES[id];
    }
    function renderOptions() {
      Object.entries(toolButtons).forEach(([id, node]) => {
        node.classList.toggle("is-down", id === tool);
        node.setAttribute("aria-pressed", id === tool ? "true" : "false");
      });
      widthPreview
        .querySelectorAll("button")
        .forEach((node) =>
          node.classList.toggle(
            "is-down",
            Number(node.dataset.width) === lineWidth,
          ),
        );
      shapeOptions.value = shapeMode;
      foregroundSwatch.style.backgroundColor = foreground;
      backgroundSwatch.style.backgroundColor = background;
      canvas.style.cursor =
        tool === "text"
          ? "text"
          : tool === "select"
            ? "crosshair"
            : tool === "picker"
              ? "crosshair"
              : "crosshair";
    }
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clamp(
          Math.floor(((event.clientX - rect.left) * canvas.width) / rect.width),
          0,
          canvas.width - 1,
        ),
        y: clamp(
          Math.floor(
            ((event.clientY - rect.top) * canvas.height) / rect.height,
          ),
          0,
          canvas.height - 1,
        ),
      };
    }
    function drawSelection() {
      overlayContext.clearRect(0, 0, overlay.width, overlay.height);
      const box =
        gesture?.kind === "select"
          ? boxBetween(gesture.start, gesture.end)
          : selection;
      if (!box) return;
      overlayContext.save();
      overlayContext.lineWidth = 1;
      overlayContext.setLineDash([]);
      overlayContext.strokeStyle = "#fff";
      overlayContext.strokeRect(
        box.x + 0.5,
        box.y + 0.5,
        Math.max(0, box.w - 1),
        Math.max(0, box.h - 1),
      );
      overlayContext.setLineDash([3, 3]);
      overlayContext.strokeStyle = "#000";
      overlayContext.strokeRect(
        box.x + 0.5,
        box.y + 0.5,
        Math.max(0, box.w - 1),
        Math.max(0, box.h - 1),
      );
      overlayContext.restore();
    }
    function boxBetween(a, b) {
      return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x) + 1,
        h: Math.abs(a.y - b.y) + 1,
      };
    }
    function dab(x, y, color, width) {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x + 0.5, y + 0.5, width / 2, 0, Math.PI * 2);
      context.fill();
    }
    function spray(x, y, color) {
      context.fillStyle = color;
      const radius = lineWidth * 2 + 3;
      for (let i = 0; i < 20 + lineWidth * 2; i++) {
        const a = Math.random() * Math.PI * 2,
          r = Math.sqrt(Math.random()) * radius;
        context.fillRect(
          Math.round(x + Math.cos(a) * r),
          Math.round(y + Math.sin(a) * r),
          1,
          1,
        );
      }
    }
    function flood(x, y, color) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height),
        data = pixels.data,
        width = canvas.width,
        height = canvas.height;
      const offset = (y * width + x) * 4,
        target = Array.from(data.subarray(offset, offset + 4));
      const replacement = [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
        255,
      ];
      if (target.every((value, index) => value === replacement[index]))
        return false;
      checkpoint();
      const queue = new Uint32Array(width * height);
      let head = 0,
        tail = 0;
      function visit(index) {
        const p = index * 4;
        if (
          data[p] !== target[0] ||
          data[p + 1] !== target[1] ||
          data[p + 2] !== target[2] ||
          data[p + 3] !== target[3]
        )
          return;
        data.set(replacement, p);
        queue[tail++] = index;
      }
      visit(y * width + x);
      while (head < tail) {
        const index = queue[head++],
          px = index % width;
        if (px) visit(index - 1);
        if (px < width - 1) visit(index + 1);
        if (index >= width) visit(index - width);
        if (index < width * (height - 1)) visit(index + width);
      }
      context.putImageData(pixels, 0, 0);
      return true;
    }
    function drawShape(start, end, color, shift) {
      let dx = end.x - start.x,
        dy = end.y - start.y;
      if (shift && tool !== "line") {
        const length = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * length;
        dy = Math.sign(dy || 1) * length;
      }
      if (shift && tool === "line") {
        const length = Math.hypot(dx, dy),
          angle =
            (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
        dx = Math.cos(angle) * length;
        dy = Math.sin(angle) * length;
      }
      const x = Math.min(start.x, start.x + dx),
        y = Math.min(start.y, start.y + dy),
        width = Math.max(1, Math.abs(dx)),
        height = Math.max(1, Math.abs(dy));
      context.beginPath();
      context.lineWidth = lineWidth;
      context.lineJoin = "miter";
      context.lineCap = "butt";
      context.strokeStyle = color;
      context.fillStyle = shapeMode === "solid" ? color : background;
      if (tool === "line") {
        context.moveTo(start.x + 0.5, start.y + 0.5);
        context.lineTo(start.x + dx + 0.5, start.y + dy + 0.5);
      } else if (tool === "ellipse")
        context.ellipse(
          x + width / 2,
          y + height / 2,
          width / 2,
          height / 2,
          0,
          0,
          Math.PI * 2,
        );
      else if (tool === "roundrect" && context.roundRect)
        context.roundRect(
          x + 0.5,
          y + 0.5,
          width,
          height,
          Math.min(12, width / 4, height / 4),
        );
      else context.rect(x + 0.5, y + 0.5, width, height);
      if (shapeMode !== "outline" && tool !== "line") context.fill();
      if (shapeMode !== "solid" || tool === "line") context.stroke();
    }
    function pointerDown(event) {
      if (event.button !== 0 && event.button !== 2) return;
      if (gesture) return;
      event.preventDefault();
      canvas.focus();
      const p = point(event),
        color = event.button === 2 ? background : foreground;
      if (tool === "picker") {
        const pixel = context.getImageData(p.x, p.y, 1, 1).data;
        const picked =
          "#" +
          Array.from(pixel.slice(0, 3), (value) =>
            value.toString(16).padStart(2, "0"),
          ).join("");
        if (event.button === 2) background = picked;
        else foreground = picked;
        renderOptions();
        return;
      }
      if (tool === "fill") {
        if (flood(p.x, p.y, color)) changed();
        return;
      }
      if (tool === "text") {
        guarded(
          os,
          async () => {
            const text = await os.prompt(
              "Paintbrush Text",
              "Enter text to place in the picture:",
              lastText,
            );
            if (text === null || !text || destroyed) return;
            lastText = text;
            checkpoint();
            context.fillStyle = color;
            context.textBaseline = "top";
            context.font = `${textBold ? "bold " : ""}${textSize}px "${textFamily}"`;
            text
              .split("\n")
              .forEach((line, index) =>
                context.fillText(line, p.x, p.y + index * (textSize + 2)),
              );
            changed();
          },
          "Paintbrush",
        )();
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      if (tool === "select") {
        if (
          selection &&
          p.x >= selection.x &&
          p.y >= selection.y &&
          p.x < selection.x + selection.w &&
          p.y < selection.y + selection.h
        ) {
          checkpoint();
          const pixels = context.getImageData(
              selection.x,
              selection.y,
              selection.w,
              selection.h,
            ),
            original = { ...selection };
          context.fillStyle = background;
          context.fillRect(selection.x, selection.y, selection.w, selection.h);
          gesture = {
            kind: "move",
            start: p,
            base: context.getImageData(0, 0, canvas.width, canvas.height),
            pixels,
            original,
            pointerId: event.pointerId,
          };
          context.putImageData(pixels, original.x, original.y);
        } else {
          selection = null;
          gesture = {
            kind: "select",
            start: p,
            end: p,
            pointerId: event.pointerId,
          };
        }
        drawSelection();
        return;
      }
      selection = null;
      drawSelection();
      checkpoint();
      gesture = {
        kind: ["line", "rect", "roundrect", "ellipse"].includes(tool)
          ? "shape"
          : "stroke",
        start: p,
        previous: p,
        color: tool === "eraser" ? background : color,
        base: context.getImageData(0, 0, canvas.width, canvas.height),
        pointerId: event.pointerId,
      };
      if (gesture.kind === "stroke") {
        if (tool === "spray") spray(p.x, p.y, gesture.color);
        else if (tool === "pencil") {
          context.fillStyle = gesture.color;
          context.fillRect(p.x, p.y, 1, 1);
        } else
          dab(
            p.x,
            p.y,
            gesture.color,
            tool === "eraser" ? lineWidth * 3 : lineWidth,
          );
      }
    }
    function pointerMove(event) {
      const p = point(event);
      positionText.textContent = `${p.x}, ${p.y}   ${canvas.width} × ${canvas.height}`;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (gesture.kind === "select") {
        gesture.end = p;
        drawSelection();
        return;
      }
      if (gesture.kind === "move") {
        const x = clamp(
            gesture.original.x + p.x - gesture.start.x,
            0,
            canvas.width - gesture.original.w,
          ),
          y = clamp(
            gesture.original.y + p.y - gesture.start.y,
            0,
            canvas.height - gesture.original.h,
          );
        context.putImageData(gesture.base, 0, 0);
        context.putImageData(gesture.pixels, x, y);
        selection = { ...gesture.original, x, y };
        drawSelection();
        return;
      }
      if (gesture.kind === "shape") {
        context.putImageData(gesture.base, 0, 0);
        drawShape(gesture.start, p, gesture.color, event.shiftKey);
        return;
      }
      if (tool === "spray") spray(p.x, p.y, gesture.color);
      else {
        context.beginPath();
        context.strokeStyle = gesture.color;
        context.lineWidth =
          tool === "pencil" ? 1 : tool === "eraser" ? lineWidth * 3 : lineWidth;
        context.lineCap = tool === "pencil" ? "square" : "round";
        context.lineJoin = "round";
        context.moveTo(gesture.previous.x + 0.5, gesture.previous.y + 0.5);
        context.lineTo(p.x + 0.5, p.y + 0.5);
        context.stroke();
      }
      gesture.previous = p;
    }
    function pointerUp(event) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (gesture.kind === "select")
        selection = boxBetween(gesture.start, gesture.end);
      else {
        if (gesture.kind === "shape") {
          context.putImageData(gesture.base, 0, 0);
          drawShape(gesture.start, point(event), gesture.color, event.shiftKey);
        }
        changed();
      }
      gesture = null;
      drawSelection();
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_) {}
    }
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    function copySelection() {
      const box = selection || {
        x: 0,
        y: 0,
        w: canvas.width,
        h: canvas.height,
      };
      const copy = document.createElement("canvas");
      copy.width = box.w;
      copy.height = box.h;
      copy
        .getContext("2d")
        .drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      pictureClipboard = copy.toDataURL("image/png");
      statusText.textContent =
        "Picture copied. Choose Paste to place it in a picture.";
      setMenus();
    }
    function clearSelection() {
      checkpoint();
      const box = selection || {
        x: 0,
        y: 0,
        w: canvas.width,
        h: canvas.height,
      };
      context.fillStyle = background;
      context.fillRect(box.x, box.y, box.w, box.h);
      selection = null;
      drawSelection();
      changed();
    }
    async function pasteSelection() {
      if (!pictureClipboard) return;
      const image = await imageFrom(pictureClipboard);
      if (destroyed) return;
      checkpoint();
      context.drawImage(image, 0, 0);
      selection = {
        x: 0,
        y: 0,
        w: Math.min(image.width, canvas.width),
        h: Math.min(image.height, canvas.height),
      };
      selectTool("select");
      drawSelection();
      changed();
    }
    function imageFrom(data) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("Paintbrush could not open this image format."));
        image.src = data;
      });
    }
    async function loadPicture(data, filename = "") {
      const image = await imageFrom(data);
      if (
        image.width > 4096 ||
        image.height > 4096 ||
        image.width * image.height > 8388608
      )
        throw new Error(
          "This picture is too large. Use an image no larger than 4,096 pixels per side and 8 million pixels total.",
        );
      if (destroyed) return;
      setDimensions(image.width, image.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      path = filename;
      dirty = false;
      undoStack = [];
      redoStack = [];
      selection = null;
      drawSelection();
      title();
      setMenus();
    }
    async function save(as = false) {
      const destination =
        !as && /\.png$/i.test(path)
          ? path
          : await os.pickFile({
              title: "Save PNG Picture As",
              save: true,
              filename: filenameExtension(
                path || DOCUMENTS + "UNTITLED.PNG",
                "PNG",
              ),
            });
      if (!destination) return false;
      os.fs.writeFile(destination, canvas.toDataURL("image/png"));
      path = destination;
      dirty = false;
      title();
      statusText.textContent = "Picture saved as PNG.";
      return true;
    }
    async function canDiscard() {
      return discardChanges(os, dirty, "Paintbrush", save);
    }
    async function newPicture() {
      if (!(await canDiscard())) return;
      setDimensions(640, 350);
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      path = "";
      dirty = false;
      undoStack = [];
      redoStack = [];
      selection = null;
      drawSelection();
      title();
      setMenus();
    }
    async function openPicture() {
      if (!(await canDiscard())) return;
      const selected = await os.pickFile({ title: "Open Picture" });
      if (selected)
        await loadPicture(mediaFileContent(os.fs.readFile(selected)), selected);
    }
    importInput.addEventListener(
      "change",
      guarded(
        os,
        async () => {
          const file = importInput.files?.[0];
          importInput.value = "";
          if (!file) return;
          await loadPicture(await readAsDataURL(file));
          dirty = true;
          title();
          statusText.textContent = `Imported ${file.name}`;
        },
        "Paintbrush",
      ),
    );
    async function importPicture() {
      if (await canDiscard()) importInput.click();
    }
    async function resizePicture() {
      const widthInput = el("input", {
        type: "number",
        class: "win-input",
        min: 1,
        max: 4096,
        value: canvas.width,
      });
      const heightInput = el("input", {
        type: "number",
        class: "win-input",
        min: 1,
        max: 4096,
        value: canvas.height,
      });
      const stretch = el("input", { type: "checkbox" });
      const form = el(
        "div",
        { class: "paint-dialog-fields" },
        el("label", {}, "Width (pixels):", widthInput),
        el("label", {}, "Height (pixels):", heightInput),
        el(
          "label",
          { class: "paint-checkbox" },
          stretch,
          "Stretch picture to fit",
        ),
      );
      if (
        (await os.dialog({
          title: "Picture Dimensions",
          body: form,
          buttons: [
            { label: "OK", value: "ok", default: true },
            { label: "Cancel", value: "cancel" },
          ],
          width: 340,
        })) !== "ok"
      )
        return;
      const width = Math.floor(Number(widthInput.value)),
        height = Math.floor(Number(heightInput.value));
      if (
        !(
          width >= 1 &&
          height >= 1 &&
          width <= 4096 &&
          height <= 4096 &&
          width * height <= 8388608
        )
      )
        throw new Error(
          "Enter dimensions from 1 to 4,096 pixels, with at most 8 million pixels total.",
        );
      checkpoint();
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext("2d").drawImage(canvas, 0, 0);
      setDimensions(width, height);
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      if (stretch.checked) {
        context.imageSmoothingEnabled = false;
        context.drawImage(copy, 0, 0, width, height);
      } else context.drawImage(copy, 0, 0);
      selection = null;
      drawSelection();
      changed();
    }
    async function transformPicture(kind) {
      if (ctx.win.element.inert || destroyed) return;
      if (kind === "invert" || kind === "horizontal" || kind === "vertical") {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        checkpoint();
        ctx.win.element.inert = true;
        canvas.style.cursor = "wait";
        try {
          const operation =
            kind === "invert"
              ? "invert"
              : kind === "horizontal"
                ? "flip-horizontal"
                : "flip-vertical";
          const transformed = await os.pixelOps.transform(pixels, operation);
          if (!destroyed && !ctx.win.closed) {
            context.putImageData(transformed, 0, 0);
            canvas.dataset.backend = os.pixelOps.lastBackend;
            selection = null;
            drawSelection();
            changed();
          }
        } finally {
          ctx.win.element.inert = false;
          canvas.style.cursor = "";
          if (!destroyed && !ctx.win.closed) canvas.focus();
        }
        return;
      }
      checkpoint();
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext("2d").drawImage(canvas, 0, 0);
      if (kind === "invert") {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          pixels.data[i] = 255 - pixels.data[i];
          pixels.data[i + 1] = 255 - pixels.data[i + 1];
          pixels.data[i + 2] = 255 - pixels.data[i + 2];
        }
        context.putImageData(pixels, 0, 0);
      } else {
        if (kind === "rotate") setDimensions(copy.height, copy.width);
        context.save();
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (kind === "horizontal") {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        if (kind === "vertical") {
          context.translate(0, canvas.height);
          context.scale(1, -1);
        }
        if (kind === "rotate") {
          context.translate(canvas.width, 0);
          context.rotate(Math.PI / 2);
        }
        context.drawImage(copy, 0, 0);
        context.restore();
      }
      selection = null;
      drawSelection();
      changed();
    }
    async function chooseColor(back) {
      const input = el("input", {
        type: "color",
        value: back ? background : foreground,
        class: "paint-custom-color",
      });
      if (
        (await os.dialog({
          title: back ? "Background Color" : "Foreground Color",
          body: el("div", { class: "dialog-body" }, input),
          buttons: [
            { label: "OK", value: "ok", default: true },
            { label: "Cancel", value: "cancel" },
          ],
          width: 290,
        })) === "ok"
      ) {
        if (back) background = input.value;
        else foreground = input.value;
        renderOptions();
      }
    }
    async function chooseFont() {
      const family = el(
        "select",
        { class: "win-select" },
        ...[
          "Arial",
          "Times New Roman",
          "Courier New",
          "Georgia",
          "Verdana",
        ].map((name) =>
          el("option", { value: name, selected: name === textFamily }, name),
        ),
      );
      const size = el("input", {
        type: "number",
        min: 6,
        max: 200,
        value: textSize,
        class: "win-input",
      });
      const bold = el("input", { type: "checkbox", checked: textBold });
      if (
        (await os.dialog({
          title: "Text Font",
          body: el(
            "div",
            { class: "paint-dialog-fields" },
            el("label", {}, "Font:", family),
            el("label", {}, "Size (pixels):", size),
            el("label", { class: "paint-checkbox" }, bold, "Bold"),
          ),
          buttons: [
            { label: "OK", value: "ok", default: true },
            { label: "Cancel", value: "cancel" },
          ],
          width: 340,
        })) === "ok"
      ) {
        textFamily = family.value;
        textSize = clamp(Number(size.value) || 18, 6, 200);
        textBold = bold.checked;
        selectTool("text");
      }
    }
    function setMenus() {
      const act = (action) => guarded(os, action, "Paintbrush");
      ctx.setMenu([
        {
          label: "&File",
          items: [
            { label: "&New", shortcut: "Ctrl+N", action: act(newPicture) },
            { label: "&Open...", shortcut: "Ctrl+O", action: act(openPicture) },
            { label: "&Save", shortcut: "Ctrl+S", action: act(() => save()) },
            { label: "Save &As...", action: act(() => save(true)) },
            { separator: true },
            { label: "&Import Picture...", action: act(importPicture) },
            {
              label: "&Export PNG...",
              action: () =>
                exportDataURL(
                  path
                    ? os.fs.basename(path).replace(/\.[^.]+$/, ".PNG")
                    : "UNTITLED.PNG",
                  canvas.toDataURL("image/png"),
                ),
            },
            { separator: true },
            {
              label: "&Print...",
              shortcut: "Ctrl+P",
              action: act(() =>
                os.print(
                  "Paintbrush",
                  `<img alt="Paintbrush picture" style="max-width:100%;image-rendering:pixelated" src="${canvas.toDataURL("image/png")}">`,
                ),
              ),
            },
            { separator: true },
            { label: "E&xit", action: () => ctx.win.close() },
          ],
        },
        {
          label: "&Edit",
          items: [
            {
              label: "&Undo",
              shortcut: "Ctrl+Z",
              action: undo,
              disabled: !undoStack.length,
            },
            {
              label: "&Redo",
              shortcut: "Ctrl+Y",
              action: redo,
              disabled: !redoStack.length,
            },
            { separator: true },
            {
              label: "Cu&t",
              shortcut: "Ctrl+X",
              action: () => {
                copySelection();
                clearSelection();
              },
            },
            { label: "&Copy", shortcut: "Ctrl+C", action: copySelection },
            {
              label: "&Paste",
              shortcut: "Ctrl+V",
              action: act(pasteSelection),
              disabled: !pictureClipboard,
            },
            {
              label: "C&lear Selection",
              shortcut: "Del",
              action: clearSelection,
            },
            {
              label: "Select &All",
              shortcut: "Ctrl+A",
              action: () => {
                selectTool("select");
                selection = { x: 0, y: 0, w: canvas.width, h: canvas.height };
                drawSelection();
              },
            },
          ],
        },
        {
          label: "&View",
          items: [
            {
              label: "&Toolbox",
              checked: showTools,
              action: () => {
                showTools = !showTools;
                tools.hidden = !showTools;
                setMenus();
              },
            },
            {
              label: "&Color Box",
              checked: showPalette,
              action: () => {
                showPalette = !showPalette;
                palette.hidden = !showPalette;
                setMenus();
              },
            },
            {
              label: "&Status Bar",
              checked: showStatus,
              action: () => {
                showStatus = !showStatus;
                status.hidden = !showStatus;
                setMenus();
              },
            },
            { separator: true },
            {
              label: "&Zoom",
              items: [0.5, 1, 2, 4].map((value) => ({
                label: `${value * 100}%`,
                checked: zoom === value,
                action: () => {
                  zoom = value;
                  layoutCanvas();
                  setMenus();
                },
              })),
            },
          ],
        },
        {
          label: "&Picture",
          items: [
            { label: "&Dimensions...", action: act(resizePicture) },
            {
              label: "Flip &Horizontal",
              action: () => transformPicture("horizontal"),
            },
            {
              label: "Flip &Vertical",
              action: () => transformPicture("vertical"),
            },
            { label: "&Rotate 90°", action: () => transformPicture("rotate") },
            {
              label: "&Invert Colors",
              action: () => transformPicture("invert"),
            },
            {
              label: "&Clear Picture",
              action: () => {
                selection = null;
                clearSelection();
              },
            },
          ],
        },
        {
          label: "&Options",
          items: [
            {
              label: "&Foreground Color...",
              action: act(() => chooseColor(false)),
            },
            {
              label: "&Background Color...",
              action: act(() => chooseColor(true)),
            },
            {
              label: "&Swap Colors",
              action: () => {
                [foreground, background] = [background, foreground];
                renderOptions();
              },
            },
            { separator: true },
            {
              label: "&Line Width",
              items: [1, 2, 3, 5, 8, 12].map((value) => ({
                label: `${value} pixel${value === 1 ? "" : "s"}`,
                checked: value === lineWidth,
                action: () => {
                  lineWidth = value;
                  renderOptions();
                  setMenus();
                },
              })),
            },
            {
              label: "Shape &Style",
              items: [
                ["outline", "Outline"],
                ["filled", "Filled with Background"],
                ["solid", "Solid Foreground"],
              ].map(([value, label]) => ({
                label,
                checked: value === shapeMode,
                action: () => {
                  shapeMode = value;
                  renderOptions();
                  setMenus();
                },
              })),
            },
            { label: "Text &Font...", action: act(chooseFont) },
          ],
        },
        {
          label: "&Help",
          items: [
            {
              label: "&Help Topics",
              action: () =>
                os.message(
                  "Choose a tool, then drag on the picture. Click a palette color for the foreground; right-click for the background. Hold Shift for square shapes or 45° lines. Select an area, then drag inside it to move it. Images are stored as PNG on the virtual disk. Import and Export exchange pictures with your computer.",
                  "Paintbrush Help",
                ),
            },
            {
              label: "&About Paintbrush...",
              action: () =>
                os.about(
                  "Paintbrush",
                  "A working canvas drawing application inspired by Windows 3.1 Paintbrush.",
                ),
            },
          ],
        },
      ]);
    }
    scopedKeys(ctx, (event) => {
      if (event.key === "Escape") {
        selection = null;
        drawSelection();
        event.preventDefault();
      }
      if (event.key === "Delete" && selection) {
        clearSelection();
        event.preventDefault();
      }
    });
    ctx.onClose(() => canDiscard());
    ctx.cleanup(ctx.win.on("focus", setMenus));
    ctx.cleanup(() => {
      destroyed = true;
      gesture = null;
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      undoStack = [];
      redoStack = [];
    });
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    layoutCanvas();
    renderOptions();
    title();
    setMenus();
    if (args.path || args.file)
      guarded(
        os,
        () =>
          loadPicture(
            mediaFileContent(os.fs.readFile(args.path || args.file)),
            args.path || args.file,
          ),
        "Paintbrush",
      )();
  },
};
