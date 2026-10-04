// Original 32×32, 16-color interface glyphs. Integer coordinates keep every edge crisp.
const p = {
  k: "#000",
  w: "#fff",
  g: "#c0c0c0",
  d: "#808080",
  n: "#000080",
  b: "#0000ff",
  c: "#00ffff",
  t: "#008080",
  y: "#ffff00",
  o: "#808000",
  r: "#ff0000",
  m: "#ff00ff",
  v: "#800080",
};
const rect = (x, y, w, h, c, stroke) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p[c] || c}"${stroke ? ` stroke="${p[stroke] || stroke}"` : ""}/>`;
const path = (d, c, s) =>
  `<path d="${d}" fill="${p[c] || c}"${s ? ` stroke="${p[s] || s}"` : ""}/>`;
const paper =
  rect(7, 2, 20, 26, "k") +
  rect(8, 3, 18, 24, "w") +
  path("M20 3v7h6", "g", "k");
const lines = [12, 15, 18, 21].map((y) => rect(11, y, 11, 1, "n")).join("");
const folder =
  path("M2 8h11l3 3h14v18H2z", "y", "k") +
  path("M3 9h9l3 3h14v2H3z", "w") +
  path("M2 17h28l-4 12H1z", "y", "k") +
  path("M4 18h23l-2 2H4z", "w");
const monitor =
  rect(3, 2, 27, 22, "k") +
  rect(4, 3, 25, 20, "g") +
  rect(6, 5, 21, 15, "n") +
  rect(12, 24, 9, 3, "d") +
  rect(8, 27, 17, 3, "k") +
  rect(9, 27, 15, 2, "g");
