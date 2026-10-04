import test from "node:test";
import assert from "node:assert/strict";
import { DesktopRenderer } from "../dist/packages/render/index.js";

function host({ gpu = false, webgl = false, shaderError = null } = {}) {
  const frames = new Map();
  const calls = {
    submits: 0,
    draws: [],
    fills: [],
    replacements: 0,
    observers: 0,
    buffers: [],
    shaders: [],
  };
  let nextFrame = 0;
  let loseDevice;
  const context2d = () => ({
    setTransform() {},
    scale() {},
    fillRect(...args) {
      calls.fills.push(args);
    },
    createPattern() {
      return {};
    },
  });
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    DEPTH_TEST: 5,
    BLEND: 6,
    TRIANGLES: 7,
    MAX_RENDERBUFFER_SIZE: 8,
    createShader: () => ({}),
    shaderSource() {},
    compileShader() {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    deleteShader() {},
    createProgram: () => ({}),
    attachShader() {},
    linkProgram() {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    deleteProgram() {},
    createVertexArray: () => ({}),
    deleteVertexArray() {},
    getUniformLocation: (_, name) => name,
    disable() {},
    viewport() {},
    useProgram() {},
    bindVertexArray() {},
    uniform2f() {},
    uniform1f() {},
    uniform1i() {},
    uniform4fv() {},
    getParameter: () => 16384,
    isContextLost: () => false,
    drawArrays: (mode, first, count) =>
      calls.draws.push({ backend: "WebGL2", count }),
  };
  const device = {
    lost: new Promise((resolve) => {
      loseDevice = resolve;
    }),
    limits: { maxTextureDimension2D: 16384 },
    queue: {
      writeBuffer: (_, offset, value) => calls.buffers.push([...value]),
      submit: () => calls.submits++,
    },
    pushErrorScope() {},
    popErrorScope: async () => shaderError,
    createShaderModule: (descriptor) => {
      calls.shaders.push(descriptor.code);
      return {};
    },
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createBuffer: () => ({ destroy() {} }),
    createBindGroup: () => ({}),
    destroy() {},
    createCommandEncoder: () => ({
      beginRenderPass: () => ({
        setPipeline() {},
        setBindGroup() {},
        draw: (count) => calls.draws.push({ backend: "WebGPU", count }),
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
    devicePixelRatio: 2,
    innerWidth: 640,
    innerHeight: 480,
    requestAnimationFrame: (callback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener() {},
    removeEventListener() {},
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    ResizeObserver: class {
      observe() {
        calls.observers++;
      }
      disconnect() {}
    },
  };
  const parent = {
    replaceChild(next, previous) {
      calls.replacements++;
      next.parentNode = this;
      previous.parentNode = null;
    },
  };
  const document = { defaultView: view, createElement: () => canvas(true) };
  function canvas(tile = false) {
    const listeners = new Map();
    let claimed;
    const two = context2d();
    const c = {
      ownerDocument: document,
      parentNode: tile ? null : parent,
      width: 300,
      height: 150,
      id: "desktop-canvas",
      style: { position: "absolute" },
      getBoundingClientRect: () => ({
        width: tile ? 16 : 640,
        height: tile ? 16 : 480,
      }),
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
      dispatchEvent(event) {
        listeners.get(event.type)?.(event);
      },
      cloneNode() {
        const copy = canvas();
        copy.id = this.id;
        copy.style = { ...this.style };
        return copy;
      },
      getContext(type) {
        if (claimed && type !== claimed) return null;
        let result;
        if (type === "webgpu" && gpu && !tile)
          result = {
            configure() {},
            unconfigure() {},
            getCurrentTexture: () => ({ createView: () => ({}) }),
          };
        if (type === "webgl2" && webgl && !tile) result = gl;
        if (type === "2d") result = two;
        if (result) claimed = type;
        return result ?? null;
      },
    };
    return c;
  }
  return {
    canvas: canvas(),
    calls,
    frames,
    device,
    loseDevice: () =>
      loseDevice({ reason: "unknown", message: "Test device loss" }),
    frame() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback();
    },
  };
}

test("Canvas2D renders requested patterns and only schedules invalidated frames", async () => {
  const environment = host();
  const renderer = new DesktopRenderer(environment.canvas, {
    wallpaperPattern: "bricks",
  });
  await renderer.init();
  assert.equal(renderer.backend, "Canvas2D");
  assert.equal(renderer.canvas.width, 1280);
  assert.equal(renderer.canvas.height, 960);
  assert.equal(environment.frames.size, 1);
  environment.frame();
  assert.ok(environment.calls.fills.length > 2);
  const fills = environment.calls.fills.length;
  environment.frame();
  assert.equal(environment.calls.fills.length, fills);
  renderer.setTheme({ desktopColor: "#008080", wallpaperPattern: "dots" });
  renderer.draw();
  renderer.draw();
  assert.equal(environment.frames.size, 1);
  renderer.dispose();
  assert.equal(environment.frames.size, 0);
});

test("WebGPU creates and submits a full-canvas graphics pipeline", async () => {
  const environment = host({ gpu: true });
  const renderer = new DesktopRenderer(environment.canvas, {
    desktopColor: "#c0c0c0",
    desktopPattern: "checker",
  });
  await renderer.init();
  assert.equal(renderer.backend, "WebGPU");
  environment.frame();
  assert.equal(environment.calls.submits, 1);
  assert.deepEqual(environment.calls.draws, [{ backend: "WebGPU", count: 3 }]);
  assert.match(environment.calls.shaders[0], /@fragment/);
  assert.deepEqual(environment.calls.buffers[0].slice(0, 4), [1280, 960, 2, 2]);
  renderer.dispose();
});

test("a rejected GPU pipeline replaces the claimed canvas and falls back cleanly", async () => {
  const environment = host({
    gpu: true,
    shaderError: { message: "Validation rejected" },
  });
  const replacements = [];
  const renderer = new DesktopRenderer(environment.canvas, {
    onCanvasReplacement: (next, previous) =>
      replacements.push([next, previous]),
  });
  await renderer.init();
  assert.equal(renderer.backend, "Canvas2D");
  assert.equal(environment.calls.replacements, 1);
  assert.notEqual(renderer.canvas, environment.canvas);
  assert.equal(renderer.canvas.id, "desktop-canvas");
  assert.equal(renderer.canvas.style.position, "absolute");
  assert.equal(replacements[0][1], environment.canvas);
  environment.frame();
  assert.ok(environment.calls.fills.length > 0);
  renderer.dispose();
});

test("device loss recovers from WebGPU to WebGL2 and then Canvas2D on context loss", async () => {
  const environment = host({ gpu: true, webgl: true });
  const renderer = new DesktopRenderer(environment.canvas);
  await renderer.init();
  environment.frame();
  environment.loseDevice();
  await Promise.resolve();
  assert.equal(renderer.backend, "WebGL2");
  environment.frame();
  assert.ok(environment.calls.draws.some((draw) => draw.backend === "WebGL2"));
  let prevented = false;
  renderer.canvas.dispatchEvent({
    type: "webglcontextlost",
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(renderer.backend, "Canvas2D");
  assert.equal(environment.calls.replacements, 2);
  environment.frame();
  assert.ok(environment.calls.fills.length > 0);
  renderer.dispose();
});

test("WebGL2 is used when WebGPU is unavailable and duplicate init calls share one initialization", async () => {
  const environment = host({ webgl: true });
  const renderer = new DesktopRenderer(environment.canvas);
  const first = renderer.init();
  assert.equal(renderer.init(), first);
  await first;
  assert.equal(renderer.backend, "WebGL2");
  environment.frame();
  assert.deepEqual(environment.calls.draws, [{ backend: "WebGL2", count: 3 }]);
  renderer.dispose();
  renderer.draw();
  assert.equal(environment.frames.size, 0);
});
