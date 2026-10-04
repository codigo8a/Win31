# Media application modules

Import `registerApps` from `media/index.js` and call it with the desktop OS object. Link `media/styles.css` after the shared Windows theme. Copy the whole `media` directory: `index.js` imports the per-application modules and `shared.js`. The module imports the shared DOM helpers from `../core/dom.js`.

Registered application IDs:

| ID | Application | Suggested executable association |
| --- | --- | --- |
| `paintbrush` | Paintbrush | `pbrush.exe` |
| `clock` | Clock | `clock.exe` |
| `mediaplayer` | Media Player | `mplayer.exe` |
| `soundrecorder` | Sound Recorder | `soundrec.exe` |
| `recorder` | Recorder | `recorder.exe` |

All file-capable apps accept `args.path` or `args.file`. Media Player also accepts `args.sample: true` to load a small locally synthesized WAV melody without playing it automatically.

## Implemented behavior

- **Paintbrush:** pencil, brush, eraser, flood fill, color picker, airbrush, text, line, rectangle, rounded rectangle, and ellipse tools. Rectangular selections can be moved by dragging inside them. Cut/copy/paste, select all, clear, undo/redo, foreground/background palette (28 colors), custom colors, line widths, three shape styles, text fonts, zoom, resize or stretch, flips, rotation, and color inversion operate on real canvas pixels. Images open/import as browser-supported formats; virtual save and native export write PNG data. Printed output contains the picture only. Unsaved work has a save/discard/cancel close guard. The image clipboard is shared among Paintbrush windows.
- **Clock:** real system time, analog/digital views, seconds, 12/24 hour formatting, optional date, local/UTC time, custom colors, persisted settings. Timer and resize callbacks are cleaned up by the app/window lifecycle.
- **Media Player:** local audio and video imports, virtual-disk data URL open/save, actual native playback, seeking, beginning/end, pause/stop, volume/mute, repeat, and playback speed. Browser-native video display. A generated PCM WAV sample is available from Device. It requires no remote media or audio files.
- **Sound Recorder:** microphone access is requested only through the Record action. Uses MediaRecorder to capture real microphone audio. Provides stop, pause/resume recording, native playback, seeking, a live microphone waveform and decoded sound waveform, trimming, sample gain changes, and reverse. Saves/exports genuine 16-bit PCM WAV when the browser can decode the source; Original Format preserves the actual recorded format. Imported audio can be edited and exported. Streams, audio contexts, media playback, and timers stop on cleanup.
- **Recorder:** captures OS `appopen` events with elapsed timestamps and serializable arguments. Timed playback, repeat, speed, manually inserted events, retiming, deletion, virtual-disk open/save, and native JSON import/export work. It records app launches only; its help explicitly states that arbitrary mouse/keyboard actions inside applications are not recorded. Macro timers and the event subscription stop on cleanup.

## OS integration details

- Emit `new CustomEvent('appopen', {detail: {id, args}})` whenever an application is opened. Recorder also recognizes `detail.appId`, `detail.app.id`, or `detail.definition.id`.
- Image and media virtual files store a complete `data:` URL. The readers also accept JSON envelopes with a `dataURL`, `dataUrl`, or `content` property containing a data URL. Sound Recorder writes WAV under the chosen extension by default; users may select Original Format explicitly.
- Recorder `.REC`/`.MACRO` files are JSON with `{format:'win31-launch-macro', version:1, events:[{at,id,args}]}`. `at` is elapsed milliseconds, and imported events are validated and sorted.
- File dialogs use the contract's standard `os.pickFile` interface. Native file inputs are only activated by explicit Import actions. Menus contain no inert placeholder entries.
- `button` is used with both text and DOM-node labels, as supported by an `el`-based button helper.
- These apps do not create or claim a WebGPU DOM renderer. Their media uses native HTML media and canvas APIs, independently of the desktop renderer.

## Emulation limits

Native Windows executables, historical BMP/RLE output encoders, native REC macro binaries, MIDI playback, device drivers, arbitrary desktop input recording, OLE, and hardware mixer emulation are not implemented. Images export as PNG. Browser codec and microphone availability determine audio/video format and capture support. Files saved to the virtual disk may be subject to the filesystem's storage quota. Paintbrush limits a picture to 4,096 pixels per side and 8 million total pixels to bound canvas memory; undo history is capped at 20 steps and approximately 64 MiB.

## Verification

Source modules pass JavaScript syntax checks. Integration must validate actual window lifecycle, dialog behavior, and browser rendering against the shared core; microphone capture requires a user-granted microphone permission. The apps have no runtime package or network dependencies.
