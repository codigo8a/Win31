# Application module API

Applications use native ES modules and share the desktop's window management, dialogs, clipboard, settings, and virtual filesystem. The application packages have no npm runtime dependencies. Each package exports `registerApps(os)` from its `index.js`.

## DOM helpers

Shared helpers are exported from `../core/dom.js`:

```js
import { el, button, field, icon, clear, download } from '../core/dom.js';
```

| Helper | Behavior |
|---|---|
| `el(tag, attrs = {}, ...children)` | Creates an element. Supports `class`/`className`, `text`, `html`, style objects, ordinary attributes, and event properties such as `onClick`, `onInput`, `onChange`, `onKeydown`, and `onDblclick`. Children may be nodes, arrays, or strings. |
| `button(label, action, attrs = {})` | Creates a standard button with its action. |
| `field(label, input)` | Creates a labeled field. |
| `icon(id, size = 32)` | Returns an icon node; application IDs can be used as icon IDs. |
| `clear(node)` | Removes a node's children. |
| `download(filename, content, mime = 'text/plain')` | Exports content through a browser download. |

Use text nodes or `textContent` for user-provided content. The `html` option is intended for trusted markup.

## Registering an application

```js
os.registerApp({
  id: 'example',
  title: 'Example',
  icon: 'example',
  width: 600,
  height: 400,
  minWidth: 250,
  minHeight: 150,
  singleton: false,
  create(ctx, args = {}) {
    // Build the application's content and menus here.
  }
});
```

`minWidth`, `minHeight`, and `singleton` are optional. `ctx` contains `os`, `win`, `content`, `setMenu`, `setTitle`, `onClose`, `onResize`, and `cleanup`. The content region fills the available window area using `flex: 1` and `min-height: 0`; each application supplies its own inner layout.

| Context method | Behavior |
|---|---|
| `ctx.setTitle(title)` | Updates the window title. |
| `ctx.setMenu(menus)` | Replaces the application's menu definitions. |
| `ctx.onClose(callback)` | Registers a close guard. Return `false` to keep the window open; promises are supported. |
| `ctx.onResize(callback)` | Subscribes to window content-size changes. |
| `ctx.cleanup(callback)` | Registers cleanup for listeners, timers, and other resources when the window closes. |

Menus use ampersands to mark mnemonics and can contain separators, shortcuts, check marks, disabled items, and submenus:

```js
ctx.setMenu([
  {
    label: '&File',
    items: [
      { label: '&New', shortcut: 'Ctrl+N', action: newDocument },
      { separator: true },
      { label: 'E&xit', action: () => ctx.win.close() }
    ]
  }
]);
```

An item's optional `checked` and `disabled` fields control its state. Its optional `items` field supplies submenu entries. Menu actions should perform their advertised operation or open an appropriate dialog.

## Window interface

`win` exposes `id`, `element`, and `content`, plus these methods:

- `setTitle(title)` and `setMenu(menus)`
- `close()`, `minimize()`, `maximize()`, `restore()`, and `focus()`
- `on(event, callback)`, which returns an unsubscribe function; events include `resize`, `focus`, and `close`

`win.state` contains `x`, `y`, `width`, `height`, `minimized`, and `maximized`. `win.element` supports DOM event handlers for application-scoped keyboard input. Only the active window should process application keys. Register cleanup for listeners attached to global targets.

## Desktop services

| API | Behavior |
|---|---|
| `os.open(id, args)` | Opens an application and returns its window. |
| `os.run(commandLine)` | Resolves a supported executable name or file association. |
| `os.openFile(path)` | Opens a virtual file through its application association. |
| `os.message(text, title = 'Windows')` | Shows a message and returns a promise. |
| `os.confirm(text, title = 'Windows')` | Returns `Promise<boolean>`. |
| `os.prompt(title, label, initialValue = '')` | Returns `Promise<string \| null>`. |
| `os.dialog(options)` | Displays a custom dialog and resolves to the selected button value. Options include `title`, `body` (an element or string), `buttons`, and optional `width`. Buttons have `label`, `value`, and optional `default`. |
| `os.pickFile(options)` | Selects a virtual file and returns `Promise<string \| null>`. Options include `title`, `save`, `filename`, `initialDir`, and `filter`. |
| `os.importFiles()` | Imports files selected from the user's computer into the virtual disk. |
| `os.print(title, html)` | Queues a document for the browser's print interface. |
| `os.copyText(text)` and `os.pasteText()` | Access the desktop text clipboard. |
| `os.playSound(kind = 'click')` | Plays a supported system sound. |
| `os.about(title, details)` | Opens an About dialog. |
| `os.addCleanup(callback)` | Registers desktop-level cleanup. |

