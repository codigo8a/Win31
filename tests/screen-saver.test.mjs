import test from "node:test";
import assert from "node:assert/strict";
import { startScreenSaver } from "../dist/packages/render/screen-saver.js";

function environment({ gpu = false, validation = null } = {}) {
  let nextFrame = 0;
  let lose;
  const frames = new Map();
  const listeners = new Set();
  const calls = {
    fills: 0,
    strokes: 0,
    submissions: 0,
    draws: [],
    pipelines: [],
    replaced: 0,
    disconnected: 0,
    destroyed: 0,
  };
  const device = {
    limits: { maxTextureDimension2D: 16384 },
    lost: new Promise((resolve) => {
      lose = resolve;
    }),
    pushErrorScope() {},
    popErrorScope: async () => validation,
    createShaderModule: (value) => value,
    createRenderPipeline: (value) => {
      calls.pipelines.push(value);
      return { getBindGroupLayout: () => ({}) };
    },
    createBuffer: () => ({ destroy() {} }),
    createBindGroup: () => ({}),
    destroy() {
      calls.destroyed++;
    },
    queue: {
      writeBuffer() {},
      submit() {
        calls.submissions++;
      },
    },
    createCommandEncoder: () => ({
      beginRenderPass: () => ({
        setPipeline() {},
        setBindGroup() {},
        draw: (vertices, instances) => calls.draws.push([vertices, instances]),
        end() {},
      }),
      finish: () => ({}),
    }),
  };
  const view = {
    navigator: gpu
      ? {
          gpu: {
            requestAdapter: async () => ({ requestDevice: async () => device }),
            getPreferredCanvasFormat: () => "bgra8unorm",
          },
        }
      : {},
    performance: { now: () => 0 },
    devicePixelRatio: 2,
    requestAnimationFrame: (callback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener: (name) => listeners.add(name),
    removeEventListener: (name) => listeners.delete(name),
    ResizeObserver: class {
      observe() {}
      disconnect() {
        calls.disconnected++;
      }
    },
  };
  const document = { defaultView: view, createElement: () => canvas() };
  const host = {
    ownerDocument: document,
    children: [],
    getBoundingClientRect: () => ({ width: 640, height: 480 }),
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
    },
    replaceChild(next, previous) {
      this.children.splice(this.children.indexOf(previous), 1, next);
      next.parentNode = this;
      previous.parentNode = null;
      calls.replaced++;
    },
  };
  function canvas() {
    let claimed;
    const context = {
      setTransform() {},
      fillRect() {
        calls.fills++;
      },
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      stroke() {
        calls.strokes++;
      },
    };
    return {
      style: {},
      ownerDocument: document,
      width: 300,
      height: 150,
      setAttribute() {},
      cloneNode() {
        const replacement = canvas();
        replacement.style = { ...this.style };
        return replacement;
      },
      getContext(type) {
        if (claimed && claimed !== type) return null;
        let result;
        if (type === "webgpu" && gpu)
          result = {
            configure() {},
            unconfigure() {},
            getCurrentTexture: () => ({ createView: () => ({}) }),
          };
        if (type === "2d") result = context;
        if (result) claimed = type;
        return result ?? null;
      },
      remove() {
        if (this.parentNode)
          this.parentNode.children.splice(
            this.parentNode.children.indexOf(this),
            1,
          );
        this.parentNode = null;
      },
    };
  }
  return {
    host,
    calls,
    frames,
    listeners,
    device,
    lose: () => lose({ message: "test loss" }),
    frame(time = 1000) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    },
  };
}

test("blank screen saver uses no GPU, schedules no frames, and cleans up its canvas", async () => {
  const env = environment({ gpu: true });
  const dispose = startScreenSaver(env.host, { kind: "blank" });
  await dispose.ready;
  assert.equal(dispose.backend, "Blank");
  assert.equal(env.frames.size, 0);
  assert.equal(env.calls.pipelines.length, 0);
  assert.deepEqual([...env.listeners], ["resize"]);
  dispose();
  assert.equal(env.host.children.length, 0);
  assert.equal(env.listeners.size, 0);
});

for (const kind of ["stars", "mystify"]) {
  test(`${kind} has a working Canvas2D fallback with an active-only animation lifecycle`, async () => {
    const env = environment();
    const dispose = startScreenSaver(env.host, { kind });
    await dispose.ready;
    assert.equal(dispose.backend, "Canvas2D");
    assert.equal(env.frames.size, 1);
    env.frame();
    assert.ok(
      kind === "stars" ? env.calls.fills > 1 : env.calls.strokes === 24,
    );
    assert.equal(env.frames.size, 1);
    dispose();
    assert.equal(env.frames.size, 0);
    assert.equal(env.host.children.length, 0);
    assert.equal(env.calls.disconnected, 1);
  });

  test(`${kind} submits instanced WebGPU geometry and recovers from device loss`, async () => {
    const env = environment({ gpu: true });
    const dispose = startScreenSaver(env.host, { kind, device: env.device });
    await dispose.ready;
    assert.equal(dispose.backend, "WebGPU");
    env.frame();
    assert.equal(env.calls.submissions, 1);
    assert.deepEqual(env.calls.draws, [[6, kind === "stars" ? 450 : 96]]);
    assert.equal(
      env.calls.pipelines[0].vertex.entryPoint,
      kind === "stars" ? "starsVertex" : "mystifyVertex",
    );
    env.lose();
    await Promise.resolve();
    assert.equal(dispose.backend, "Canvas2D");
    assert.equal(env.calls.replaced, 1);
    assert.equal(env.frames.size, 1);
    env.frame(1040);
    assert.ok(env.calls.fills > 0);
    dispose();
    assert.equal(env.frames.size, 0);
    assert.equal(
      env.calls.destroyed,
      0,
      "The supplied device remains owned by the caller.",
    );
  });
}

test("pipeline validation failure replaces its exclusive context and starts one fallback loop", async () => {
  const env = environment({
    gpu: true,
    validation: { message: "shader rejected" },
  });
  const dispose = startScreenSaver(env.host, { kind: "stars" });
  await dispose.ready;
  assert.equal(dispose.backend, "Canvas2D");
  assert.match(dispose.error.message, /shader rejected/);
  assert.equal(env.calls.replaced, 1);
  assert.equal(env.frames.size, 1);
  assert.equal(env.calls.destroyed, 1);
  dispose();
  assert.equal(env.frames.size, 0);
});
