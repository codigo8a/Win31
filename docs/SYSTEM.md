# System application module

## Production files

- `index.js` — native ES module; exports `registerApps(os)`.
- `styles.css` — root must link this stylesheet after the shared Windows theme.

The only import is the CONTRACT.md helper set from `../core/dom.js`. There are no runtime packages, remote resources, or build dependencies. Application styles are scoped to `fm-`, `dos-`, `pm-`, `term-`, `pif-`, `setup-`, `reg-`, `pkg-`, `cp-`, and shared system-only `sys-` classes.

```js
import { registerApps as registerSystemApps } from './system/index.js';
registerSystemApps(os);
```

All production work is complete. The remaining files (`smoke.mjs`, `validate.mjs`) are development-only validation helpers and do not need to be copied into the site.

## Registered applications

| ID | Title | Behaviors implemented |
| --- | --- | --- |
| `filemanager` | File Manager | Virtual C: drive and expanding directory tree; details/name views; sorting; multiple selection; keyboard navigation; open/run; rename, recursive copy/move, cut/copy/paste, delete, mkdir; recursive wildcard search; properties; volume label/info; drag/drop import; explicit host file import/export; filesystem subscription. |
| `dos` | MS-DOS Prompt | Working virtual command interpreter, quoted paths, command history, tab completion, environment expansion, output redirection, transcript save/print, and supported app/file launching. |
| `printmanager` | Print Manager | Live `os.printJobs` spool view; printer/document pause and resume; job removal; completed job cleanup; document/printer properties; printer setup; status updates from `printchange`. |
| `terminal` | Terminal | Clearly labeled local loopback connection; local echo; communications and terminal settings; Control Panel COM profile selection; text send/import; receive capture; exact local file transfer; buffer save/print; persistent `.TRM` profiles. |
| `pifeditor` | PIF Editor | Full launch profile editing with program, parameters, directory, title, display, memory, execution, EMS/XMS, and shortcut preferences; `.PIF` open/save; run supported apps/files; modified-document close guard. |
| `setup` | Windows Setup | Actual browser device/backend summary; complete `os.apps` inventory; launch selected app; configure Control Panel/printer; save/print system report. |
| `regedit` | Registration Info Editor | Actual `os.settings` key/value editing; JSON type preservation; add/update/delete; search; merge settings JSON; save/export/print; immediate settings application. |
| `packager` | Object Packager | Embed a file snapshot, link to a virtual file, or store a desktop command; editable label and application icon; activate package; exact `.PKG` persistence; host import/drop; copy/paste/export package; close guard. |
| `control` | Control Panel | Eleven fully interactive settings panels described below, large/small icon views, keyboard/menu opening. |

`printmanager`, `setup`, `regedit`, and `control` request singleton windows. Other applications allow multiple instances.

## File associations and executable aliases

Recommended root associations:

- Directories → `filemanager` with `{ path }`.
- `.PIF` → `pifeditor` with `{ path }`.
- `.TRM` → `terminal` with `{ path }`.
- `.REG` → `regedit` with `{ path }` (opens an explicit merge confirmation).
- `.PKG` → `packager` with `{ path }`.
- `WINFILE.EXE`, `COMMAND.COM`, `PRINTMAN.EXE`, `TERMINAL.EXE`, `PIFEDIT.EXE`, `SETUP.EXE`, `REGEDIT.EXE`, `PACKAGER.EXE`, `CONTROL.EXE` → corresponding application IDs.

File Manager accepts `args.path` or `args.directory`; DOS accepts `args.cwd` and optional `args.command`; profile-based apps accept `args.path`; Control Panel accepts `args.panel`.

**Singleton reactivation:** `control` exposes `win.openPanel(panelId)`, and `regedit` exposes `win.openFile(path)`. When `os.open` reuses an existing singleton, route new `args.panel` or `args.path` to those methods. Internal printer setup links already call `openPanel` on the returned Control Panel window.

## Control Panel settings

Every dialog saves through `os.saveSettings()` and applies through `os.applySettings()`.

