# Windows desktop core modules

Native ES modules with no package or runtime dependencies. `package.json` marks the files as modules for the optional Node test command; the browser imports the JavaScript files directly.

## Integration

```js
import { VirtualFileSystem } from './dist/packages/core/filesystem.js';
import { SafeStorage } from './dist/packages/core/storage.js';
import { DesktopRenderer } from './dist/packages/render/index.js';

const storage = new SafeStorage('win31:');
const settings = storage.get('settings', {
  desktopColor: '#c0c0c0',
  wallpaperPattern: 'none',
});

const fs = new VirtualFileSystem({
  onStorageError(error, { recovered, backend }) {
    // Surface unrecovered errors so users can export unsaved work.
  },
});
await fs.ready; // Hydrate the existing disk before enabling file actions.

const renderer = new DesktopRenderer(document.querySelector('#desktop-canvas'), settings);
await renderer.init();
```

The desktop canvas should already be mounted and sized through CSS, for example `position:absolute; inset:0; width:100%; height:100%; pointer-events:none`. Keep windows above it. The renderer draws the desktop background; the application shell owns DOM windows, controls, and text.

## VirtualFileSystem

All file methods are synchronous and immediately operate on the in-memory drive. Paths normalize to uppercase Windows syntax. Forward slashes, relative names, drive-relative names, `.` and `..` are accepted. The root is always `C:\` and traversal cannot leave it. Only drive C is available. Long names are supported; invalid DOS characters and reserved device names are rejected.

| API | Result / behavior |
| --- | --- |
| `normalize(path, cwd='C:\\')` | Canonical, case-insensitive path. |
| `parent(path)`, `basename(path)` | Parent path or filename; root has itself as parent and `C:` as basename. |
| `exists(path)` | Boolean; syntactically invalid paths throw. |
| `stat(path)` | `{name,path,type,size,modified,created}`; dates are ISO strings, sizes are UTF-8 byte counts. |
| `readdir(path='C:\\')` | Immediate child stats; directories first, then names. |
| `readFile(path)` | String content. |
| `writeFile(path, content)` | Creates or replaces a text file; requires an existing parent; returns canonical path. |
| `mkdir(path, {recursive:false})` | Creates a directory; recursive mode also creates ancestors and tolerates an existing directory. |
| `remove(path, {recursive:false})` | Removes a file or empty directory; populated directories require explicit recursion. |
| `copy(source,destination,{overwrite:false})` | Copies an entire tree to the **exact destination path**. |
| `rename(source,destination,{overwrite:false})` | Moves an entire tree to the exact path. `move` is an alias. |
| `subscribe(listener)` | Returns an unsubscribe function. Listeners run after complete transactions. |
| `snapshot()` | Detached, serializable `{version:1,entries:[...]}` disk image. |
| `restore(snapshot)` | Validates the complete tree, then atomically replaces the disk; also unblocks persistence after an explicitly handled load failure. |
| `ready` | Promise resolving to the filesystem after loading or reporting a storage error. |
| `flush()` | Promise resolving after all current revisions are saved; rejects on failure. |
| `dispose()` | Flushes, closes the persistence connection, and removes listeners. |

`copy` and `rename` do not append the source name when the destination is a directory. File Manager should supply `destinationDirectory + '\\' + fs.basename(source)`. Existing destinations require `{overwrite:true}` after the application's own overwrite flow. Tree overlaps, invalid ancestors, and prohibited root operations fail before any state is committed.

Errors are `FileSystemError` objects with `code`, `message`, and usually `path`. Codes include `EINVAL`, `ENOENT`, `ENOTDIR`, `EISDIR`, `EEXIST`, `ENOTEMPTY`, `EPERM`, `EDRIVE`, `EBADSNAPSHOT`, and `ECLOSED`.

File change events include `type` (`write`, `mkdir`, `remove`, `copy`, `rename`, `restore`, or `ready`), `path`, and `revision`; transfers also include `source` and `destination`. Persistence changes emit `type:'persistence'` with the state described below. Subscriber errors do not undo filesystem mutations.

### Persistence and failures

The browser defaults to IndexedDB, using database `win31-browser-disk`, store `snapshots`, and key `drive-c`. Saves are serialized; a mutation arriving during a write is included in the next saved revision. A failed IndexedDB write falls back to localStorage under `win31:disk:v1`. Reopening chooses the latest valid version across both stores. The disk is local to this browser profile and origin.

`fs.persistence` is a live object with `backend` (`indexeddb`, `localStorage`, `memory`, or a custom adapter label), `status` (`loading`, `pending`, `saving`, `saved`, `error`), `lastError`, `warning`, and `savedRevision`. An unavailable or full durable store leaves the current files in memory and reports the failure; a later `flush()` retries. `ready` resolves even if loading fails so the shell can open a recovery dialog. Inspect `fs.persistence.status` rather than treating resolution as proof of a durable save.

An unreadable or corrupted saved store is never silently replaced. After a load failure, further saves are blocked until the application explicitly calls `restore()` with a validated snapshot. The shell can offer snapshot export and recovery. Edits made before hydration are replayed over the loaded disk; if an operation conflicts with the stored tree, the current in-memory work is retained and persistence is blocked. Awaiting `ready` before enabling file actions avoids this startup ambiguity.

Browser storage can be removed through site-data controls and may be evicted. A snapshot export is the durable user backup mechanism. Independent tabs each hold a memory snapshot, so simultaneous editing in multiple tabs follows last-completed-save behavior; this module does not implement cross-tab collaborative locking. Native filesystem access is not implied.

The constructor accepts:

```js
new VirtualFileSystem({
  seed: true,                 // false for an empty C:\ drive, or supply a snapshot
  clock: () => new Date(),    // injectable for reproducible metadata
  storage: adapter,          // optional {load(): Promise<snapshot|null>, save(snapshot): Promise<void>, close?()}
  onStorageError(error, details) {},
  // When using the default browser adapter:
  databaseName: 'win31-browser-disk',
  key: 'drive-c',
  fallbackKey: 'win31:disk:v1',
  indexedDB: globalThis.indexedDB,
  localStorage: globalThis.localStorage,
});
```

Omit `storage` for normal browser persistence. `storage:null` selects an isolated memory adapter. `MemoryDiskStorage` and `BrowserDiskStorage` are named exports for testing or embedding. In a non-browser Node host, the default is memory storage. Default seed files include usable text documents, a plain-text `SAMPLE.WRI`, JSON `CALENDAR.CAL` (`{version:1,events:[]}`), and readable `.INI`, `.BAT`, and `.SYS` configuration examples with dates from 1993. Configuration files do not change browser preferences or execute native programs. No placeholder `.EXE`, driver, or font binaries are created.

## SafeStorage

`new SafeStorage('win31:')` is shorthand for `new SafeStorage({prefix:'win31:'})`. An options object can also supply `storage` (a localStorage-compatible object or `null`) and `onError`.

- `get(key, fallback=null)` returns parsed JSON, or the fallback after a missing, denied, or malformed read.
- `set(key,value)` returns `true` when saved durably and `false` otherwise. A denied write keeps the latest JSON value in memory for the session.
- `remove(key)` removes that preference; a denied removal remains removed in the session.
- `lastError`, `backend`, and `subscribe(listener)` expose errors without breaking application controls.
- `createSafeStorage(options)` is a convenience factory.

Malformed JSON is reported and does not throw from `get`. Circular or undefined values return `false` from `set`. Preference storage uses no timers or persistent global event handlers.

## DesktopRenderer

The class exports `init()`, `resize(width?,height?)`, `draw()`, `setTheme(settings)`, and `dispose()`. `init()` resolves to the renderer and is idempotent. `backend` reflects the real active graphics path: `WebGPU`, `WebGL2`, `Canvas2D`, or `Unavailable`. `warnings` contains the last ten graphics fallback messages; `error` records a terminal drawing failure.

WebGPU creates a WGSL shader module, render pipeline, uniform buffer, bind group, and full-canvas triangle draw. WebGL2 uses equivalent vertex and fragment shaders. Canvas2D produces the same discrete tile patterns. There is no animation loop: resize, theme changes, and explicit `draw()` calls coalesce into a single animation frame, with no frames scheduled while idle.

| Theme setting | Accepted values |
| --- | --- |
| `desktopColor` | Hex, common named color, `rgb(...)`, or RGB array. `desktop` and `backgroundColor` are aliases. Default `#c0c0c0`. |
| `desktopPattern` | `none`, `dots`, `checker`, `diagonal`, `crosshatch`, `weave`, `bricks`, `grid`; `wallpaperPattern` and `pattern` are aliases. |
| `patternColor` | Same color syntax; defaults to a darker desktop color. |
| `patternScale` | Logical pixel size from 1 through 8. |
| `onBackendChange(backend,previous)` | Optional callback after graphics path changes. |
| `onCanvasReplacement(next,previous)` | Optional callback if an exclusive canvas context requires a replacement element. |

