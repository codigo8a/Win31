import { icon } from "./icons.js";
export { icon };

export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes || {})) {
    if (value === undefined || value === null) continue;
    if (key === "class" || key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "style" && typeof value === "object")
      Object.assign(node.style, value);
    else if (/^on[A-Z]/.test(key))
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (
      key in node &&
      !key.startsWith("aria-") &&
      !key.startsWith("data-")
    ) {
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value);
      }
    } else if (
      value !== false ||
      key.startsWith("aria-") ||
      key.startsWith("data-")
    )
      node.setAttribute(
        key,
        value === true && !key.startsWith("aria-") ? "" : String(value),
      );
  }
  const append = (child) => {
    if (Array.isArray(child)) return child.forEach(append);
    if (child === null || child === undefined || child === false) return;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  };
  children.forEach(append);
  return node;
}
export function clear(node) {
  node.replaceChildren();
  return node;
}
export function button(label, action, attrs = {}) {
  return el(
    "button",
    { type: "button", class: "win-button", ...attrs, onClick: action },
    label,
  );
}
export function field(label, input) {
  return el("label", { class: "field" }, el("span", {}, label), input);
}
export function download(filename, content, mime = "text/plain") {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function mnemonic(label) {
  const span = el("span");
  const index = label.indexOf("&");
  if (index < 0) span.textContent = label;
  else
    span.append(
      label.slice(0, index),
      el("u", {}, label[index + 1] || ""),
      label.slice(index + 2),
    );
  return span;
}
export const plainLabel = (label) => String(label || "").replaceAll("&", "");
export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
