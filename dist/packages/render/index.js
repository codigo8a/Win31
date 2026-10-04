const PATTERNS = Object.freeze({
  none: 0,
  solid: 0,
  "(none)": 0,
  dots: 1,
  dot: 1,
  checker: 2,
  checkerboard: 2,
  gray: 2,
  grey: 2,
  diagonal: 3,
  crosshatch: 4,
  weave: 5,
  bricks: 6,
  grid: 7,
});

const WGSL = `
struct Theme {
  resolution: vec2f,
  scale: f32,
  pattern: f32,
  background: vec4f,
  foreground: vec4f,
};
@group(0) @binding(0) var<uniform> theme: Theme;

@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(positions[index], 0.0, 1.0);
}

@fragment fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let p = vec2u(floor(position.xy / theme.scale));
  let x = p.x;
  let y = p.y;
  let pattern = u32(theme.pattern);
  var ink = false;
  if (pattern == 1u) { ink = x % 4u == 0u && y % 4u == 0u; }
  if (pattern == 2u) { ink = (x + y) % 2u == 0u; }
  if (pattern == 3u) { ink = (x + y) % 8u == 0u; }
  if (pattern == 4u) { ink = (x + y) % 8u == 0u || (x + 8u - y % 8u) % 8u == 0u; }
  if (pattern == 5u) { ink = (x % 4u == 0u && y % 4u < 3u) || (y % 4u == 0u && x % 4u < 3u); }
  if (pattern == 6u) { ink = y % 8u == 0u || (x + (y / 8u % 2u) * 8u) % 16u == 0u; }
  if (pattern == 7u) { ink = x % 8u == 0u || y % 8u == 0u; }
  return select(theme.background, theme.foreground, ink);
}
`;