| Panel ID | Settings / behavior |
| --- | --- |
| `color` | `desktopColor`, `windowColor`, `textColor`, `titleColor`, `titleTextColor` as six-digit CSS hex colors. Four schemes, element selection, sixteen-color palette, custom color, working preview. `colors` is accepted as an alias. |
| `fonts` | `fontFamily`, numeric `fontSize`; choose installed/browser fonts, view/print sample, import real WOFF/WOFF2/TTF/OTF fonts. Imported `{name,data}` entries are stored in `customFonts` and loaded into `document.fonts` when the module registers. |
| `ports` | `portSettings`: object keyed by `COM1`, `COM2`, etc., each with numeric `baud`, `dataBits`, `stopBits`, plus `parity`, `flowControl`. Add/remove/configure saved profiles. Terminal Communications can select these profiles. |
| `mouse` | Numeric `pointerSpeed` 1–20; `doubleClickInterval` 100–1000 ms. Includes a pointer-gain test area and an interval-based double-click test. |
| `desktop` | `wallpaperPattern`: `none`, `dots`, `checker`, `diagonal`, `bricks`, `weave`. `screenSaver`: `none`, `blank`, `stars`, `mystify`. Numeric `screenSaverMinutes` 1–120. Includes a real temporary full-screen preview that exits on pointer/key input. Root owns idle activation through its settings application. |
| `keyboard` | `keyboardRepeatDelay` 150–1000 ms; `keyboardRepeatRate` 2–30 characters/sec. Includes a press-and-hold repeat test driven by these values. |
| `printers` | `printerName`, `paperSize` (`Letter`, `A4`, `Legal`), `printOrientation` (`Portrait`, `Landscape`); opens Print Manager and prints a real test page. Browser print dialog owns final host printer/page selection. |
| `international` | `locale`: `en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `ja-JP`; `dateFormat`: `MDY`, `DMY`, `YMD`; `timeFormat`: string `12` or `24`; `decimalSeparator`, `thousandSeparator`, `currencySymbol`; live format preview. |
| `datetime` | Numeric `clockOffsetMs` added to `Date.now()` for desktop clock; date/time controls and reset to computer time. DOS DATE/TIME use this same offset. |
| `sound` | `soundEnabled`; previews `os.playSound('click'/'asterisk'/'exclamation'/'error')`. Root can map unknown sound kinds to its default tone. |
| `drivers` | Actual available browser graphics, keyboard, pointer, virtual disk, printer, audio, and local loopback drivers. Details and relevant configuration actions. Clearly explains that native `.DRV` files cannot be loaded. |

Other persistent preferences used: `diskLabel`, `terminalSettings`, `printerPaused`. DOS environment/history use `os.storage` keys `dos-env` and `dos-history`.

Pointer speed and keyboard repeat are saved preferences with functional tests; the browser does not change the physical host cursor speed or host text-entry repeat. COM settings describe the local connection profile; no physical serial permission or remote connection is requested.

## Print queue contract

Uses `os.printJobs` records `{ id, title, html, pages, created, status }`. Recognizes `queued`, `paused`, `printing`, `printed`/`completed`, and canceled states. Mutations dispatch `printchange`. Resuming calls optional `os.resumePrintQueue()` and clears `settings.printerPaused`. Removing an actively printing entry explicitly explains that an already-open browser print dialog must be canceled separately.

## DOS commands

Implemented commands and aliases:

`DIR`, `CD`/`CHDIR`, `MD`/`MKDIR`, `RD`/`RMDIR`, `COPY`, `MOVE`, `REN`/`RENAME`, `DEL`/`ERASE`, `TYPE`, `ECHO`, `CLS`, `VER`, `HELP`, `DATE`, `TIME`, `SET`, `PATH`, `PROMPT`, `TREE`, `EDIT`, `NOTEPAD`, `START`, `EXIT`, and `C:`.

- `DIR` supports `/W`, `/B`, `/S` and wildcard patterns.
- `RD` supports `/S`, `/Q`; `COPY`/`MOVE` support `/Y`; `DEL` supports `/P`, `/Q`; `TREE` supports `/F`.
- Output supports `>` and `>>` into the virtual filesystem.
- `%NAME%` expands environment variables. Quoted Windows paths are supported.
- History uses Up/Down. Tab completes filesystem names. Escape clears the input.
- `PATH` stores the command path preference. Supported registered desktop applications are resolved by ID/title and documented executable aliases.

This is a command workspace, not a DOS CPU or native executable emulator. `.EXE`, `.COM`, and `.BAT` files do not execute native code. Pipes, batch-language interpretation, network/host shell commands, and BIOS/hardware operations are outside the implementation. HELP and About describe those boundaries accurately.

## Persistent file formats

- PIF: JSON with `format: "windows31-browser-pif"` and launch/preferences fields.
- Terminal: JSON with `format: "windows31-browser-terminal"` and local communications preferences.
- Package: JSON with `format: "windows31-browser-package"`, `label`, `icon`, `mode`, `source`, `command`, and embedded `content` when relevant.
- Registration: plain top-level JSON object of actual settings keys and values. Native Windows registry hives and `.REG` command syntax are not parsed.

Imported media/font/binary files use a data URL in the text-based virtual filesystem. Text imports remain text. File exports decode supported data URLs through a browser download; package/transfer snapshots preserve the stored data exactly.

## Verification

Passed `node --input-type=module --check < index.js`.

Passed `node validate.mjs` using a small DOM/OS contract harness:

- All nine app constructors.
- All eleven Control Panel dialogs construct and apply preferences.
- DOS mkdir, echo, redirect/append, copy, rename, move, cd, dir, environment expansion, type, tree, version, help.
- File Manager browsing, rename, mkdir, clipboard copy/cut/paste, and deletion.
- Actual registry numeric setting modification.
- Actual queued print job pause/resume.
- Terminal text loopback and exact file-transfer content.
- PIF serialization.
- Exact file embedding and package activation.

No OS error messages occurred during these checks. A browser smoke harness is supplied, but local Playwright Chromium was not installed, so it has not run. The owner still needs to assess the integrated visual layout, native browser import/download dialogs, printing, sound, and animation in the full site.