const icons = {
  group: folder,
  main:
    path("M3 9h26v18H3z", "w", "k") +
    rect(3, 9, 26, 4, "n") +
    rect(5, 10, 3, 2, "g") +
    rect(10, 15, 11, 9, "g", "k") +
    rect(12, 17, 7, 2, "n") +
    rect(23, 15, 3, 3, "r") +
    rect(5, 15, 3, 3, "b") +
    rect(5, 20, 3, 3, "y"),
  accessories:
    rect(3, 12, 27, 16, "k") +
    rect(4, 13, 25, 14, "g") +
    rect(11, 7, 12, 6, "k") +
    rect(13, 9, 8, 3, "g") +
    rect(4, 13, 25, 3, "w") +
    rect(4, 20, 25, 1, "k") +
    rect(9, 18, 3, 6, "k") +
    rect(22, 18, 3, 6, "k") +
    rect(10, 19, 1, 3, "w") +
    rect(23, 19, 1, 3, "w"),
  games:
    rect(3, 4, 18, 23, "k") +
    rect(4, 5, 16, 21, "w") +
    path("M11 8l5 5-5 5-5-5z", "r") +
    rect(13, 9, 17, 22, "k") +
    rect(14, 10, 15, 20, "w") +
    path("M21 15l5 7h-4v3h-3v-3h-4z", "k"),
  startup: folder + path("M18 6l7 8h-5v11h-4V14h-5z", "n", "k"),
  filemanager:
    folder +
    rect(6, 2, 18, 12, "k") +
    rect(7, 3, 16, 10, "w") +
    rect(8, 4, 14, 3, "n") +
    rect(10, 8, 3, 3, "y") +
    rect(15, 8, 7, 1, "d"),
  control:
    rect(2, 4, 29, 24, "k") +
    rect(3, 5, 27, 22, "g") +
    rect(4, 6, 25, 2, "w") +
    [0, 1, 2]
      .map((a) =>
        [0, 1, 2]
          .map((b) =>
            rect(
              6 + b * 8,
              10 + a * 5,
              5,
              4,
              ["r", "b", "y", "t", "v", "b", "n", "o", "m"][a * 3 + b],
              "k",
            ),
          )
          .join(""),
      )
      .join(""),
  printmanager:
    rect(9, 1, 17, 18, "k") +
    rect(10, 2, 15, 16, "w") +
    rect(12, 5, 11, 1, "d") +
    rect(12, 8, 11, 1, "d") +
    path("M4 14h23l4 6v9H2V20z", "g", "k") +
    rect(4, 20, 25, 7, "w") +
    rect(6, 22, 12, 3, "n") +
    rect(23, 21, 3, 2, "t") +
    rect(7, 28, 20, 3, "k"),
  clipboard:
    path("M6 4h21v26H6z", "y", "k") +
    rect(8, 6, 17, 22, "w") +
    rect(11, 2, 11, 6, "k") +
    rect(12, 3, 9, 4, "g") +
    [11, 15, 19, 23].map((y) => rect(11, y, 11, 1, "n")).join(""),
  dos:
    monitor +
    rect(9, 8, 3, 2, "w") +
    rect(12, 10, 2, 1, "w") +
    rect(9, 11, 3, 2, "w") +
    rect(17, 13, 6, 1, "w"),
  setup: monitor + path("M18 7l5 4-4 4-3-2-7 8-3-3 8-8-1-3z", "y", "k"),
  pifeditor:
    paper +
    rect(9, 6, 9, 4, "n") +
    rect(10, 14, 14, 2, "k") +
    rect(10, 18, 11, 2, "k") +
    path("M4 26l15-15 4 4L8 30H4z", "y", "k"),
  readme: paper + lines + rect(11, 6, 5, 4, "r"),
  notepad:
    rect(6, 3, 22, 27, "k") +
    rect(7, 4, 20, 25, "w") +
    rect(7, 4, 20, 5, "n") +
    [10, 14, 18, 22].map((y) => rect(10, y, 14, 1, "b")).join("") +
    path("M3 24L20 7l3 3L6 27H3z", "y", "k") +
    path("M3 24v3h3z", "k"),
  write:
    paper +
    lines +
    path("M3 26L18 11l4-2-2 5L6 29H3z", "n", "k") +
    path("M4 25l3 3-4 1z", "w") +
    rect(20, 25, 10, 5, "k") +
    rect(22, 23, 6, 3, "k"),
  paintbrush:
    path("M5 8l16-6 9 8-7 15-16 3-6-9z", "y", "k") +
    rect(6, 12, 4, 4, "r") +
    rect(13, 7, 4, 4, "b") +
    rect(22, 11, 4, 4, "t") +
    rect(17, 20, 4, 4, "m") +
    path("M3 28L23 8l3 3L6 31z", "g", "k") +
    path("M3 28l4-4 4 4-5 3H3z", "n", "k"),
  terminal:
    monitor +
    rect(9, 8, 3, 2, "y") +
    rect(12, 10, 2, 1, "y") +
    rect(9, 11, 3, 2, "y") +
    rect(17, 13, 6, 1, "y"),
  recorder:
    rect(3, 3, 27, 24, "k") +
    rect(4, 4, 25, 22, "g") +
    rect(5, 5, 23, 3, "n") +
    rect(6, 11, 20, 10, "w", "k") +
    rect(7, 12, 18, 2, "d") +
    rect(8, 23, 4, 2, "r") +
    rect(15, 23, 4, 2, "b") +
    rect(22, 23, 4, 2, "t"),
  cardfile:
    rect(3, 8, 27, 21, "k") +
    rect(4, 9, 25, 19, "g") +
    rect(6, 4, 19, 21, "k") +
    rect(7, 5, 17, 19, "w") +
    rect(7, 5, 7, 4, "y") +
    rect(9, 11, 5, 5, "n") +
    rect(16, 11, 6, 1, "k") +
    rect(16, 14, 6, 1, "k") +
    rect(9, 19, 13, 1, "n"),
  calendar:
    rect(3, 5, 27, 24, "k") +
    rect(4, 6, 25, 22, "w") +
    rect(4, 6, 25, 6, "r") +
    rect(8, 2, 3, 8, "k") +
    rect(23, 2, 3, 8, "k") +
    [0, 1, 2]
      .map((y) =>
        [0, 1, 2, 3]
          .map((x) => rect(7 + x * 5, 15 + y * 4, 3, 2, "n"))
          .join(""),
      )
      .join(""),
  calculator:
    rect(6, 2, 21, 29, "k") +
    rect(7, 3, 19, 27, "g") +
    rect(9, 5, 15, 6, "w", "k") +
    rect(19, 7, 3, 2, "k") +
    [0, 1, 2]
      .map((y) =>
        [0, 1, 2, 3]
          .map((x) => rect(9 + x * 4, 14 + y * 5, 3, 3, x === 3 ? "r" : "n"))
          .join(""),
      )
      .join(""),
  clock:
    path("M11 1h11l8 8v14l-8 8H11l-9-8V9z", "k") +
    path("M11 3h10l7 7v12l-7 7H12l-8-8V10z", "w") +
    rect(15, 6, 2, 3, "k") +
    rect(15, 24, 2, 3, "k") +
    rect(6, 15, 3, 2, "k") +
    rect(24, 15, 2, 2, "k") +
    path("M15 10h2v8h-7v-2h5z", "n"),
  packager:
    path("M3 10L16 3l14 7v16l-14 6-13-6z", "o", "k") +
    path("M3 10l13 7 14-7-14-7z", "y", "k") +
    path("M16 17v15", "none", "k") +
    path("M9 7l13 7v7l4-2v-7L13 5z", "w", "k"),
  charmap:
    paper +
    path("M12 23l5-13h3l5 13h-3l-1-4h-6l-1 4zm4-7h4l-2-5z", "n") +
    rect(11, 6, 5, 2, "r"),
  mediaplayer:
    rect(2, 3, 29, 25, "k") +
    rect(3, 4, 27, 23, "g") +
    rect(4, 5, 25, 3, "n") +
    rect(5, 10, 23, 11, "k") +
    path("M13 11l9 5-9 5z", "c") +
    rect(6, 23, 5, 2, "d") +
    rect(14, 23, 5, 2, "d") +
    rect(22, 23, 5, 2, "d"),
  soundrecorder:
    path("M5 11h6l8-7v23l-8-7H5z", "g", "k") +
    path("M22 9h2v3h2v8h-2v3h-2V9zm5-4h2v6h2v10h-2v6h-2V5z", "n") +
    rect(3, 11, 3, 9, "w"),
  minesweeper:
    rect(7, 7, 19, 19, "k") +
    rect(10, 4, 13, 25, "k") +
    rect(4, 10, 25, 13, "k") +
    rect(3, 15, 28, 3, "k") +
    rect(15, 3, 3, 28, "k") +
    rect(10, 9, 5, 5, "w") +
    rect(7, 5, 3, 3, "k") +
    rect(25, 5, 3, 3, "k") +
    rect(5, 25, 3, 3, "k") +
    rect(25, 25, 3, 3, "k"),
  solitaire:
    rect(3, 1, 20, 26, "k") +
    rect(4, 2, 18, 24, "w") +
    path("M8 6h5v2H8zm2 2h1v6h-1z", "r") +
    rect(12, 8, 19, 24, "k") +
    rect(13, 9, 17, 22, "w") +
    path("M21 14l6 8h-4v4h-4v-4h-4z", "k"),
  regedit:
    rect(4, 6, 10, 10, "b", "k") +
    rect(18, 2, 10, 10, "c", "k") +
    rect(18, 20, 10, 10, "b", "k") +
    path("M14 10h3V7h1m-1 3v15h1", "none", "k"),
  help:
    paper +
    path("M13 8h8l3 3v4l-5 4v3h-4v-5l5-4v-2h-4v3h-4v-3zm2 16h4v3h-4z", "n"),
  document: paper + lines,
  drive:
    rect(2, 11, 29, 14, "k") +
    rect(3, 12, 27, 12, "g") +
    rect(4, 13, 25, 3, "w") +
    rect(6, 18, 17, 2, "k") +
    rect(26, 19, 2, 2, "t"),
  floppy:
    rect(5, 2, 23, 28, "k") +
    rect(6, 3, 21, 26, "n") +
    rect(9, 3, 14, 10, "g") +
    rect(18, 4, 3, 8, "k") +
    rect(9, 18, 15, 11, "w") +
    rect(11, 20, 11, 1, "b") +
    rect(11, 23, 11, 1, "b"),
};
icons.programmanager = icons.main;
icons.folder = folder;
icons["file"] = icons.document;
icons["directory"] = folder;
export function iconSVG(id = "document") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true">${icons[id] || icons.document}</svg>`;
}
export function icon(id, size = 32) {
  const element = document.createElement("span");
  element.className = "app-icon";
  element.style.width = element.style.height = `${size}px`;
  element.innerHTML = iconSVG(id);
  element.setAttribute("aria-hidden", "true");
  return element;
}