const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 positions[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uResolution;
uniform float uScale;
uniform int uPattern;
uniform vec4 uBackground;
uniform vec4 uForeground;
out vec4 outputColor;
void main() {
  ivec2 p = ivec2(floor(vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uScale));
  int x = p.x;
  int y = p.y;
  bool ink = false;
  if (uPattern == 1) ink = x % 4 == 0 && y % 4 == 0;
  if (uPattern == 2) ink = (x + y) % 2 == 0;
  if (uPattern == 3) ink = (x + y) % 8 == 0;
  if (uPattern == 4) ink = (x + y) % 8 == 0 || (x + 8 - y % 8) % 8 == 0;
  if (uPattern == 5) ink = (x % 4 == 0 && y % 4 < 3) || (y % 4 == 0 && x % 4 < 3);
  if (uPattern == 6) ink = y % 8 == 0 || (x + (y / 8 % 2) * 8) % 16 == 0;
  if (uPattern == 7) ink = x % 8 == 0 || y % 8 == 0;
  outputColor = ink ? uForeground : uBackground;
}
`;

function color(value, fallback) {
  if (Array.isArray(value) && value.length >= 3) {
    const scale = value.some((component) => Number(component) > 1) ? 255 : 1;
    return [0, 1, 2]
      .map((index) =>
        Math.min(1, Math.max(0, (Number(value[index]) || 0) / scale)),
      )
      .concat(1);
  }
  let text = String(value ?? "")
    .trim()
    .toLowerCase();
  const named = {
    gray: "#808080",
    grey: "#808080",
    silver: "#c0c0c0",
    black: "#000000",
    white: "#ffffff",
    teal: "#008080",
    navy: "#000080",
    blue: "#0000ff",
    green: "#008000",
    red: "#ff0000",
    purple: "#800080",
  };
  text = named[text] ?? text;
  if (/^#[0-9a-f]{3}$/.test(text))
    text = "#" + [...text.slice(1)].map((part) => part + part).join("");
  if (/^#[0-9a-f]{6}$/.test(text))
    return [1, 3, 5]
      .map((index) => parseInt(text.slice(index, index + 2), 16) / 255)
      .concat(1);
  const match =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*[\d.]+)?\s*\)$/.exec(
      text,
    );
  if (match)
    return match
      .slice(1, 4)
      .map((component) => Math.min(1, Math.max(0, Number(component) / 255)))
      .concat(1);
  return [...fallback];
}

const cssColor = (rgba) =>
  `rgb(${rgba
    .slice(0, 3)
    .map((value) => Math.round(value * 255))
    .join(",")})`;

function inkAt(pattern, x, y) {
  switch (pattern) {
    case 1:
      return x % 4 === 0 && y % 4 === 0;
    case 2:
      return (x + y) % 2 === 0;
    case 3:
      return (x + y) % 8 === 0;
    case 4:
      return (x + y) % 8 === 0 || (x + 8 - (y % 8)) % 8 === 0;
    case 5:
      return (x % 4 === 0 && y % 4 < 3) || (y % 4 === 0 && x % 4 < 3);
    case 6:
      return y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0;
    case 7:
      return x % 8 === 0 || y % 8 === 0;
    default:
      return false;
  }
}

/**
 * Event-driven drawing layer for the desktop background, independent of the DOM shell.
 * WebGPU runs a full-canvas shader pipeline; WebGL2 and Canvas2D draw the same pattern.
 */
export class DesktopRenderer {
  constructor(canvas, settings = {}) {
    if (!canvas || typeof canvas.getContext !== "function")
      throw new TypeError("DesktopRenderer requires a canvas.");
    this.canvas = canvas;
    this.settings = { ...settings };
    this.backend = "Starting";
    this.warnings = [];
    this.error = null;
    this._disposed = false;
    this._contextClaimed = false;
    this._frame = null;
    this._uniforms = new Float32Array(12);
    this._width = 1;
    this._height = 1;
    this._dpr = 1;
    this._view = canvas.ownerDocument?.defaultView ?? globalThis;
    this._requestFrame =
      this._view.requestAnimationFrame?.bind(this._view) ??
      ((callback) => setTimeout(callback, 0));
    this._cancelFrame =
      this._view.cancelAnimationFrame?.bind(this._view) ?? clearTimeout;
    this._onResize = () => this.resize();
    this._onContextLost = (event) => {
      event.preventDefault();
      this._recover("The WebGL context was lost.", "Canvas2D");
    };
  }

  init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initialize();
    return this._initPromise;
  }

  async _initialize() {
    if (this._disposed) return this;
    let initialized = false;
    try {
      initialized = await this._initWebGPU();
    } catch (error) {
      this._warn(error);
      this._releaseGraphics();
    }
    if (this._disposed) return this;
    if (!initialized) this._initFallback("WebGL2");
    this._observeCanvas();
    this._view.addEventListener?.("resize", this._onResize, { passive: true });
    this.resize();
    this.draw();
    return this;
  }

  async _initWebGPU() {
    const gpu = this._view.navigator?.gpu ?? globalThis.navigator?.gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter({ powerPreference: "low-power" });
    if (!adapter || this._disposed) return false;
    const device = await adapter.requestDevice();
    if (this._disposed) {
      device.destroy();
      return false;
    }
    this._device = device;
    const context = this.canvas.getContext("webgpu");
    if (!context) {
      device.destroy();
      this._device = null;
      return false;
    }
    this._contextClaimed = true;
    this._gpuContext = context;
    const format = gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });
    device.pushErrorScope("validation");
    const shader = device.createShaderModule({
      label: "Windows desktop pattern",
      code: WGSL,
    });
    const pipeline = device.createRenderPipeline({
      label: "Windows desktop background",
      layout: "auto",
      vertex: { module: shader, entryPoint: "vertexMain" },
      fragment: {
        module: shader,
        entryPoint: "fragmentMain",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const validationError = await device.popErrorScope();
    if (validationError) throw new Error(validationError.message);
    if (this._disposed) {
      this._releaseGraphics();
      return false;
    }
    // GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST; numeric values also work in test hosts.
    const buffer = device.createBuffer({
      label: "Desktop theme",
      size: 48,
      usage: 0x40 | 0x08,
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });
    this._pipeline = pipeline;
    this._uniformBuffer = buffer;
    this._bindGroup = bindGroup;
    this._setBackend("WebGPU");
    device.lost
      .then((details) => {
        if (!this._disposed && this._device === device)
          this._recover(
            details.message || "The WebGPU device was lost.",
            "WebGL2",
          );
      })
      .catch((error) => {
        if (!this._disposed && this._device === device)
          this._recover(error, "WebGL2");
      });
    return true;
  }

  _initFallback(preferred) {
    if (this._disposed) return;
    if (this._contextClaimed) this._replaceCanvas();
    if (preferred === "WebGL2") {
      try {
        if (this._initWebGL()) return;
      } catch (error) {
        this._warn(error);
        this._releaseGraphics();
      }
      if (this._contextClaimed) this._replaceCanvas();
    }
    try {
      const context = this.canvas.getContext("2d", { alpha: false });
      if (!context)
        throw new Error("No supported canvas graphics context is available.");
      this._contextClaimed = true;
      this._context2d = context;
      context.imageSmoothingEnabled = false;
      this._setBackend("Canvas2D");
    } catch (error) {
      this.error = error;
      this._warn(error);
      this._setBackend("Unavailable");
      this.canvas.style.backgroundColor = cssColor(this._theme().background);
    }
  }

  _initWebGL() {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) return false;
    this._contextClaimed = true;
    this._gl = gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("A WebGL shader could not be allocated.");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message =
          gl.getShaderInfoLog(shader) ||
          "A desktop shader could not be compiled.";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    let vertex;
    let fragment;
    let program;
    try {
      vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error("A WebGL program could not be allocated.");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(
          gl.getProgramInfoLog(program) ||
            "The desktop shader could not be linked.",
        );
    } catch (error) {
      if (program) gl.deleteProgram(program);
      throw error;
    } finally {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
    this._program = program;
    this._vao = gl.createVertexArray();
    this._locations = Object.fromEntries(
      ["Resolution", "Scale", "Pattern", "Background", "Foreground"].map(
        (name) => [name, gl.getUniformLocation(program, "u" + name)],
      ),
    );
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.canvas.addEventListener("webglcontextlost", this._onContextLost);
    this._setBackend("WebGL2");
    return true;
  }

  /** Width and height are CSS pixels. Omit them to measure the canvas. */
  resize(width, height) {
    if (this._disposed) return;
    const rectangle = this.canvas.getBoundingClientRect?.();
    this._width = Math.max(
      1,
      Number(width) ||
        rectangle?.width ||
        this.canvas.clientWidth ||
        this._view.innerWidth ||
        1,
    );
    this._height = Math.max(
      1,
      Number(height) ||
        rectangle?.height ||
        this.canvas.clientHeight ||
        this._view.innerHeight ||
        1,
    );
    this._dpr = Math.max(
      1,
      Math.min(3, Number(this._view.devicePixelRatio) || 1),
    );
    const limit =
      this._device?.limits?.maxTextureDimension2D ??
      (this._gl
        ? this._gl.getParameter(this._gl.MAX_RENDERBUFFER_SIZE)
        : 16384);
    const ratio = Math.min(
      this._dpr,
      limit / this._width,
      limit / this._height,
    );
    this._dpr = ratio;
    const nextWidth = Math.max(1, Math.round(this._width * ratio));
    const nextHeight = Math.max(1, Math.round(this._height * ratio));
    if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth;
    if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight;
    this.draw();
  }

  /** Invalidates one frame; repeated calls in the same frame are coalesced. */
  draw() {
    if (this._disposed || this._frame !== null) return;
    this._frame = this._requestFrame(() => {
      this._frame = null;
      if (this._disposed || this.backend === "Starting") return;
      try {
        this._render();
      } catch (error) {
        if (this.backend === "WebGPU") this._recover(error, "WebGL2");
        else if (this.backend === "WebGL2") this._recover(error, "Canvas2D");
        else {
          this.error = error;
          this._warn(error);
        }
      }
    });
  }

  setTheme(settings = {}) {
    this.settings = {
      ...this.settings,
      ...(typeof settings === "string" ? { desktopColor: settings } : settings),
    };
    this._tile = null;
    this.draw();
  }

  _theme() {
    const settings = this.settings;
    const background = color(
      settings.desktopColor ?? settings.desktop ?? settings.backgroundColor,
      [192 / 255, 192 / 255, 192 / 255, 1],
    );
    const foreground = color(
      settings.patternColor,
      background
        .slice(0, 3)
        .map((value) => value * 0.64)
        .concat(1),
    );
    const value =
      settings.desktopPattern ??
      settings.wallpaperPattern ??
      settings.pattern ??
      "none";
    const pattern =
      typeof value === "number"
        ? Math.min(7, Math.max(0, Math.floor(value)))
        : (PATTERNS[String(value).toLowerCase()] ?? 0);
    const scale = Math.min(8, Math.max(1, Number(settings.patternScale) || 1));
    return { background, foreground, pattern, scale };
  }

  _render() {
    const theme = this._theme();
    if (this.backend === "WebGPU") {
      this._uniforms.set([
        this.canvas.width,
        this.canvas.height,
        this._dpr * theme.scale,
        theme.pattern,
        ...theme.background,
        ...theme.foreground,
      ]);
      this._device.queue.writeBuffer(this._uniformBuffer, 0, this._uniforms);
      const encoder = this._device.createCommandEncoder({
        label: "Desktop redraw",
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this._gpuContext.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: {
              r: theme.background[0],
              g: theme.background[1],
              b: theme.background[2],
              a: 1,
            },
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(this._pipeline);
      pass.setBindGroup(0, this._bindGroup);
      pass.draw(3);
      pass.end();
      this._device.queue.submit([encoder.finish()]);
    } else if (this.backend === "WebGL2") {
      const gl = this._gl;
      if (gl.isContextLost()) {
        this._recover("The WebGL context was lost.", "Canvas2D");
        return;
      }
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this._program);
      gl.bindVertexArray(this._vao);
      gl.uniform2f(
        this._locations.Resolution,
        this.canvas.width,
        this.canvas.height,
      );
      gl.uniform1f(this._locations.Scale, this._dpr * theme.scale);
      gl.uniform1i(this._locations.Pattern, theme.pattern);
      gl.uniform4fv(this._locations.Background, theme.background);
      gl.uniform4fv(this._locations.Foreground, theme.foreground);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (this.backend === "Canvas2D") {
      const context = this._context2d;
      context.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      context.imageSmoothingEnabled = false;
      context.fillStyle = cssColor(theme.background);
      context.fillRect(0, 0, this._width, this._height);
      if (theme.pattern) {
        if (!this._tile) this._tile = this._createPattern(theme);
        if (this._tile) {
          context.scale(theme.scale, theme.scale);
          context.fillStyle = this._tile;
          context.fillRect(
            0,
            0,
            this._width / theme.scale,
            this._height / theme.scale,
          );
        }
      }
    } else this.canvas.style.backgroundColor = cssColor(theme.background);
  }

  _createPattern(theme) {
    const tile = this.canvas.ownerDocument?.createElement("canvas");
    if (!tile) return null;
    tile.width = 16;
    tile.height = 16;
    const context = tile.getContext("2d");
    if (!context) return null;
    context.fillStyle = cssColor(theme.background);
    context.fillRect(0, 0, 16, 16);
    context.fillStyle = cssColor(theme.foreground);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++)
        if (inkAt(theme.pattern, x, y)) context.fillRect(x, y, 1, 1);
    }
    return this._context2d.createPattern(tile, "repeat");
  }

  _recover(error, fallback) {
    if (this._disposed || this._recovering) return;
    this._recovering = true;
    this._warn(error);
    this._releaseGraphics();
    this._initFallback(fallback);
    this._recovering = false;
    this.resize(this._width, this._height);
  }

  _replaceCanvas() {
    const previous = this.canvas;
    previous.removeEventListener?.("webglcontextlost", this._onContextLost);
    const replacement = previous.cloneNode(false);
    previous.parentNode?.replaceChild(replacement, previous);
    this.canvas = replacement;
    this._contextClaimed = false;
    this._tile = null;
    this._observeCanvas();
    try {
      this.settings.onCanvasReplacement?.(replacement, previous);
    } catch {
      /* Application callback. */
    }
  }

  _observeCanvas() {
    this._observer?.disconnect();
    const Observer = this._view.ResizeObserver ?? globalThis.ResizeObserver;
    if (Observer) {
      this._observer = new Observer(() => this.resize());
      this._observer.observe(this.canvas);
    }
  }

  _setBackend(backend) {
    const previous = this.backend;
    this.backend = backend;
    if (previous === backend) return;
    try {
      this.settings.onBackendChange?.(backend, previous);
    } catch {
      /* Application callback. */
    }
    const EventConstructor = this._view.CustomEvent ?? globalThis.CustomEvent;
    if (EventConstructor) {
      this.canvas.dispatchEvent?.(
        new EventConstructor("rendererchange", {
          bubbles: true,
          detail: { backend, previous, renderer: this },
        }),
      );
    }
  }

  _warn(error) {
    this.warnings.push(error instanceof Error ? error.message : String(error));
    if (this.warnings.length > 10) this.warnings.shift();
  }

  _releaseGraphics() {
    const device = this._device;
    this._device = null;
    try {
      this._uniformBuffer?.destroy();
    } catch {
      /* Lost resources are already released. */
    }
    try {
      this._gpuContext?.unconfigure();
    } catch {
      /* Lost context. */
    }
    try {
      device?.destroy();
    } catch {
      /* Lost device. */
    }
    this._uniformBuffer = null;
    this._gpuContext = null;
    this._pipeline = null;
    this._bindGroup = null;
    if (this._gl) {
      this.canvas.removeEventListener?.(
        "webglcontextlost",
        this._onContextLost,
      );
      try {
        if (this._program) this._gl.deleteProgram(this._program);
        if (this._vao) this._gl.deleteVertexArray(this._vao);
      } catch {
        /* Lost context. */
      }
    }
    this._gl = null;
    this._program = null;
    this._vao = null;
    this._context2d = null;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._frame !== null) this._cancelFrame(this._frame);
    this._frame = null;
    this._observer?.disconnect();
    this._observer = null;
    this._view.removeEventListener?.("resize", this._onResize);
    this._releaseGraphics();
  }
}

export default DesktopRenderer;
