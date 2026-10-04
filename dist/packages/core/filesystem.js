const ROOT = "C:\\";
const VERSION = 1;
const DEFAULT_DATE = "1993-11-01T09:00:00.000Z";
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export class FileSystemError extends Error {
  constructor(code, message, path) {
    super(path ? `${message}: ${path}` : message);
    this.name = "FileSystemError";
    this.code = code;
    this.path = path;
  }
}

const fail = (code, message, path) => {
  throw new FileSystemError(code, message, path);
};
const beneath = (path, directory) =>
  directory === ROOT
    ? path !== ROOT && path.startsWith(ROOT)
    : path.startsWith(directory + "\\");
const bytes = (text) => new TextEncoder().encode(text).byteLength;
const cloneJSON = (value) => JSON.parse(JSON.stringify(value));

function normalizeAbsolute(input, base = []) {
  if (typeof input !== "string" || !input.trim())
    fail("EINVAL", "A path is required");
  let path = input.replaceAll("/", "\\");
  if (path.startsWith("\\\\"))
    fail("EDRIVE", "Network drives are not available", input);
  const drive = /^([a-z]):/i.exec(path);
  if (drive) {
    if (drive[1].toUpperCase() !== "C")
      fail("EDRIVE", "Only drive C: is available", input);
    path = path.slice(2);
    if (!path || path.startsWith("\\")) base = [];
  } else if (path.startsWith("\\")) base = [];
  const parts = [...base];
  for (const raw of path.split("\\")) {
    if (!raw || raw === ".") continue;
    if (raw === "..") {
      parts.pop();
      continue;
    }
    if (/[\x00-\x1f<>:"|?*]/.test(raw) || /[ .]$/.test(raw)) {
      fail(
        "EINVAL",
        "This name contains invalid characters or ends in a dot or space",
        input,
      );
    }
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(raw)) {
      fail("EINVAL", "This name is reserved by DOS", input);
    }
    parts.push(raw.toUpperCase());
  }
  return ROOT + parts.join("\\");
}

export function normalizePath(path, cwd = ROOT) {
  const basePath = normalizeAbsolute(cwd);
  const base = basePath === ROOT ? [] : basePath.slice(3).split("\\");
  return normalizeAbsolute(path, base);
}

const parentOf = (path) => {
  if (path === ROOT) return ROOT;
  const index = path.lastIndexOf("\\");
  return index <= 2 ? ROOT : path.slice(0, index);
};
const basenameOf = (path) =>
  path === ROOT ? "C:" : path.slice(path.lastIndexOf("\\") + 1);

function info(path, entry) {
  return {
    name: basenameOf(path),
    path,
    type: entry.type,
    size: entry.type === "file" ? bytes(entry.content) : 0,
    modified: entry.modified,
    created: entry.created,
  };
}

function requireEntry(entries, path) {
  const entry = entries.get(path);
  if (!entry) fail("ENOENT", "The file or directory does not exist", path);
  return entry;
}

function requireDirectory(entries, path) {
  const entry = requireEntry(entries, path);
  if (entry.type !== "directory")
    fail("ENOTDIR", "The path is not a directory", path);
  return entry;
}

function touchParent(entries, path, timestamp) {
  const parent = parentOf(path);
  const entry = entries.get(parent);
  if (entry) entries.set(parent, { ...entry, modified: timestamp });
}

function validateSnapshot(snapshot) {
  if (
    !snapshot ||
    snapshot.version !== VERSION ||
    !Array.isArray(snapshot.entries)
  ) {
    fail("EBADSNAPSHOT", "The disk snapshot has an unsupported format");
  }
  const entries = new Map();
  for (const raw of snapshot.entries) {
    if (!raw || typeof raw.path !== "string")
      fail("EBADSNAPSHOT", "An entry has no path");
    const path = normalizePath(raw.path);
    if (entries.has(path))
      fail("EBADSNAPSHOT", "The disk has duplicate paths", path);
    if (raw.type !== "file" && raw.type !== "directory") {
      fail("EBADSNAPSHOT", "An entry has an invalid type", path);
    }
    if (raw.type === "file" && typeof raw.content !== "string") {
      fail("EBADSNAPSHOT", "A file has invalid content", path);
    }
    if (
      typeof raw.modified !== "string" ||
      !Number.isFinite(Date.parse(raw.modified))
    ) {
      fail("EBADSNAPSHOT", "An entry has an invalid modification date", path);
    }
    const created = raw.created ?? raw.modified;
    if (typeof created !== "string" || !Number.isFinite(Date.parse(created))) {
      fail("EBADSNAPSHOT", "An entry has an invalid creation date", path);
    }
    entries.set(path, {
      type: raw.type,
      created: new Date(created).toISOString(),
      modified: new Date(raw.modified).toISOString(),
      ...(raw.type === "file" ? { content: raw.content } : {}),
    });
  }
  if (entries.get(ROOT)?.type !== "directory") {
    fail("EBADSNAPSHOT", "The disk must contain its root directory");
  }
  for (const path of entries.keys()) {
    if (path !== ROOT && entries.get(parentOf(path))?.type !== "directory") {
      fail("EBADSNAPSHOT", "An entry is missing its parent directory", path);
    }
  }
  return entries;
}

