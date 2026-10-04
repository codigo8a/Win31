# Productivity applications

Import `registerApps` from `./productivity/index.js`, then call `registerApps(os)` once after OS setup. Link `./productivity/styles.css` after the core theme stylesheet. The module imports only the documented `../core/dom.js` helpers and needs no packages.

Registered IDs: `notepad`, `write`, `calculator`, `calendar`, `cardfile`, `charmap`, `clipboard`. Open text and rich text files with `os.open('notepad', {path})` and `os.open('write', {path})`; Calendar and Cardfile also accept `{path}`. The document apps recognize `args.file`, `args.filename`, and a string path for convenience. Calendar additionally accepts `{date: 'YYYY-MM-DD'}`.

## Working features

- **Notepad:** New/Open/Save/Save As with a three-way unsaved-change guard; text editing with 200-step undo/redo; clipboard; select/delete; find, find-next, match case, backwards search, replace and replace-all; go to line; word wrap; font selection; time/date and `.LOG` append; status bar; page header/footer setup and printing.
- **Write:** File operations and unsaved guard; editable rich text; font family/size, bold/italic/underline, alignment, lists, indentation, paragraph spacing, ruler/toolbar/page view, zoom; find/replace; clipboard; date/time, page break, text-file insertion; page setup and printing. Saved .WRI files use a marked, sanitized HTML document and round trip formatting. Unmarked files, including the seeded SAMPLE.WRI, open as plain text.
- **Calculator:** Keyboard and mouse standard arithmetic with immediate execution; repeat-equals; memory; sign, percent, reciprocal and square root; scientific expression parser with precedence/parentheses, powers, factorials, logs, trig/inverse/hyperbolic functions, angle modes, decimal/hex/octal/binary display/input, 32-bit bitwise logic, random value and selectable calculation history. The parser does not use `eval`.
- **Calendar:** Month grid and day time slots, date navigation, editable appointments with start/end/notes/completion, optional alarms while app is running, clipboard transfer, search, configurable day hours/interval/clock, persistent events, JSON .CAL file round trips and printing. Accepts the seeded `{version:1, events:[]}` format.
- **Cardfile:** Persistent cards with editable title/body, alphabetical index and list view, live filter, cross-card find and find-next, add/duplicate/delete/rename/navigation, text undo/redo and clipboard, import text as a card, JSON .CRD file round trips and per-card/all-card printing.
- **Character Map:** Font and Unicode block selection, keyboard grid navigation, character preview/code, selection buffer, double-click selection and clipboard copy.
- **Clipboard Viewer:** Live text and virtual file display, external paste on user action, copy/select/clear, automatic/text/files mode, wrapping, refresh, JSON .CLP open/save and print.

## Emulation limits

These are web implementations, not native Windows executables. Binary WRI/CRD/CLP compatibility is not claimed. Calculator uses JavaScript double precision and signed 32-bit bitwise operations. Browser fonts determine glyph coverage. Write uses the browser's contenteditable editing engine. Clipboard access and printing are mediated by the OS adapter and browser. Calendar alarms are active only while its window remains open. Filesystem persistence and OS clipboard behavior are provided by the owner’s `os` adapter.

All application timers/listeners that outlive their own DOM are registered for cleanup. No app adds a global keyboard listener. All menu entries perform an action or open a functional dialog.
