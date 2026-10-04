const TRAILS = 12;
const POLYGONS = 2;
const POINTS = 4;
const fract = (value) => value - Math.floor(value);
const hash = (value) => fract(Math.sin(value * 127.1 + 311.7) * 43758.5453);

const SHADER = `
struct Settings {
  resolution: vec2f,
  time: f32,
  speed: f32,
  pixelRatio: f32,
  seed: f32,
  brightness: f32,
  padding: f32,
};
@group(0) @binding(0) var<uniform> settings: Settings;

fn hash(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453);
}

struct StarVertex {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) brightness: f32,
};

@vertex fn starsVertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> StarVertex {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let id = f32(instance) + settings.seed;
  let xy = vec2f(hash(id * 3.0 + 1.0), hash(id * 3.0 + 2.0)) * 2.0 - 1.0;
  let z = max(0.015, fract(hash(id * 3.0 + 3.0) - settings.time * settings.speed * 0.09));
  let aspect = settings.resolution.x / settings.resolution.y;
  let projected = vec2f(xy.x / aspect, xy.y) / (z * 1.7);
  let radius = (0.55 + 2.8 * pow(1.0 - z, 3.0)) * settings.pixelRatio;
  var output: StarVertex;
  output.position = vec4f(projected + corners[vertex] * radius * 2.0 / settings.resolution, 0.0, 1.0);
  output.local = corners[vertex];
  output.brightness = (0.22 + 0.78 * pow(1.0 - z, 1.5)) * settings.brightness;
  return output;
}

@fragment fn starsFragment(input: StarVertex) -> @location(0) vec4f {
  let coverage = 1.0 - smoothstep(0.35, 1.0, length(input.local));
  return vec4f(vec3f(0.86, 0.92, 1.0) * input.brightness, coverage);
}

fn movingPoint(point: u32, polygon: u32, time: f32) -> vec2f {
  let id = f32(point + polygon * 7u) + settings.seed;
  let start = vec2f(hash(id + 2.0), hash(id + 11.0));
  let velocity = vec2f(hash(id + 31.0), hash(id + 53.0)) * 0.045 + 0.025;
  let position = 0.04 + 0.92 * abs(fract(start + velocity * time * settings.speed) * 2.0 - 1.0);
  return position * 2.0 - 1.0;
}

struct LineVertex {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex fn mystifyVertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> LineVertex {
  var corners = array<vec2f, 6>(
    vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let edge = instance % 4u;
  let polygon = (instance / 4u) % 2u;
  let trail = instance / 8u;
  let time = settings.time - f32(trail) * 0.11;
  let a = movingPoint(edge, polygon, time);
  let b = movingPoint((edge + 1u) % 4u, polygon, time);
  let delta = (b - a) * settings.resolution;
  let direction = delta / max(length(delta), 0.001);
  let normal = vec2f(-direction.y, direction.x) * settings.pixelRatio / settings.resolution;
  let position = mix(a, b, corners[vertex].x) + normal * corners[vertex].y;
  let phase = settings.time * 0.13 + f32(polygon) * 2.8;
  let color = 0.5 + 0.5 * cos(vec3f(0.0, 2.094, 4.188) + phase);
  let alpha = pow(1.0 - f32(trail) / 12.0, 1.4) * 0.86;
  var output: LineVertex;
  output.position = vec4f(position, 0.0, 1.0);
  output.color = vec4f(color * settings.brightness, alpha);
  return output;
}

@fragment fn mystifyFragment(input: LineVertex) -> @location(0) vec4f {
  return input.color;
}
`;