function snapshotOf(entries) {
  return {
    version: VERSION,
    entries: [...entries]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, entry]) => ({ path, ...entry })),
  };
}

/** Seed data are real, readable documents/configuration, never placeholder executables. */
export function createSeedSnapshot() {
  const entries = [];
  const directory = (path) =>
    entries.push({
      path,
      type: "directory",
      created: DEFAULT_DATE,
      modified: DEFAULT_DATE,
    });
  const file = (path, content) =>
    entries.push({
      path,
      type: "file",
      content: content.replaceAll("\n", "\r\n"),
      created: DEFAULT_DATE,
      modified: DEFAULT_DATE,
    });
  [
    ROOT,
    "C:\\WINDOWS",
    "C:\\WINDOWS\\SYSTEM",
    "C:\\DOCUMENTS",
    "C:\\TEMP",
  ].forEach(directory);
  file(
    "C:\\DOCUMENTS\\WELCOME.TXT",
    `Welcome to Microsoft Windows 3.1\n\nThis desktop is an interactive browser recreation.\n\nDouble-click an icon in Program Manager to open a program. Use File Manager to browse drive C:, create folders, rename documents, and organize your work. Notepad edits text; Write prepares documents; Paintbrush creates pictures.\n\nYour virtual drive is saved on this browser and device when browser storage is available. Use Export or Download to keep an independent copy of important work. Clearing site data removes this virtual drive.\n\nThis desktop runs browser applications. It does not execute native DOS or Windows binaries.\n\nTip: choose Run from Program Manager's File menu to launch a known program or open a document.\n`,
  );
  file(
    "C:\\DOCUMENTS\\README.TXT",
    `YOUR WORKSPACE\n==============\n\nC:\\DOCUMENTS  Documents, pictures, and calendar data\nC:\\WINDOWS    Readable Windows configuration examples\nC:\\TEMP       A place for temporary files\n\nUseful programs\n---------------\nNOTEPAD   Plain text editor\nWRITE     Document editor\nPBRUSH    Paintbrush\nCALC      Calculator\nWINFILE   File Manager\nCONTROL   Control Panel\n\nThese names select programs included in this browser desktop. Native executable files are not supported.\n\nTry this\n--------\n1. Open NOTES.TXT in Notepad.\n2. Add a few lines and choose File > Save.\n3. Create a folder in File Manager.\n4. Copy your notes into that folder.\n\nThe disk uses case-insensitive C:\\ paths. Long names are supported for convenience.\n`,
  );
  file(
    "C:\\DOCUMENTS\\NOTES.TXT",
    `Project notes\n-------------\n\nThings to try today:\n[ ] Explore the Main program group\n[ ] Change the desktop colors\n[ ] Write and save a short document\n[ ] Draw a picture in Paintbrush\n[ ] Play a game\n\nMeeting notes\nDate:\nSubject:\nActions:\n\n`,
  );
  file(
    "C:\\DOCUMENTS\\SAMPLE.WRI",
    `A Letter from the Desktop\n\nDear friend,\n\nWelcome to your new workspace. A few small windows can hold a surprising amount of possibility: a page of ideas, a sketch, an appointment, or a game between tasks.\n\nUse this sample as the beginning of a letter. Change the words, try the formatting controls, and save a copy under a new name.\n\nBest wishes,\nThe Windows desktop\n`,
  );
  file(
    "C:\\DOCUMENTS\\CALENDAR.CAL",
    JSON.stringify({ version: 1, events: [] }, null, 2),
  );
  file(
    "C:\\AUTOEXEC.BAT",
    `@ECHO OFF\nPROMPT $P$G\nPATH C:\\WINDOWS;C:\\DOS\nSET TEMP=C:\\TEMP\nREM Configuration example. Native DOS commands are not executed by this desktop.\n`,
  );
  file(
    "C:\\CONFIG.SYS",
    `REM Windows 3.1 configuration example\nFILES=40\nBUFFERS=20\nDOS=HIGH,UMB\nLASTDRIVE=C\n`,
  );
  file(
    "C:\\WINDOWS\\WIN.INI",
    `[windows]\nload=\nrun=\nNullPort=None\n\n[desktop]\nWallpaper=(None)\nTileWallpaper=0\nPattern=(None)\n\n[extensions]\ntxt=notepad.exe ^.txt\nwri=write.exe ^.wri\nbmp=pbrush.exe ^.bmp\n\n[fonts]\n; Fonts are supplied by the browser desktop.\n`,
  );
  file(
    "C:\\WINDOWS\\SYSTEM.INI",
    `[boot]\nshell=progman.exe\n\n[386Enh]\n; Browser recreation: these settings are readable examples.\n; Editing this file does not alter the host computer.\n`,
  );
  file(
    "C:\\WINDOWS\\CONTROL.INI",
    `[Patterns]\n(None)=0 0 0 0 0 0 0 0\nGray=85 170 85 170 85 170 85 170\nBricks=255 128 128 128 255 8 8 8\n\n[Current]\nColor Schemes=Windows Standard\n`,
  );
  file(
    "C:\\WINDOWS\\PROGMAN.INI",
    `[Settings]\nAutoArrange=0\nMinOnRun=0\nSaveSettings=1\n\n[Groups]\nGroup1=Main\nGroup2=Accessories\nGroup3=Games\n`,
  );
  file(
    "C:\\WINDOWS\\README.TXT",
    `WINDOWS CONFIGURATION FILES\n\nThe INI, BAT, and SYS files in this virtual disk are editable configuration examples. Desktop preferences are applied through Control Panel and stored separately by the browser application.\n\nNo file in this disk changes the host operating system. Programs are implemented as browser applications. This is not a native x86 emulator.\n`,
  );
  file(
    "C:\\WINDOWS\\SYSTEM\\README.TXT",
    `SYSTEM DIRECTORY\n\nThe original Windows 3.1 stored device drivers and shared libraries here. This browser desktop uses WebGPU, WebGL, or Canvas for the desktop background and standard browser interfaces for its applications.\n\nThere are no executable placeholder drivers in this directory.\n`,
  );
  return { version: VERSION, entries };
}

