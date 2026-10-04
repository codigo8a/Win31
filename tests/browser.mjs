import { Windows31 } from "/packages/core/os.js";
import { VirtualFileSystem } from "/packages/core/filesystem.js";
import { SafeStorage } from "/packages/core/storage.js";
import { registerApps as registerShell } from "/packages/shell/program-manager.js";
import { registerApps as registerProductivity } from "/packages/productivity/index.js";
import { registerApps as registerSystem } from "/packages/system/index.js";
import { registerApps as registerGames } from "/packages/games/index.js";
import { registerApps as registerMedia } from "/packages/media/index.js";
const results = [];
const output = document.getElementById("results");
const record = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  output.textContent = JSON.stringify({ running: true, results }, null, 2);
};
const frame = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
try {
  const fs = new VirtualFileSystem({ storage: null });
  const os = new Windows31(document.getElementById("desktop"), {
    fs,
    storage: new SafeStorage({ storage: null }),
  });
  await os.init();
  os.settings.soundEnabled = false;
  registerProductivity(os);
  registerSystem(os);
  registerGames(os);
  registerMedia(os);
  registerShell(os);
  await frame();
  record(
    "Graphics renderer initializes",
    os.renderer.backend !== "Unavailable",
    JSON.stringify({
      backend: os.renderer.backend,
      warnings: os.renderer.warnings,
    }),
  );
  os.renderer.setTheme({ desktopColor: "#008080", desktopPattern: "checker" });
  await frame();
  record(
    "Wallpaper render accepts theme change",
    !os.renderer.error,
    String(os.renderer.error || ""),
  );
  const manager = os.open("programmanager");
  await frame();
  record(
    "Program Manager creates four groups",
    manager.groupWindows.size === 4,
  );
  for (const id of [...os.apps.keys()].filter(
    (id) => id !== "programmanager",
  )) {
    const before = os.errors.length;
    const win = os.open(id);
    await frame();
    const okay =
      win && win.content.childElementCount > 0 && os.errors.length === before;
    record(
      `Application ${id}`,
      okay,
      okay
        ? ""
        : os.errors
            .slice(before)
            .map((e) => e.message)
            .join("; "),
    );
    await win?.close(true);
  }
  os.fs.writeFile(
    "C:\\DOCUMENTS\\ROUNDTRIP.TXT",
    "Text from browser integration.",
  );
  const doc = os.open("notepad", { path: "C:\\DOCUMENTS\\ROUNDTRIP.TXT" });
  await frame();
  const editor = doc.content.querySelector("textarea");
  record(
    "Notepad reads shared filesystem",
    editor?.value === "Text from browser integration.",
  );
  editor.value = "Modified through the live editor";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  const menuItems = doc.menus.flatMap((menu) =>
    typeof menu.items === "function" ? menu.items() : menu.items || [],
  );
  const saveItem = menuItems.find((item) => item.shortcut === "Ctrl+S");
  await saveItem.action();
  record(
    "Notepad Save writes edited text",
    os.fs.readFile("C:\\DOCUMENTS\\ROUNDTRIP.TXT") ===
      "Modified through the live editor",
  );
  await doc.close(true);
  const calc = os.open("calculator");
  await frame();
  const keys = ["2", "+", "3", "="];
  for (const key of keys) {
    const b = [...calc.content.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === key,
    );
    if (!b) throw new Error(`Calculator button not found: ${key}`);
    b.click();
  }
  const calcDisplay = calc.content.querySelector(".calc-display");
  record(
    "Calculator real button arithmetic",
    calcDisplay?.textContent.trim() === "5" || calcDisplay?.value === "5",
    calcDisplay?.textContent || calcDisplay?.value || "No display",
  );
  await calc.close(true);
  record(
    "No JavaScript errors",
    os.errors.length === 0,
    os.errors.map((e) => e.message).join("; "),
  );
  const summary = {
    completed: true,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    graphics: os.renderer.backend,
    registeredApps: os.apps.size,
    results,
  };
  output.classList.remove("pending");
  output.textContent = JSON.stringify(summary, null, 2);
  document.documentElement.dataset.qaComplete = "true";
  document.documentElement.dataset.qaFailures = String(summary.failed);
} catch (error) {
  record("Harness completion", false, error.stack || error.message);
  output.classList.remove("pending");
  output.textContent = JSON.stringify(
    { completed: true, error: error.stack, results },
    null,
    2,
  );
  document.documentElement.dataset.qaComplete = "true";
  document.documentElement.dataset.qaFailures = "1";
}
