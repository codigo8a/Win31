import test from "node:test";
import assert from "node:assert/strict";
import { SafeStorage } from "../dist/packages/core/storage.js";

const makeStorage = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("JSON preferences retain types and their namespace", () => {
  const backing = makeStorage();
  const prefs = new SafeStorage({ storage: backing, prefix: "test:" });
  assert.equal(prefs.set("theme", { color: "#c0c0c0", sound: false }), true);
  assert.deepEqual(prefs.get("theme"), { color: "#c0c0c0", sound: false });
  assert.ok(backing.values.has("test:theme"));
  const copy = prefs.get("theme");
  copy.color = "red";
  assert.equal(prefs.get("theme").color, "#c0c0c0");
  assert.equal(prefs.get("missing", 7), 7);
  assert.equal(prefs.remove("theme"), true);
  assert.equal(prefs.get("theme", "default"), "default");
});

test("denied writes keep the new value in memory instead of reloading a stale value", () => {
  const backing = makeStorage();
  backing.setItem("win31:setting", JSON.stringify("old"));
  backing.setItem = () => {
    throw new Error("storage denied");
  };
  const events = [];
  const prefs = new SafeStorage({ storage: backing });
  prefs.subscribe((event) => events.push(event));
  assert.equal(prefs.set("setting", "new"), false);
  assert.equal(prefs.get("setting"), "new");
  assert.equal(prefs.backend, "memory");
  assert.match(prefs.lastError.message, /denied/);
  assert.equal(events[0].operation, "write");
  backing.removeItem = () => {
    throw new Error("storage denied");
  };
  prefs.remove("setting");
  assert.equal(prefs.get("setting", "removed"), "removed");
});

test("malformed or unserializable JSON returns fallbacks and exposes errors", () => {
  const backing = makeStorage();
  backing.setItem("win31:broken", "{bad");
  const prefs = new SafeStorage({ storage: backing });
  assert.equal(prefs.get("broken", "fallback"), "fallback");
  assert.ok(prefs.lastError instanceof SyntaxError);
  const circular = {};
  circular.self = circular;
  assert.equal(prefs.set("circular", circular), false);
  assert.equal(prefs.set("undefined", undefined), false);
  assert.equal(backing.values.has("win31:undefined"), false);
});

test("the explicit memory adapter and prefix shorthand work without browser globals", () => {
  const prefs = new SafeStorage({ storage: null });
  assert.equal(prefs.set("counter", 1), false);
  assert.equal(prefs.get("counter"), 1);
  const named = new SafeStorage("custom:");
  assert.equal(named.prefix, "custom:");
});
