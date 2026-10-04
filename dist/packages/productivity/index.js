import { registerNotepad } from "./notepad.js";
import { registerWrite } from "./write.js";
import { registerCalculator } from "./calculator.js";
import { registerCalendar } from "./calendar.js";
import { registerCardfile } from "./cardfile.js";
import { registerCharacterMap, registerClipboard } from "./utilities.js";

export function registerApps(os) {
  registerNotepad(os);
  registerWrite(os);
  registerCalculator(os);
  registerCalendar(os);
  registerCardfile(os);
  registerCharacterMap(os);
  registerClipboard(os);
}