/** A deterministic, dependency-free persistence adapter, useful for embedding and tests. */
export class MemoryDiskStorage {
  constructor(snapshot = null) {
    this.backend = "memory";
    this.value = snapshot ? cloneJSON(snapshot) : null;
  }
  async load() {
    return this.value ? cloneJSON(this.value) : null;
  }
  async save(snapshot) {
    this.value = cloneJSON(snapshot);
  }
  close() {}
}

/** IndexedDB snapshot storage with localStorage failover and explicit error reporting. */
export class BrowserDiskStorage {
  constructor(options = {}) {
    this.databaseName = options.databaseName ?? "win31-browser-disk";
    this.key = options.key ?? "drive-c";
    this.fallbackKey = options.fallbackKey ?? "win31:disk:v1";
    this.backend = "loading";
    this.lastError = null;
    this.warning = null;
    this._onError = options.onError;
    this._sequence = 0;
    this._closed = false;
    if (own(options, "indexedDB")) this._indexedDB = options.indexedDB;
    else {
      try {
        this._indexedDB = globalThis.indexedDB;
      } catch (error) {
        this.warning = error;
      }
    }
    if (own(options, "localStorage")) this._localStorage = options.localStorage;
    else {
      try {
        this._localStorage = globalThis.localStorage;
      } catch (error) {
        this.warning = error;
      }
    }
  }