/** An active screen saver; the application owns dismissal and input handling. */
export class GPUScreenSaver {
  constructor(host, options = {}) {
    if (!host?.ownerDocument || typeof host.appendChild !== "function")
      throw new TypeError("A screen saver host element is required.");
    this.host = host;
    this.options = options;
    this.kind = ["blank", "stars", "mystify"].includes(options.kind)
      ? options.kind
      : "blank";
    this.backend = "Starting";
    this.error = null;
    this.warnings = [];
    this._view = host.ownerDocument.defaultView ?? globalThis;
    this._requestFrame =
      this._view.requestAnimationFrame?.bind(this._view) ??
      ((callback) => setTimeout(() => callback(Date.now()), 16));
    this._cancelFrame =
      this._view.cancelAnimationFrame?.bind(this._view) ?? clearTimeout;
    this._clock = () => this._view.performance?.now?.() ?? Date.now();
    this._startTime = this._clock();
    this._lastFrame = -Infinity;
    this._interval =
      1000 / Math.min(60, Math.max(10, Number(options.fps) || 30));
    this._speed = Math.min(5, Math.max(0.1, Number(options.speed) || 1));
    this._seed = Number.isFinite(options.seed)
      ? Math.min(1000000, Math.max(-1000000, options.seed))
      : 17;
    this._brightness = Math.min(
      1,
      Math.max(0.1, Number(options.brightness) || 1),
    );
    this._starCount = Math.min(
      1200,
      Math.max(50, Math.floor(Number(options.starCount) || 450)),
    );
    this._uniforms = new Float32Array(8);
    this._disposed = false;
    this._frame = null;
    this._ownsDevice = false;
    this._claimed = false;
    this.canvas = host.ownerDocument.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      background: "#000",
      pointerEvents: "none",
    });
    host.appendChild(this.canvas);
    this._resize = () => this.resize();
    this._tick = (time) => {
      this._frame = null;
      if (this._disposed) return;
      if (time - this._lastFrame >= this._interval - 0.5) {
        this._lastFrame = time;
        try {
          this._draw(Math.max(0, (time - this._startTime) / 1000));
        } catch (error) {
          if (this.backend === "WebGPU") this._fallback(error);
          else {
            this.error = error;
            this._setBackend("Unavailable");
          }
        }
      }
      if (
        !this._disposed &&
        this._frame === null &&
        this.kind !== "blank" &&
        this.backend !== "Unavailable"
      )
        this._frame = this._requestFrame(this._tick);
    };
    const Observer = this._view.ResizeObserver ?? globalThis.ResizeObserver;
    if (Observer) {
      this._observer = new Observer(this._resize);
      this._observer.observe(host);
    }
    this._view.addEventListener?.("resize", this._resize, { passive: true });
    this.resize();
    this.ready = this._initialize();
  }

  async _initialize() {
    if (this.kind === "blank") {
      this._setBackend("Blank");
      return this;
    }
    try {
      let device = this.options.device;
      if (!device) {
        const gpu =
          this.options.gpu ??
          this._view.navigator?.gpu ??
          globalThis.navigator?.gpu;
        if (!gpu) {
          this._fallback();
          return this;
        }
        const adapter = await gpu.requestAdapter({
          powerPreference: "low-power",
        });
        if (!adapter || this._disposed) {
          if (!this._disposed) this._fallback();
          return this;
        }
        device = await adapter.requestDevice();
        this._ownsDevice = true;
      }
      if (this._disposed) {
        if (this._ownsDevice) device.destroy();
        return this;
      }
      this._device = device;
      const context = this.canvas.getContext("webgpu");
      if (!context)
        throw new Error("A WebGPU screen saver context is unavailable.");
      this._claimed = true;
      this._context = context;
      const gpu =
        this.options.gpu ??
        this._view.navigator?.gpu ??
        globalThis.navigator?.gpu;
      const format = gpu?.getPreferredCanvasFormat?.() ?? "bgra8unorm";
      context.configure({ device, format, alphaMode: "opaque" });
      device.pushErrorScope("validation");
      let pipeline;
      let creationError;
      try {
        const module = device.createShaderModule({
          label: "Windows screen saver geometry",
          code: SHADER,
        });
        pipeline = device.createRenderPipeline({
          label:
            this.kind === "stars"
              ? "Perspective starfield"
              : "Mystify polygon trails",
          layout: "auto",
          vertex: {
            module,
            entryPoint: this.kind === "stars" ? "starsVertex" : "mystifyVertex",
          },
          fragment: {
            module,
            entryPoint:
              this.kind === "stars" ? "starsFragment" : "mystifyFragment",
            targets: [
              {
                format,
                blend: {
                  color: {
                    srcFactor: "src-alpha",
                    dstFactor: "one",
                    operation: "add",
                  },
                  alpha: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                  },
                },
              },
            ],
          },
          primitive: { topology: "triangle-list" },
        });
      } catch (error) {
        creationError = error;
      }
      const validation = await device.popErrorScope();
      if (creationError || validation)
        throw creationError ?? new Error(validation.message);
      if (this._disposed) return this;
      this._pipeline = pipeline;
      this._buffer = device.createBuffer({
        label: "Screen saver clock and size",
        size: 32,
        usage: 0x40 | 0x08,
      });
      this._group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this._buffer } }],
      });
      this._setBackend("WebGPU");
      device.lost.then(
        (details) => {
          if (!this._disposed && this._device === device)
            this._fallback(
              new Error(
                details?.message || "The screen saver GPU device was lost.",
              ),
            );
        },
        (error) => {
          if (!this._disposed && this._device === device) this._fallback(error);
        },
      );
      this.resize();
      this._start();
    } catch (error) {
      if (!this._disposed) this._fallback(error);
    }
    return this;
  }

  _start() {
    if (
      this._disposed ||
      this._frame !== null ||
      this.kind === "blank" ||
      this.backend === "Unavailable"
    )
      return;
    this._lastFrame = -Infinity;
    this._frame = this._requestFrame(this._tick);
  }

  resize() {
    if (this._disposed) return;
    const rectangle = this.host.getBoundingClientRect();
    this._width = Math.max(1, rectangle.width || this._view.innerWidth || 1);
    this._height = Math.max(1, rectangle.height || this._view.innerHeight || 1);
    const maximum = this._device?.limits?.maxTextureDimension2D ?? 16384;
    this._dpr = Math.min(
      2,
      Math.max(1, this._view.devicePixelRatio || 1),
      maximum / this._width,
      maximum / this._height,
    );
    const width = Math.max(1, Math.round(this._width * this._dpr));
    const height = Math.max(1, Math.round(this._height * this._dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this._lastFrame = -Infinity;
  }

  _draw(time) {
    if (this.backend === "WebGPU") {
      this._uniforms.set([
        this.canvas.width,
        this.canvas.height,
        time,
        this._speed,
        this._dpr,
        this._seed,
        this._brightness,
        0,
      ]);
      this._device.queue.writeBuffer(this._buffer, 0, this._uniforms);
      const encoder = this._device.createCommandEncoder({
        label: "Screen saver frame",
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this._context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(this._pipeline);
      pass.setBindGroup(0, this._group);
      pass.draw(
        6,
        this.kind === "stars" ? this._starCount : TRAILS * POLYGONS * POINTS,
      );
      pass.end();
      this._device.queue.submit([encoder.finish()]);
    } else if (this.backend === "Canvas2D") {
      const context = this._context2d;
      context.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      context.globalAlpha = 1;
      context.fillStyle = "#000";
      context.fillRect(0, 0, this._width, this._height);
      if (this.kind === "stars") this._drawStars(context, time);
      else this._drawMystify(context, time);
    }
  }

  _drawStars(context, time) {
    context.fillStyle = "#dceaff";
    const aspect = this._width / this._height;
    for (let index = 0; index < this._starCount; index++) {
      const id = index + this._seed;
      const x = hash(id * 3 + 1) * 2 - 1;
      const y = hash(id * 3 + 2) * 2 - 1;
      const z = Math.max(
        0.015,
        fract(hash(id * 3 + 3) - time * this._speed * 0.09),
      );
      const px = ((x / aspect / (z * 1.7) + 1) * this._width) / 2;
      const py = ((1 - y / (z * 1.7)) * this._height) / 2;
      if (px < -4 || px > this._width + 4 || py < -4 || py > this._height + 4)
        continue;
      const size = 0.8 + 3.5 * (1 - z) ** 3;
      context.globalAlpha = (0.22 + 0.78 * (1 - z) ** 1.5) * this._brightness;
      context.fillRect(px - size / 2, py - size / 2, size, size);
    }
    context.globalAlpha = 1;
  }

  _drawMystify(context, time) {
    context.lineWidth = 1;
    context.lineJoin = "round";
    for (let trail = TRAILS - 1; trail >= 0; trail--) {
      context.globalAlpha =
        (1 - trail / TRAILS) ** 1.4 * 0.86 * this._brightness;
      for (let polygon = 0; polygon < POLYGONS; polygon++) {
        const phase = time * 0.13 + polygon * 2.8;
        const rgb = [0, 2.094, 4.188].map((offset) =>
          Math.round((0.5 + 0.5 * Math.cos(offset + phase)) * 255),
        );
        context.strokeStyle = `rgb(${rgb.join(",")})`;
        context.beginPath();
        for (let point = 0; point < POINTS; point++) {
          const id = point + polygon * 7 + this._seed;
          const t = (time - trail * 0.11) * this._speed;
          const x =
            0.04 +
            0.92 *
              Math.abs(
                fract(hash(id + 2) + (hash(id + 31) * 0.045 + 0.025) * t) * 2 -
                  1,
              );
          const y =
            0.04 +
            0.92 *
              Math.abs(
                fract(hash(id + 11) + (hash(id + 53) * 0.045 + 0.025) * t) * 2 -
                  1,
              );
          if (point === 0)
            context.moveTo(x * this._width, (1 - y) * this._height);
          else context.lineTo(x * this._width, (1 - y) * this._height);
        }
        context.closePath();
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  _fallback(error) {
    if (this._disposed) return;
    if (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      this.warnings.push(this.error.message);
      if (this.warnings.length > 10) this.warnings.shift();
    }
    this._releaseGPU();
    if (this._claimed) {
      const replacement = this.canvas.cloneNode(false);
      this.canvas.parentNode?.replaceChild(replacement, this.canvas);
      this.canvas = replacement;
      this._claimed = false;
    }
    try {
      this._context2d = this.canvas.getContext("2d", { alpha: false });
      if (!this._context2d)
        throw new Error("No canvas screen saver renderer is available.");
      this._claimed = true;
      this._setBackend("Canvas2D");
      this.resize();
      this._start();
    } catch (fallbackError) {
      this.error = fallbackError;
      this._setBackend("Unavailable");
      if (this._frame !== null) this._cancelFrame(this._frame);
      this._frame = null;
    }
  }

  _setBackend(backend) {
    const previous = this.backend;
    this.backend = backend;
    if (previous !== backend) {
      try {
        this.options.onBackendChange?.(backend, previous);
      } catch {
        /* Application callback. */
      }
    }
  }

  _releaseGPU() {
    const device = this._device;
    this._device = null;
    try {
      this._buffer?.destroy();
    } catch {
      /* Already lost. */
    }
    try {
      this._context?.unconfigure();
    } catch {
      /* Already lost. */
    }
    if (this._ownsDevice) {
      try {
        device?.destroy();
      } catch {
        /* Already lost. */
      }
    }
    this._buffer = null;
    this._context = null;
    this._pipeline = null;
    this._group = null;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._frame !== null) this._cancelFrame(this._frame);
    this._frame = null;
    this._observer?.disconnect();
    this._view.removeEventListener?.("resize", this._resize);
    this._releaseGPU();
    this._context2d = null;
    this.canvas.remove();
    this._setBackend("Disposed");
  }
}

/** Start immediately; return the cleanup function used by the application's overlay. */
export function startScreenSaver(host, settings = {}) {
  const saver = new GPUScreenSaver(host, settings);
  const dispose = () => saver.dispose();
  Object.defineProperties(dispose, {
    ready: { value: saver.ready },
    backend: { get: () => saver.backend },
    canvas: { get: () => saver.canvas },
    error: { get: () => saver.error },
    warnings: { get: () => [...saver.warnings] },
  });
  return dispose;
}

export default startScreenSaver;
