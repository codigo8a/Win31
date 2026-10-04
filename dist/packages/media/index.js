import { paintbrush } from "./paintbrush.js";
import { clock } from "./clock.js";
import { mediaPlayer } from "./media-player.js";
import { soundRecorder } from "./sound-recorder.js";
import { recorder } from "./recorder.js";

export function registerApps(os) {
  [paintbrush, clock, mediaPlayer, soundRecorder, recorder].forEach((app) =>
    os.registerApp(app),
  );
}
