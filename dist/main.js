import { Windows31 } from "./packages/core/os.js";
import { registerApps as registerShell } from "./packages/shell/program-manager.js";
import { registerApps as registerProductivity } from "./packages/productivity/index.js";
import { registerApps as registerSystem } from "./packages/system/index.js";
import { registerApps as registerGames } from "./packages/games/index.js";
import { registerApps as registerMedia } from "./packages/media/index.js";

async function boot() {
  const os = new Windows31(document.getElementById("desktop"));
  await os.init();
  registerProductivity(os);
  registerSystem(os);
  registerGames(os);
  registerMedia(os);
  registerShell(os);
  window.win31 = os;
  os.open("programmanager");
  os.registerWebMCP();
  document.getElementById("boot")?.remove();
  document.documentElement.dataset.ready = "true";
}
boot().catch((error) => {
  console.error(error);
  const boot = document.getElementById("boot");
  if (boot) {
    boot.replaceChildren();
    const panel = document.createElement("div");
    panel.className = "boot-window";
    const title = document.createElement("strong");
    title.textContent = "Windows could not start";
    const message = document.createElement("p");
    message.textContent = error.message;
    const retry = document.createElement("button");
    retry.className = "win-button";
    retry.textContent = "Try Again";
    retry.onclick = () => location.reload();
    panel.append(title, message, retry);
    boot.append(panel);
  }
});