  async load() {
    let primary = null;
    let fallback = null;
    let primaryOK = false;
    let fallbackOK = false;
    let primaryError;
    let fallbackError;
    if (this._localStorage) {
      try {
        const raw = this._localStorage.getItem(this.fallbackKey);
        fallback = raw == null ? null : this._decode(JSON.parse(raw));
        fallbackOK = true;
      } catch (error) {
        fallbackError = error;
      }
    }
    if (this._indexedDB) {
      try {
        primary = this._decode(await this._readIndexed());
        primaryOK = true;
      } catch (error) {
        primaryError = error;
      }
    }
    // A store that could not be read must not be overwritten later in this session.
    this._primaryReadable = primaryOK;
    const corrupt = [primaryError, fallbackError].find(
      (error) => error?.code === "EBADSNAPSHOT" || error instanceof SyntaxError,
    );
    if (corrupt && !primary && !fallback) {
      this.backend = primaryOK
        ? "indexeddb"
        : fallbackOK
          ? "localStorage"
          : "memory";
      this._report(corrupt, false);
      throw corrupt;
    }
    if (!primaryOK && !fallbackOK) {
      this.backend = "memory";
      const error =
        primaryError ??
        fallbackError ??
        new Error("Persistent browser storage is unavailable.");
      this._report(error, false);
      // Failure to read an existing store must not silently replace its data.
      if (primaryError || fallbackError) throw error;
      return null;
    }
    this.backend = primaryOK ? "indexeddb" : "localStorage";
    if (primaryError || fallbackError)
      this._report(primaryError ?? fallbackError, true);
    const latest = !primary
      ? fallback
      : !fallback
        ? primary
        : fallback.updatedAt > primary.updatedAt ||
            (fallback.updatedAt === primary.updatedAt &&
              fallback.sequence > primary.sequence)
          ? fallback
          : primary;
    this._sequence = latest?.sequence ?? 0;
    return latest?.snapshot ?? null;
  }

  async save(snapshot) {
    if (this._closed) throw new Error("The virtual disk has been closed.");
    const record = {
      format: "win31-disk",
      version: 1,
      sequence: ++this._sequence,
      updatedAt: Date.now(),
      snapshot,
    };
    let primaryError;
    if (this._indexedDB && this._primaryReadable !== false) {
      try {
        await this._writeIndexed(record);
        this.backend = "indexeddb";
        this.lastError = null;
        return;
      } catch (error) {
        primaryError = error;
      }
    }
    if (this._localStorage) {
      try {
        this._localStorage.setItem(this.fallbackKey, JSON.stringify(record));
        this.backend = "localStorage";
        this.lastError = null;
        if (primaryError) this._report(primaryError, true);
        return;
      } catch (error) {
        this.backend = "memory";
        this._report(error, false);
        throw error;
      }
    }
    this.backend = "memory";
    const error =
      primaryError ?? new Error("Persistent browser storage is unavailable.");
    this._report(error, false);
    throw error;
  }

  _decode(record) {
    if (record == null) return null;
    if (
      record.format === "win31-disk" &&
      record.version === 1 &&
      Number.isSafeInteger(record.sequence) &&
      record.sequence >= 0 &&
      Number.isFinite(record.updatedAt) &&
      record.updatedAt >= 0 &&
      record.snapshot
    ) {
      validateSnapshot(record.snapshot);
      return record;
    }
    // The public snapshot format is also accepted for a previous direct-snapshot save.
    if (record.version === VERSION && Array.isArray(record.entries)) {
      validateSnapshot(record);
      return { snapshot: record, sequence: 0, updatedAt: 0 };
    }
    throw new FileSystemError(
      "EBADSNAPSHOT",
      "The saved disk has an invalid format.",
    );
  }

  _open() {
    if (this._closed)
      return Promise.reject(new Error("The virtual disk has been closed."));
    if (this._database) return Promise.resolve(this._database);
    if (this._opening) return this._opening;
    this._opening = new Promise((resolve, reject) => {
      let settled = false;
      let request;
      const finish = (error, database) => {
        if (settled) {
          database?.close();
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else {
          this._database = database;
          database.onversionchange = () => {
            database.close();
            this._database = null;
            this._opening = null;
          };
          resolve(database);
        }
      };
      const timeout = setTimeout(
        () => finish(new Error("Opening the virtual disk timed out.")),
        4000,
      );
      try {
        request = this._indexedDB.open(this.databaseName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("snapshots"))
            database.createObjectStore("snapshots");
        };
        request.onsuccess = () => finish(null, request.result);
        request.onerror = () =>
          finish(
            request.error ?? new Error("The virtual disk could not be opened."),
          );
        request.onblocked = () =>
          finish(new Error("Another tab is blocking the virtual disk."));
      } catch (error) {
        finish(error);
      }
    }).catch((error) => {
      this._opening = null;
      throw error;
    });
    return this._opening;
  }