`rendererchange` also bubbles from the active canvas with `{backend,previous,renderer}` in its detail. Device loss automatically falls back from WebGPU to WebGL2, and context loss falls back to Canvas2D. Because browser canvas context types are exclusive, fallback may replace the original canvas with a clone retaining its HTML attributes, id, classes, and inline styles. `renderer.canvas` always refers to the active element. Use the replacement callback if the shell keeps its own reference or attaches canvas-specific event listeners.

Resize uses CSS dimensions and device pixel ratio, capped at 3 and the current device's texture limit. A `ResizeObserver` and window resize listener request redraws. Call `dispose()` to cancel the pending frame, disconnect observers/listeners, and release graphics resources.

## PixelOperations

`pixel-ops.js` exports a separate reusable WebGPU compute service for Paintbrush's real image operations. It accepts `ImageData` or `{width,height,data:Uint8ClampedArray}` and returns a new object of the same kind. The original image is never changed. Invert changes RGB with exact integer arithmetic while preserving alpha; flips move complete RGBA pixels without color conversions.

```js
import { PixelOperations } from './dist/packages/render/pixel-ops.js';

const pixels = new PixelOperations();
await pixels.init();
const original = context.getImageData(0, 0, canvas.width, canvas.height);
const transformed = await pixels.transform(original, 'invert');
context.putImageData(transformed, 0, 0);
// Also: 'flip-horizontal', 'flip-vertical'
pixels.dispose();
```