`os.clipboard` stores `{ text, files, cut }`. `os.settings` contains preferences; `os.saveSettings()` persists them and `os.applySettings()` applies them. `os.events` is an `EventTarget` used for events such as `settingschange`, `fschange`, and `appopen`.

`os.apps` is a map of application definitions. `os.wm.windows` lists windows; `os.wm.tile()`, `os.wm.cascade()`, and `os.wm.arrangeIcons()` arrange them. `os.renderer?.backend` identifies the active graphics backend. `os.storage.get(key, fallback)` and `os.storage.set(key, value)` read and write JSON preferences.

Errors from application actions should be reported through `os.message`. Native file selection is reserved for explicit imports; ordinary file operations use the virtual file picker.

## Virtual filesystem

The filesystem exposes synchronous in-memory operations with persistence. Await `os.fs.ready` when an operation depends on initial loading. Filesystem errors throw exceptions, and change subscriptions run after updates.

| API | Result or behavior |
|---|---|
| `exists(path)` | Tests whether a path exists. |
| `readFile(path)` | Returns file content as a string. |
| `writeFile(path, content)` | Creates or replaces a file. |
| `mkdir(path, { recursive: true })` | Creates a directory and any required parents. |
| `readdir(path)` | Returns entries with `name`, `path`, `type`, `size`, and `modified`; type is `file` or `directory`. |
| `stat(path)` | Returns metadata for one entry. |
| `remove(path, { recursive: true })` | Removes an entry, including directory contents when requested. |
| `rename(oldPath, newPath)` | Moves or renames an entry. |
| `copy(source, destination)` | Copies an entry recursively. |
| `normalize(path, cwd)` | Normalizes a path, with `C:\` as the default working directory. Paths are case insensitive. |
| `parent(path)` and `basename(path)` | Return the parent directory or final path component. |
| `subscribe(callback)` | Subscribes to changes and returns an unsubscribe function. |
| `snapshot()` and `restore(snapshot)` | Export and restore serializable filesystem state. |

These methods are called on `os.fs`. Default directories include `C:\WINDOWS`, `C:\WINDOWS\SYSTEM`, `C:\DOCUMENTS`, and `C:\TEMP`. Sample documents include `WELCOME.TXT`, `README.TXT`, `NOTES.TXT`, `CALENDAR.CAL`, and `SAMPLE.WRI` in `C:\DOCUMENTS`.

## Theme and application styles

The shared theme uses `var(--font-ui)` at a **13px base size**. Program and minimized-window icon captions use **11px regular-weight** bitmap-style type. Font attribution and the limits of visual matching are documented in [REFERENCES.md](./REFERENCES.md).

| CSS variable | Standard value |
|---|---|
| `--face` | `#c0c0c0` |
| `--window` | `#ffffff` |
| `--text` | `#000000` |
| `--selection` | `#000080` |
| `--selection-text` | `#ffffff` |
| `--desktop` | `#c0c0c0` |

Shared classes include `.win-button`, `.sunken`, `.raised`, `.field`, `.dialog-body`, `.dialog-actions`, `.toolbar`, `.statusbar`, `.listbox`, `.win-input`, `.win-select`, `.separator`, and `.inset`.

Each package's `styles.css` sits alongside its `index.js`; package styles are included by the desktop entry page or its build. Prefix application-specific classes, such as `.calc-`, `.paint-`, or `.fm-`, to avoid affecting other applications.

## Compatibility

Applications recreate useful Windows 3.1 workflows using browser APIs. Executable-name dispatch launches the recreation's registered applications; it does not execute native Windows or DOS binaries. Host file access, printing, sound, and clipboard operations remain subject to browser capabilities and permissions.