  async _readIndexed() {
    const database = await this._open();
    return new Promise((resolve, reject) => {
      let value = null;
      const transaction = database.transaction("snapshots", "readonly");
      const request = transaction.objectStore("snapshots").get(this.key);
      request.onsuccess = () => {
        value = request.result ?? null;
      };
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () =>
        reject(
          transaction.error ??
            request.error ??
            new Error("The disk read was aborted."),
        );
      transaction.onerror = () => {
        /* onabort provides the transaction's final result. */
      };
    });
  }

  async _writeIndexed(record) {
    const database = await this._open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("snapshots", "readwrite");
      const request = transaction
        .objectStore("snapshots")
        .put(record, this.key);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          transaction.error ??
            request.error ??
            new Error("The disk write was aborted."),
        );
      transaction.onerror = () => {
        /* onabort provides the transaction's final result. */
      };
    });
  }

  _report(error, recovered) {
    if (recovered) this.warning = error;
    else this.lastError = error;
    try {
      this._onError?.(error, { recovered, backend: this.backend });
    } catch {
      /* Application callback. */
    }
  }

  close() {
    this._closed = true;
    this._database?.close();
    this._database = null;
  }
}

/**
 * Synchronous case-insensitive virtual C: drive. Await ready before exposing file actions.
 * Each mutation commits atomically in memory; durable writes are serialized separately.
 */
export class VirtualFileSystem {
  constructor(options = {}) {
    this._clock = options.clock ?? (() => new Date());
    this._listeners = new Set();
    this._journal = [];
    this._revision = 0;
    this._savedRevision = -1;
    this._readyComplete = false;
    this._closed = false;
    this._blocked = false;
    this._lastPersistError = null;
    this._onStorageError = options.onStorageError;
    this._entries = validateSnapshot(
      options.seed === false
        ? {
            version: VERSION,
            entries: [{ path: ROOT, type: "directory", modified: this._now() }],
          }
        : options.seed && typeof options.seed === "object"
          ? options.seed
          : createSeedSnapshot(),
    );
    if (own(options, "storage"))
      this._storage = options.storage ?? new MemoryDiskStorage();
    else if (
      typeof window === "undefined" &&
      !own(options, "indexedDB") &&
      !own(options, "localStorage")
    )
      this._storage = new MemoryDiskStorage();
    else
      this._storage = new BrowserDiskStorage({
        ...options,
        onError: (error, details) => this._storageWarning(error, details),
      });
    if (
      typeof this._storage.load !== "function" ||
      typeof this._storage.save !== "function"
    ) {
      throw new TypeError(
        "Disk storage must provide load() and save(snapshot).",
      );
    }
    this.persistence = {
      backend: this._storage.backend ?? "custom",
      status: "loading",
      lastError: null,
      warning: null,
      savedRevision: -1,
    };
    this.ready = this._initialize();
  }

  normalize(path, cwd = ROOT) {
    return normalizePath(path, cwd);
  }
  parent(path) {
    return parentOf(this.normalize(path));
  }
  basename(path) {
    return basenameOf(this.normalize(path));
  }

  exists(path) {
    return this._entries.has(this.normalize(path));
  }

  stat(path) {
    path = this.normalize(path);
    return info(path, requireEntry(this._entries, path));
  }

