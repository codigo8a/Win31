import test from "node:test";
import assert from "node:assert/strict";
import {
  VirtualFileSystem,
  MemoryDiskStorage,
  BrowserDiskStorage,
  normalizePath,
  createSeedSnapshot,
} from "../dist/packages/core/filesystem.js";

const ROOT = "C:\\";
const errorCode = (code) => (error) => error.code === code;
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
async function disk(options = {}) {
  const fs = new VirtualFileSystem({
    seed: false,
    storage: new MemoryDiskStorage(),
    ...options,
  });
  await fs.ready;
  await fs.flush();
  return fs;
}
function localStore() {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

test("paths are case-insensitive, drive-aware, rooted, and traversal cannot escape C:", () => {
  assert.equal(
    normalizePath("c:/Documents/../windows//system/."),
    "C:\\WINDOWS\\SYSTEM",
  );
  assert.equal(
    normalizePath("notes.txt", "c:\\documents"),
    "C:\\DOCUMENTS\\NOTES.TXT",
  );
  assert.equal(
    normalizePath("C:notes.txt", "C:\\DOCUMENTS"),
    "C:\\DOCUMENTS\\NOTES.TXT",
  );
  assert.equal(normalizePath("C:"), ROOT);
  assert.equal(normalizePath("..\\..\\..", "C:\\DOCUMENTS"), ROOT);
  assert.equal(normalizePath("\\windows", "C:\\DOCUMENTS"), "C:\\WINDOWS");
  for (const name of [
    "",
    "bad?.txt",
    "NUL.TXT",
    "COM1",
    "bad. ",
    "bad\u0000name",
  ]) {
    assert.throws(() => normalizePath(name), errorCode("EINVAL"));
  }
  assert.throws(() => normalizePath("D:\\"), errorCode("EDRIVE"));
  assert.throws(() => normalizePath("\\\\server\\share"), errorCode("EDRIVE"));
});

test("seed contains readable samples, valid parent directories, and no pretend executables", async () => {
  const fs = await disk({ seed: createSeedSnapshot() });
  for (const name of [
    "WELCOME.TXT",
    "README.TXT",
    "NOTES.TXT",
    "CALENDAR.CAL",
    "SAMPLE.WRI",
  ]) {
    assert.ok(fs.readFile("C:\\DOCUMENTS\\" + name).length > 0);
  }
  assert.deepEqual(
    JSON.parse(fs.readFile("C:\\DOCUMENTS\\CALENDAR.CAL")).events,
    [],
  );
  for (const entry of fs.snapshot().entries) {
    assert.equal(fs.stat(fs.parent(entry.path)).type, "directory");
    assert.ok(!entry.path.endsWith(".EXE"));
  }
  assert.equal(fs.parent(ROOT), ROOT);
  assert.equal(fs.basename(ROOT), "C:");
});

test("writes, metadata, listings, and subscribers observe a complete committed tree", async () => {
  let tick = 0;
  const fs = await disk({
    clock: () => new Date(Date.UTC(2025, 0, 1, 0, 0, tick++)),
  });
  fs.mkdir("C:\\WORK");
  const events = [];
  const unsubscribe = fs.subscribe((event) => {
    if (event.type === "write")
      events.push([event.path, fs.readFile(event.path)]);
  });
  fs.writeFile("c:\\work\\hello.txt", "hëllo 🌍");
  assert.equal(fs.readFile("C:\\WORK\\HELLO.TXT"), "hëllo 🌍");
  const before = fs.stat("C:\\WORK\\HELLO.TXT");
  assert.equal(before.size, new TextEncoder().encode("hëllo 🌍").byteLength);
  fs.writeFile("C:\\WORK\\HELLO.TXT", "revised");
  assert.equal(fs.stat("C:\\WORK\\HELLO.TXT").created, before.created);
  assert.notEqual(fs.stat("C:\\WORK\\HELLO.TXT").modified, before.modified);
  assert.deepEqual(
    events.map(([path]) => path),
    ["C:\\WORK\\HELLO.TXT", "C:\\WORK\\HELLO.TXT"],
  );
  unsubscribe();
  fs.mkdir("C:\\WORK\\Z-DIRECTORY");
  fs.writeFile("C:\\WORK\\A.TXT", "a");
  assert.deepEqual(
    fs.readdir("C:\\WORK").map((entry) => entry.name),
    ["Z-DIRECTORY", "A.TXT", "HELLO.TXT"],
  );
  const snapshot = fs.snapshot();
  assert.throws(() => fs.writeFile("C:\\WORK", "invalid"), errorCode("EISDIR"));
  assert.throws(
    () => fs.writeFile("C:\\MISSING\\A.TXT", "invalid"),
    errorCode("ENOENT"),
  );
  assert.deepEqual(fs.snapshot(), snapshot);
});

test("recursive directory creation is atomic around non-directory ancestors", async () => {
  const fs = await disk();
  fs.mkdir("C:\\A\\B\\C", { recursive: true });
  assert.equal(fs.stat("C:\\A\\B\\C").type, "directory");
  fs.mkdir("C:\\A\\B\\C", { recursive: true });
  fs.writeFile("C:\\FILE.TXT", "content");
  const before = fs.snapshot();
  assert.throws(
    () => fs.mkdir("C:\\FILE.TXT\\CHILD\\NESTED", { recursive: true }),
    errorCode("ENOTDIR"),
  );
  assert.throws(() => fs.mkdir("C:\\MISSING\\CHILD"), errorCode("ENOENT"));
  assert.throws(() => fs.mkdir("C:\\A"), errorCode("EEXIST"));
  assert.deepEqual(fs.snapshot(), before);
});

test("copy and move preserve nested trees and refuse destructive overlaps atomically", async () => {
  const fs = await disk();
  fs.mkdir("C:\\SOURCE\\NESTED", { recursive: true });
  fs.writeFile("C:\\SOURCE\\NESTED\\A.TXT", "original");
  fs.copy("C:\\SOURCE", "C:\\COPY");
  fs.writeFile("C:\\COPY\\NESTED\\A.TXT", "copy");
  assert.equal(fs.readFile("C:\\SOURCE\\NESTED\\A.TXT"), "original");
  fs.rename("C:\\COPY", "C:\\RENAMED");
  assert.equal(fs.exists("C:\\COPY"), false);
  assert.equal(fs.readFile("C:\\RENAMED\\NESTED\\A.TXT"), "copy");
  fs.move("C:\\RENAMED\\NESTED\\A.TXT", "C:\\MOVED.TXT");
  assert.equal(fs.readFile("C:\\MOVED.TXT"), "copy");
  const before = fs.snapshot();
  assert.throws(
    () => fs.copy("C:\\SOURCE", "C:\\SOURCE\\NESTED\\COPY"),
    errorCode("EINVAL"),
  );
  assert.throws(
    () => fs.rename("C:\\SOURCE\\NESTED", "C:\\SOURCE", { overwrite: true }),
    errorCode("EINVAL"),
  );
  assert.throws(
    () => fs.copy("C:\\MOVED.TXT", "C:\\MOVED.TXT"),
    errorCode("EINVAL"),
  );
  assert.throws(
    () => fs.copy("C:\\SOURCE", "C:\\RENAMED"),
    errorCode("EEXIST"),
  );
  assert.deepEqual(fs.snapshot(), before);
  fs.copy("C:\\SOURCE", "C:\\RENAMED", { overwrite: true });
  assert.equal(fs.readFile("C:\\RENAMED\\NESTED\\A.TXT"), "original");
});

test("root cannot be removed or relocated; nonempty removal needs explicit recursion", async () => {
  const fs = await disk();
  fs.mkdir("C:\\A\\B", { recursive: true });
  fs.writeFile("C:\\A\\B\\C.TXT", "data");
  const before = fs.snapshot();
  assert.throws(() => fs.remove(ROOT, { recursive: true }), errorCode("EPERM"));
  assert.throws(() => fs.rename(ROOT, "C:\\NEW"), errorCode("EPERM"));
  assert.throws(() => fs.rename("C:\\A", ROOT), errorCode("EPERM"));
  assert.throws(() => fs.remove("C:\\A"), errorCode("ENOTEMPTY"));
  assert.deepEqual(fs.snapshot(), before);
  fs.remove("C:\\A", { recursive: true });
  assert.deepEqual(fs.readdir(ROOT), []);
});

test("snapshot restoration validates the entire tree and does not retain caller aliases", async () => {
  const fs = await disk();
  fs.writeFile("C:\\A.TXT", "before");
  const good = fs.snapshot();
  const bad = structuredClone(good);
  bad.entries.push({
    path: "C:\\MISSING\\A.TXT",
    type: "file",
    content: "bad",
    modified: new Date().toISOString(),
  });
  assert.throws(() => fs.restore(bad), errorCode("EBADSNAPSHOT"));
  assert.deepEqual(fs.snapshot(), good);
  const duplicate = structuredClone(good);
  duplicate.entries.push({
    ...duplicate.entries.find((entry) => entry.type === "file"),
    path: "c:\\a.txt",
  });
  assert.throws(() => fs.restore(duplicate), errorCode("EBADSNAPSHOT"));
  fs.writeFile("C:\\A.TXT", "after");
  fs.restore(good);
  good.entries.find((entry) => entry.type === "file").content =
    "mutated elsewhere";
  assert.equal(fs.readFile("C:\\A.TXT"), "before");
});

test("queued durable saves are serialized and include edits made during an in-flight write", async () => {
  const storage = new MemoryDiskStorage();
  const fs = await disk({ storage });
  const gate = deferred();
  const started = deferred();
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const saved = [];
  storage.save = async (snapshot) => {
    active++;
    maximum = Math.max(maximum, active);
    calls++;
    if (calls === 1) {
      started.resolve();
      await gate.promise;
    }
    saved.push(structuredClone(snapshot));
    active--;
  };
  fs.writeFile("C:\\A.TXT", "one");
  await started.promise;
  fs.writeFile("C:\\A.TXT", "two");
  fs.writeFile("C:\\B.TXT", "three");
  gate.resolve();
  await fs.flush();
  assert.equal(maximum, 1);
  assert.equal(saved.length, 2);
  assert.equal(
    saved.at(-1).entries.find((entry) => entry.path === "C:\\A.TXT").content,
    "two",
  );
  assert.ok(saved.at(-1).entries.some((entry) => entry.path === "C:\\B.TXT"));
  assert.equal(fs.persistence.status, "saved");
});

test("edits made while loading are replayed without discarding unrelated durable files", async () => {
  const source = await disk();
  source.mkdir("C:\\DOCUMENTS");
  source.writeFile("C:\\PRIVATE.TXT", "saved earlier");
  const gate = deferred();
  let saved;
  const fs = new VirtualFileSystem({
    storage: {
      load: () => gate.promise,
      save: async (value) => {
        saved = value;
      },
    },
  });
  fs.writeFile("C:\\DOCUMENTS\\NEW.TXT", "written while opening");
  gate.resolve(source.snapshot());
  await fs.ready;
  await fs.flush();
  assert.equal(fs.readFile("C:\\PRIVATE.TXT"), "saved earlier");
  assert.equal(fs.readFile("C:\\DOCUMENTS\\NEW.TXT"), "written while opening");
  assert.ok(saved.entries.some((entry) => entry.path === "C:\\PRIVATE.TXT"));
});

test("load failure preserves the saved store until an explicit restore", async () => {
  let saves = 0;
  const error = new Error("unreadable disk");
  const fs = new VirtualFileSystem({
    storage: {
      load: async () => {
        throw error;
      },
      save: async () => {
        saves++;
      },
    },
  });
  await fs.ready;
  fs.writeFile("C:\\DOCUMENTS\\UNSAVED.TXT", "in memory");
  await assert.rejects(fs.flush(), /unreadable disk/);
  assert.equal(saves, 0);
  assert.equal(fs.persistence.status, "error");
  fs.restore(fs.snapshot());
  await fs.flush();
  assert.equal(saves, 1);
});

test("failed writes keep the in-memory data and a later flush retries successfully", async () => {
  let unavailable = true;
  const fs = new VirtualFileSystem({
    seed: false,
    storage: {
      load: async () => null,
      save: async () => {
        if (unavailable) throw new Error("quota exceeded");
      },
    },
  });
  await fs.ready;
  fs.writeFile("C:\\A.TXT", "kept");
  await assert.rejects(fs.flush(), /quota exceeded/);
  assert.equal(fs.readFile("C:\\A.TXT"), "kept");
  assert.equal(fs.persistence.status, "error");
  unavailable = false;
  await fs.flush();
  assert.equal(fs.persistence.status, "saved");
  assert.equal(fs.persistence.lastError, null);
});

test("browser adapter falls back to localStorage and can reopen its persisted disk", async () => {
  const localStorage = localStore();
  const errors = [];
  const indexedDB = {
    open() {
      const request = { error: new Error("IndexedDB disabled") };
      queueMicrotask(() => request.onerror());
      return request;
    },
  };
  const storage = new BrowserDiskStorage({
    indexedDB,
    localStorage,
    onError: (error, details) => errors.push(details),
  });
  const fs = await disk({ storage });
  fs.writeFile("C:\\PERSISTED.TXT", "survives reload");
  await fs.flush();
  assert.equal(fs.persistence.backend, "localStorage");
  assert.ok(errors.some((details) => details.recovered));
  const reopened = await disk({
    storage: new BrowserDiskStorage({ indexedDB: null, localStorage }),
  });
  assert.equal(reopened.readFile("C:\\PERSISTED.TXT"), "survives reload");
});

test("corrupted localStorage data is reported and not silently replaced", async () => {
  const localStorage = localStore();
  localStorage.setItem("win31:disk:v1", "{broken");
  const fs = new VirtualFileSystem({
    storage: new BrowserDiskStorage({ indexedDB: null, localStorage }),
  });
  await fs.ready;
  await assert.rejects(fs.flush());
  assert.equal(localStorage.getItem("win31:disk:v1"), "{broken");
  assert.equal(fs.persistence.status, "error");
});

test("localStorage quota errors are detected without discarding in-memory content", async () => {
  const storage = new BrowserDiskStorage({
    indexedDB: null,
    localStorage: {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    },
  });
  const fs = new VirtualFileSystem({ seed: false, storage });
  await fs.ready;
  fs.writeFile("C:\\A.TXT", "safe in memory");
  await assert.rejects(fs.flush(), /quota/);
  assert.equal(fs.readFile("C:\\A.TXT"), "safe in memory");
  assert.equal(storage.backend, "memory");
});

test("an empty healthy fallback does not cause a corrupted IndexedDB disk to be overwritten", async () => {
  const storage = new BrowserDiskStorage({
    indexedDB: {},
    localStorage: localStore(),
  });
  let writes = 0;
  storage._readIndexed = async () => ({ invalid: true });
  storage._writeIndexed = async () => {
    writes++;
  };
  const fs = new VirtualFileSystem({ storage });
  await fs.ready;
  await assert.rejects(fs.flush(), errorCode("EBADSNAPSHOT"));
  assert.equal(writes, 0);
  assert.equal(fs.persistence.status, "error");
});

test("a newer fallback is recovered even if an inaccessible primary previously had a higher sequence", async () => {
  const primary = await disk();
  primary.writeFile("C:\\A.TXT", "older primary");
  const fallback = await disk();
  fallback.writeFile("C:\\A.TXT", "newer fallback");
  const localStorage = localStore();
  localStorage.setItem(
    "win31:disk:v1",
    JSON.stringify({
      format: "win31-disk",
      version: 1,
      sequence: 2,
      updatedAt: 200,
      snapshot: fallback.snapshot(),
    }),
  );
  const storage = new BrowserDiskStorage({ indexedDB: {}, localStorage });
  storage._readIndexed = async () => ({
    format: "win31-disk",
    version: 1,
    sequence: 20,
    updatedAt: 100,
    snapshot: primary.snapshot(),
  });
  assert.equal(
    (await storage.load()).entries.find((entry) => entry.path === "C:\\A.TXT")
      .content,
    "newer fallback",
  );
});
