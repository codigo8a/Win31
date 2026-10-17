# Win31 — Utilidades extraídas de la documentación

Síntesis de lo útil de docs/ para crear apps, ventanas y gestionar el filesystem.

## Apps registradas

- **system**: filemanager, dos, printmanager, terminal, pifeditor, setup, regedit, packager, control
- **productivity**: notepad, write, calculator, calendar, cardfile, charmap, clipboard
- **media**: paintbrush, clock, mediaplayer, soundrecorder, recorder
- **games**: minesweeper, solitaire

## Registrar app

```js
os.registerApp({
  id: 'example', title: 'Example', icon: 'example',
  width: 600, height: 400, minWidth: 250, minHeight: 150, singleton: false,
  create(ctx, args = {}) { /* ... */ }
});
```

`ctx`: os, win, content, setMenu, setTitle, onClose, onResize, cleanup.

## Servicios desktop (os)

- os.open(id, args), os.run(cmd), os.openFile(path)
- os.message(text, title), os.confirm(text, title), os.prompt(title, label, initial)
- os.dialog(options), os.pickFile(options), os.importFiles()
- os.print(title, html), os.copyText(text), os.pasteText()
- os.playSound(kind), os.about(title, details), os.addCleanup(cb)
- os.settings, os.saveSettings(), os.applySettings()
- os.events (EventTarget): settingschange, fschange, appopen
- os.apps, os.wm (tile, cascade, arrangeIcons), os.renderer?.backend
- os.storage.get(key, fallback), os.storage.set(key, value)
- os.fs (filesystem virtual), os.clipboard {text, files, cut}

## Ventana (win)

id, element, content; setTitle, setMenu, close, minimize, maximize, restore, focus; on(event, cb) (resize, focus, close); state {x,y,width,height,minimized,maximized}.

## Filesystem virtual (os.fs)

normalize, parent, basename, exists, stat, readdir, readFile, writeFile, mkdir({recursive}), remove({recursive}), copy(src,dst,{overwrite}), rename/move(src,dst,{overwrite}), subscribe(cb), snapshot(), restore(snapshot), ready, flush(), dispose().

Errores: FileSystemError con code (EINVAL, ENOENT, ENOTDIR, EISDIR, EEXIST, ENOTEMPTY, EPERM, EDRIVE, EBADSNAPSHOT, ECLOSED).

Eventos de cambio: type (write, mkdir, remove, copy, rename, restore, ready), path, revision; transfers incluyen source/destination. Persistencia: type:'persistence'.

Persistencia: IndexedDB (db win31-browser-disk, store snapshots, key drive-c) con fallback localStorage (win31:disk:v1). fs.persistence: backend, status, lastError, warning, savedRevision.

## Formatos de archivo

- Cardfile .CRD: JSON `{version:1, cards:[{id,title,text}]}`
- Calendar .CAL: `{version:1, events:[]}`
- PIF: `{format:"windows31-browser-pif", ...}`
- Terminal .TRM: `{format:"windows31-browser-terminal", ...}`
- Package .PKG: `{format:"windows31-browser-package", label, icon, mode, source, command, content}`
- Registration .REG: objeto JSON plano de settings
- Recorder .REC/.MACRO: `{format:'win31-launch-macro', version:1, events:[{at,id,args}]}`

## Control Panel panels

color, fonts, ports, mouse, desktop, keyboard, printers, international, datetime, sound, drivers.

## Asociaciones de archivos

Directorios → filemanager {path}; .PIF → pifeditor; .TRM → terminal; .REG → regedit; .PKG → packager. Executables: WINFILE.EXE, COMMAND.COM, PRINTMAN.EXE, TERMINAL.EXE, PIFEDIT.EXE, SETUP.EXE, REGEDIT.EXE, PACKAGER.EXE, CONTROL.EXE.

## Storage seguro (SafeStorage)

```js
const storage = new SafeStorage('win31:');
storage.get(key, fallback); storage.set(key, value); storage.remove(key);
```

## Render (DesktopRenderer)

WebGPU/WebGL2/Canvas2D; init(), resize(), draw(), setTheme(settings), dispose(); backend, warnings, error.

## PixelOperations

transform(imageData, 'invert' | 'flip-horizontal' | 'flip-vertical').

## Screen saver

startScreenSaver(host, {kind:'blank'|'stars'|'mystify', ...}).

## DOM helpers

el, button, field, icon, clear, download (de ../core/dom.js).