  readdir(path = ROOT) {
    path = this.normalize(path);
    requireDirectory(this._entries, path);
    return [...this._entries]
      .filter(([child]) => child !== path && parentOf(child) === path)
      .map(([child, entry]) => info(child, entry))
      .sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "directory"
            ? -1
            : 1,
      );
  }

  readFile(path) {
    path = this.normalize(path);
    const entry = requireEntry(this._entries, path);
    if (entry.type !== "file") fail("EISDIR", "The path is a directory", path);
    return entry.content;
  }

  writeFile(path, content) {
    path = this.normalize(path);
    if (typeof content !== "string")
      fail("EINVAL", "File content must be text", path);
    const timestamp = this._now();
    this._mutate("write", { path }, (entries) => {
      requireDirectory(entries, parentOf(path));
      const previous = entries.get(path);
      if (previous?.type === "directory")
        fail("EISDIR", "The path is a directory", path);
      if (previous?.content === content) return false;
      entries.set(path, {
        type: "file",
        content,
        created: previous?.created ?? timestamp,
        modified: timestamp,
      });
      touchParent(entries, path, timestamp);
      return true;
    });
    return path;
  }

  mkdir(path, options = {}) {
    path = this.normalize(path);
    const timestamp = this._now();
    this._mutate("mkdir", { path }, (entries, replay) => {
      const existing = entries.get(path);
      if (existing) {
        if (existing.type === "directory" && (options.recursive || replay))
          return false;
        fail("EEXIST", "The path already exists", path);
      }
      const missing = [];
      let current = path;
      while (!entries.has(current)) {
        missing.unshift(current);
        current = parentOf(current);
      }
      requireDirectory(entries, current);
      if (!options.recursive && missing.length > 1)
        fail("ENOENT", "The parent directory does not exist", parentOf(path));
      for (const directory of missing) {
        entries.set(directory, {
          type: "directory",
          created: timestamp,
          modified: timestamp,
        });
        touchParent(entries, directory, timestamp);
      }
      return true;
    });
    return path;
  }

  remove(path, options = {}) {
    path = this.normalize(path);
    if (path === ROOT)
      fail("EPERM", "The root directory cannot be removed", path);
    const timestamp = this._now();
    this._mutate("remove", { path }, (entries, replay) => {
      if (replay && !entries.has(path)) return false;
      const entry = requireEntry(entries, path);
      const descendants = [...entries.keys()].filter((child) =>
        beneath(child, path),
      );
      if (
        entry.type === "directory" &&
        descendants.length &&
        !options.recursive
      ) {
        fail("ENOTEMPTY", "The directory is not empty", path);
      }
      for (const child of descendants) entries.delete(child);
      entries.delete(path);
      touchParent(entries, path, timestamp);
      return true;
    });
  }

  copy(source, destination, options = {}) {
    return this._transfer(source, destination, options, false);
  }
  rename(source, destination, options = {}) {
    return this._transfer(source, destination, options, true);
  }
  move(source, destination, options = {}) {
    return this.rename(source, destination, options);
  }

  _transfer(source, destination, options, move) {
    source = this.normalize(source);
    destination = this.normalize(destination);
    if (source === ROOT || destination === ROOT)
      fail(
        "EPERM",
        "The root directory cannot be replaced or relocated",
        source,
      );
    const timestamp = this._now();
    this._mutate(
      move ? "rename" : "copy",
      { path: destination, source, destination },
      (entries) => {
        requireEntry(entries, source);
        if (source === destination) {
          if (move) return false;
          fail("EINVAL", "A file cannot be copied onto itself", source);
        }
        if (beneath(destination, source) || beneath(source, destination)) {
          fail("EINVAL", "Source and destination trees overlap", destination);
        }
        requireDirectory(entries, parentOf(destination));
        if (entries.has(destination) && !options.overwrite)
          fail("EEXIST", "The destination already exists", destination);
        const copied = [...entries].filter(
          ([path]) => path === source || beneath(path, source),
        );
        if (options.overwrite) {
          for (const path of entries.keys())
            if (path === destination || beneath(path, destination))
              entries.delete(path);
        }
        for (const [path, entry] of copied) {
          entries.set(destination + path.slice(source.length), {
            ...entry,
            created: move ? entry.created : timestamp,
          });
        }
        if (move) {
          for (const [path] of copied) entries.delete(path);
          touchParent(entries, source, timestamp);
        }
        touchParent(entries, destination, timestamp);
        return true;
      },
    );
    return destination;
  }

  snapshot() {
    return snapshotOf(this._entries);
  }

  restore(snapshot) {
    const validated = validateSnapshot(snapshot);
    this._ensureOpen();
    this._entries = validated;
    this._revision += 1;
    this._blocked = false;
    this._lastPersistError = null;
    if (!this._readyComplete)
      this._journal.push({ replacement: snapshotOf(validated) });
    this._emit({ type: "restore", path: ROOT, revision: this._revision });
    this._schedulePersist();
  }

  subscribe(listener) {
    if (typeof listener !== "function")
      throw new TypeError("A listener is required.");
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Resolves after all current revisions have been durably saved; rejects on failure. */
  async flush() {
    await this.ready;
    if (this._blocked)
      throw (
        this._lastPersistError ??
        new Error("Disk persistence is blocked after a load error.")
      );
    if (this._closed) return;
    await this._startPersist();
  }

  /** Await before leaving an embedding context when possible. */
  async dispose() {
    let error;
    try {
      await this.flush();
    } catch (caught) {
      error = caught;
    }
    this._closed = true;
    this._storage.close?.();
    this._listeners.clear();
    if (error) throw error;
  }

  _now() {
    const date = this._clock();
    const result = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(result.getTime()))
      throw new TypeError("The filesystem clock must return a valid date.");
    return result.toISOString();
  }

  _ensureOpen() {
    if (this._closed) fail("ECLOSED", "The virtual disk has been closed");
  }

  _mutate(type, details, operation) {
    this._ensureOpen();
    const entries = new Map(this._entries);
    if (!operation(entries, false)) return;
    this._entries = entries;
    this._revision += 1;
    if (!this._readyComplete) this._journal.push({ operation });
    this._emit({ type, ...details, revision: this._revision });
    this._schedulePersist();
  }

  async _initialize() {
    try {
      const stored = await this._storage.load();
      if (stored) {
        let loaded = validateSnapshot(stored);
        for (const entry of this._journal) {
          if (entry.replacement) loaded = validateSnapshot(entry.replacement);
          else {
            const draft = new Map(loaded);
            entry.operation(draft, true);
            loaded = draft;
          }
        }
        this._entries = loaded;
      }
      this._savedRevision =
        stored && !this._journal.length ? this._revision : -1;
      this.persistence.backend = this._storage.backend ?? "custom";
      this.persistence.status =
        this._savedRevision === this._revision ? "saved" : "pending";
      this.persistence.savedRevision = this._savedRevision;
    } catch (error) {
      this._blocked = true;
      this._lastPersistError = error;
      this._persistenceError(error);
    }
    this._journal = [];
    this._readyComplete = true;
    this._emit({ type: "ready", path: ROOT, revision: this._revision });
    this._schedulePersist();
    return this;
  }

  _schedulePersist() {
    if (
      !this._readyComplete ||
      this._blocked ||
      this._closed ||
      this._saveScheduled
    )
      return;
    this._saveScheduled = true;
    queueMicrotask(() => {
      this._saveScheduled = false;
      this._startPersist().catch(() => {
        /* The error is exposed through persistence and flush(). */
      });
    });
  }

  _startPersist() {
    if (this._saving) return this._saving;
    if (this._savedRevision === this._revision || this._closed)
      return Promise.resolve();
    if (this._blocked) return Promise.reject(this._lastPersistError);
    this._saving = (async () => {
      while (this._savedRevision !== this._revision && !this._closed) {
        const revision = this._revision;
        const snapshot = this.snapshot();
        this.persistence.status = "saving";
        this._emit({ type: "persistence", ...this.persistence });
        try {
          await this._storage.save(snapshot);
          this._savedRevision = revision;
          this._lastPersistError = null;
          Object.assign(this.persistence, {
            backend: this._storage.backend ?? "custom",
            status: "saved",
            lastError: null,
            savedRevision: revision,
          });
          this._emit({ type: "persistence", ...this.persistence });
        } catch (error) {
          this._lastPersistError = error;
          this._persistenceError(error);
          throw error;
        }
      }
    })().finally(() => {
      this._saving = null;
      if (!this._lastPersistError && this._savedRevision !== this._revision)
        this._schedulePersist();
    });
    return this._saving;
  }

  _storageWarning(error, details) {
    if (this.persistence) this.persistence.warning = error;
    try {
      this._onStorageError?.(error, details);
    } catch {
      /* Application callback. */
    }
  }

  _persistenceError(error) {
    Object.assign(this.persistence, {
      backend: this._storage.backend ?? "custom",
      status: "error",
      lastError: error,
    });
    this._emit({ type: "persistence", ...this.persistence });
    try {
      this._onStorageError?.(error, {
        recovered: false,
        backend: this.persistence.backend,
      });
    } catch {
      /* Application callback. */
    }
  }

  _emit(event) {
    for (const listener of [...this._listeners]) {
      try {
        listener(event);
      } catch {
        /* Subscribers cannot roll back a committed transaction. */
      }
    }
  }
}

export default VirtualFileSystem;