The optional constructor argument `{device}` reuses a supplied WebGPU device without destroying it when disposed. Without one, the module requests a low-power adapter and owns the device it creates. `init()` is idempotent and `transform()` initializes automatically. `backend` is `WebGPU` or `CPU` after initialization and reflects the most recent operation; `lastBackend` reports the most recently completed operation. `warnings`, `error`, and optional `onBackendChange(backend,previous)` expose fallback details.

GPU execution uses an actual WGSL compute pipeline with 8×8 workgroups, packed RGBA `u32` storage buffers, a uniform parameter buffer, a submitted command buffer, and asynchronous mapped readback. All GPU allocations are padded to 256 bytes, and dimensions, dispatch limits, storage-binding limits, and maximum buffer size are checked before dispatch. The default per-pixel-buffer cap is 64 MiB; `{maxBufferBytes}` may reduce or raise it within device limits. Three pixel buffers plus a 256-byte parameter buffer are allocated per operation and destroyed immediately afterward. Work is serialized so repeated operations do not accumulate simultaneous GPU allocations.

Unavailable GPUs, validation or allocation errors, device loss, and readback errors use the integer TypedArray fallback. Oversized images use the CPU for that call and leave the GPU available for later supported images. Device failure disables further GPU attempts for that instance. A lost device interrupts a pending map wait; `dispose()` rejects queued/incomplete work and releases owned resources. Images are snapshotted at call time to prevent races with later caller mutations. A little-endian host check protects the packed pixel representation. Browser `ImageData` color-space metadata is preserved; operations change stored byte values directly.

## Screen saver

`screen-saver.js` exports `startScreenSaver(host, settings)` and `GPUScreenSaver`. The function immediately appends a full-host canvas and returns a synchronous disposal function. The application owns its overlay, input dismissal, and idle timer; the module adds no input handlers.

```js
import { startScreenSaver } from './dist/packages/render/screen-saver.js';
const dispose = startScreenSaver(overlay, { kind: 'mystify' });
// Later, when the application's existing dismissal handler runs:
dispose();
```

Supported `kind` values are `blank`, `stars`, and `mystify`. Blank uses a black canvas and no animation frames or GPU request. Stars uses perspective-projected, instanced star billboards moving toward the viewer. Mystify uses instanced colored polygon-outline segments with twelve moving trails. Both animated effects use actual WebGPU render pipelines with time/size uniforms, alpha blending, and command submission; Canvas2D provides animated equivalents when WebGPU is unavailable, validation fails, or the device is lost.

Settings also accept `device` (optional shared WebGPU device), `speed` (0.1–5, default 1), `fps` (10–60, default 30), `starCount` (50–1200, default 450), `seed`, `brightness` (0.1–1), and `onBackendChange`. The returned disposal function has read-only `ready`, `backend`, `canvas`, `error`, and `warnings` properties for diagnostics. `ready` resolves after graphics initialization. A device supplied by the caller is never destroyed.

Animation exists only while the saver is active. Disposal cancels the animation frame, removes the canvas and resize observer/listener, and releases owned GPU resources. Canvas replacement handles browser context exclusivity during fallback. Host CSS should establish a positioned container, as the application's fixed fullscreen dismissal overlay naturally does.

## Verification

Run `npm test` from the project root. The suite checks path/root invariants, atomic failure behavior, recursive copying/moving, snapshot validation, concurrent persistence revisions, startup replay, corruption handling, quota errors, JSON preferences, full-canvas WebGPU submission, event-driven redraws, device/context fallback, exact RGBA compute results, GPU limits and readback failures, alpha preservation, animated screen-saver geometry submission, and resource cleanup with isolated mocks. The integration run verified durable reload behavior with the Canvas 2D and CPU fallbacks. GPU tests use mocks; actual WebGPU/WebGL driver and shader validation remains to be performed on suitable hardware.
