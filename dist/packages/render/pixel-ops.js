const OPERATION_CODES = Object.freeze({
  invert: 0,
  "invert-colors": 0,
  "flip-horizontal": 1,
  horizontal: 1,
  fliphorizontal: 1,
  fliph: 1,
  "flip-vertical": 2,
  vertical: 2,
  flipvertical: 2,
  flipv: 2,
});
const WORKGROUP_SIDE = 8;
const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const align = (value, alignment = 256) =>
  Math.ceil(value / alignment) * alignment;

const COMPUTE_SHADER = `
struct Parameters {
  width: u32,
  height: u32,
  operation: u32,
  padding: u32,
};

@group(0) @binding(0) var<storage, read> sourcePixels: array<u32>;
@group(0) @binding(1) var<storage, read_write> destinationPixels: array<u32>;
@group(0) @binding(2) var<uniform> parameters: Parameters;

@compute @workgroup_size(${WORKGROUP_SIDE}, ${WORKGROUP_SIDE}, 1)
fn transformPixels(@builtin(global_invocation_id) position: vec3u) {
  if (position.x >= parameters.width || position.y >= parameters.height) {
    return;
  }
  var sourceX = position.x;
  var sourceY = position.y;
  if (parameters.operation == 1u) {
    sourceX = parameters.width - 1u - position.x;
  }
  if (parameters.operation == 2u) {
    sourceY = parameters.height - 1u - position.y;
  }
  var pixel = sourcePixels[sourceY * parameters.width + sourceX];
  if (parameters.operation == 0u) {
    // RGBA bytes are packed in one little-endian u32. Alpha is untouched.
    pixel = pixel ^ 0x00ffffffu;
  }
  destinationPixels[position.y * parameters.width + position.x] = pixel;
}
`;

function parseInput(image, operation) {
  const code = OPERATION_CODES[String(operation).toLowerCase()];
  if (code === undefined)
    throw new TypeError(`Unsupported pixel operation: ${String(operation)}`);
  if (
    !image ||
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1
  ) {
    throw new TypeError(
      "Pixel operations require positive integer image dimensions.",
    );
  }
  const pixels = image.width * image.height;
  const byteLength = pixels * 4;
  if (
    !Number.isSafeInteger(byteLength) ||
    pixels > 0xffffffff ||
    image.width > 0xffffffff ||
    image.height > 0xffffffff
  ) {
    throw new RangeError("The image dimensions are too large.");
  }
  if (
    !(
      image.data instanceof Uint8ClampedArray ||
      image.data instanceof Uint8Array
    ) ||
    image.data.byteLength !== byteLength
  ) {
    throw new TypeError(
      "Image data must contain exactly width × height × 4 RGBA bytes.",
    );
  }
  // Snapshot immediately: later edits to a canvas or shared caller array cannot race this operation.
  return {
    width: image.width,
    height: image.height,
    data: new Uint8ClampedArray(image.data),
    code,
    original: image,
  };
}

function outputFor(input, data) {
  const ImageDataConstructor = globalThis.ImageData;
  if (
    typeof ImageDataConstructor === "function" &&
    input.original instanceof ImageDataConstructor
  ) {
    if (input.original.colorSpace) {
      return new ImageDataConstructor(data, input.width, input.height, {
        colorSpace: input.original.colorSpace,
      });
    }
    return new ImageDataConstructor(data, input.width, input.height);
  }
  return {
    width: input.width,
    height: input.height,
    data,
    ...(typeof input.original.colorSpace === "string"
      ? { colorSpace: input.original.colorSpace }
      : {}),
  };
}

/** Exact fallback: only integer operations and typed-array copies; alpha is preserved. */
function transformCPU(input) {
  const { width, height, data, code } = input;
  const output = new Uint8ClampedArray(data.length);
  if (code === 0) {
    for (let index = 0; index < data.length; index += 4) {
      output[index] = 255 - data[index];
      output[index + 1] = 255 - data[index + 1];
      output[index + 2] = 255 - data[index + 2];
      output[index + 3] = data[index + 3];
    }
  } else if (code === 1) {
    // Copying whole words preserves the original four bytes on either host endianness.
    const sourceWords = new Uint32Array(
      data.buffer,
      data.byteOffset,
      width * height,
    );
    const outputWords = new Uint32Array(output.buffer);
    for (let row = 0; row < height; row++) {
      const rowStart = row * width;
      for (let column = 0; column < width; column++) {
        outputWords[rowStart + column] =
          sourceWords[rowStart + width - 1 - column];
      }
    }
  } else {
    const rowBytes = width * 4;
    for (let row = 0; row < height; row++) {
      const sourceStart = (height - 1 - row) * rowBytes;
      output.set(
        data.subarray(sourceStart, sourceStart + rowBytes),
        row * rowBytes,
      );
    }
  }
  return output;
}

/**
 * A bounded WebGPU compute service for Paintbrush-style RGBA operations.
 * transform() snapshots its input, serializes GPU work, and returns new image data.
 */
export class PixelOperations {
  constructor(options = {}) {
    this.backend = "Starting";
    this.lastBackend = null;
    this.error = null;
    this.warnings = [];
    this._options = options;
    this._providedDevice = options.device ?? null;
    this._maxBufferBytes =
      Number.isFinite(options.maxBufferBytes) && options.maxBufferBytes > 0
        ? Math.floor(options.maxBufferBytes)
        : DEFAULT_MAX_BUFFER_BYTES;
    this._device = null;
    this._ownsDevice = false;
    this._disposed = false;
    this._queue = Promise.resolve();
    this._activeBuffers = new Set();
    this._lossWaiters = new Set();
  }

  init() {
    if (this._disposed)
      return Promise.reject(new Error("PixelOperations has been disposed."));
    if (!this._initPromise) this._initPromise = this._initialize();
    return this._initPromise;
  }

  async _initialize() {
    let device = this._providedDevice;
    try {
      if (!LITTLE_ENDIAN) {
        this._setBackend("CPU");
        return this;
      }
      if (!device) {
        const gpu = this._options.gpu ?? globalThis.navigator?.gpu;
        if (!gpu) {
          this._setBackend("CPU");
          return this;
        }
        const adapter = await gpu.requestAdapter({
          powerPreference: "low-power",
        });
        if (!adapter || this._disposed) {
          this._setBackend(this._disposed ? "Disposed" : "CPU");
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
      const limits = device.limits ?? {};
      if (
        (limits.maxComputeInvocationsPerWorkgroup ?? 256) <
          WORKGROUP_SIDE ** 2 ||
        (limits.maxComputeWorkgroupSizeX ?? 256) < WORKGROUP_SIDE ||
        (limits.maxComputeWorkgroupSizeY ?? 256) < WORKGROUP_SIDE ||
        (limits.maxStorageBuffersPerShaderStage ?? 8) < 2
      ) {
        throw new Error(
          "The GPU compute limits cannot support this pixel pipeline.",
        );
      }
      device.lost.then(
        (details) => {
          const error = new Error(
            details?.message || "The pixel processing GPU device was lost.",
          );
          if (!this._disposed && this._device === device)
            this._disableGPU(error);
          return error;
        },
        (error) => {
          if (!this._disposed && this._device === device)
            this._disableGPU(error);
          return error instanceof Error ? error : new Error(String(error));
        },
      );
      device.pushErrorScope("validation");
      let pipeline;
      let creationError;
      try {
        const shader = device.createShaderModule({
          label: "Exact RGBA pixel operations",
          code: COMPUTE_SHADER,
        });
        pipeline = device.createComputePipeline({
          label: "Paintbrush invert and flip",
          layout: "auto",
          compute: { module: shader, entryPoint: "transformPixels" },
        });
      } catch (error) {
        creationError = error;
      }
      const validation = await device.popErrorScope();
      if (creationError || validation)
        throw creationError ?? new Error(validation.message);
      if (this._disposed || this._device !== device) return this;
      this._pipeline = pipeline;
      this._setBackend("WebGPU");
    } catch (error) {
      this._disableGPU(error);
    }
    return this;
  }

  /** operation: 'invert', 'flip-horizontal', or 'flip-vertical'. Input is never modified. */
  async transform(imageData, operation) {
    if (this._disposed) throw new Error("PixelOperations has been disposed.");
    const input = parseInput(imageData, operation);
    await this.init();
    const work = this._queue.then(async () => {
      if (this._disposed) throw new Error("PixelOperations has been disposed.");
      let data;
      if (this._device && this._pipeline && this._fitsGPU(input)) {
        try {
          data = await this._transformGPU(input);
          this.lastBackend = "WebGPU";
          this._setBackend("WebGPU");
        } catch (error) {
          if (this._disposed)
            throw new Error(
              "PixelOperations was disposed before the operation completed.",
            );
          this._disableGPU(error);
        }
      }
      if (!data) {
        data = transformCPU(input);
        this.lastBackend = "CPU";
        this._setBackend("CPU");
      }
      if (this._disposed)
        throw new Error(
          "PixelOperations was disposed before the operation completed.",
        );
      return outputFor(input, data);
    });
    this._queue = work.catch(() => {
      /* Each caller receives its own failure. Later work can proceed. */
    });
    return work;
  }

  _fitsGPU(input) {
    const limits = this._device.limits ?? {};
    const size = align(input.data.byteLength);
    const maximum = Math.min(
      this._maxBufferBytes,
      limits.maxBufferSize ?? 256 * 1024 * 1024,
      limits.maxStorageBufferBindingSize ?? 128 * 1024 * 1024,
    );
    const groups = limits.maxComputeWorkgroupsPerDimension ?? 65535;
    return (
      size <= maximum &&
      Math.ceil(input.width / WORKGROUP_SIDE) <= groups &&
      Math.ceil(input.height / WORKGROUP_SIDE) <= groups
    );
  }

  async _transformGPU(input) {
    const device = this._device;
    const pipeline = this._pipeline;
    const size = align(input.data.byteLength);
    const buffers = [];
    let readback;
    let mapped = false;
    const create = (label, usage, bufferSize = size) => {
      const buffer = device.createBuffer({ label, size: bufferSize, usage });
      buffers.push(buffer);
      this._activeBuffers.add(buffer);
      return buffer;
    };
    try {
      device.pushErrorScope("out-of-memory");
      device.pushErrorScope("validation");
      let executionError;
      try {
        // Numeric GPUBufferUsage flags avoid relying on globals when a device is injected.
        const source = create("Pixel source", 0x80 | 0x08); // STORAGE | COPY_DST
        const destination = create("Pixel destination", 0x80 | 0x04); // STORAGE | COPY_SRC
        readback = create("Pixel readback", 0x01 | 0x08); // MAP_READ | COPY_DST
        const parameters = create(
          "Pixel operation parameters",
          0x40 | 0x08,
          256,
        ); // UNIFORM | COPY_DST
        device.queue.writeBuffer(source, 0, input.data);
        device.queue.writeBuffer(
          parameters,
          0,
          new Uint32Array([input.width, input.height, input.code, 0]),
        );
        const group = device.createBindGroup({
          label: "Pixel operation buffers",
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: source, offset: 0, size } },
            { binding: 1, resource: { buffer: destination, offset: 0, size } },
            {
              binding: 2,
              resource: { buffer: parameters, offset: 0, size: 16 },
            },
          ],
        });
        const encoder = device.createCommandEncoder({
          label: "Paintbrush pixel operation",
        });
        const pass = encoder.beginComputePass({
          label: "Transform RGBA pixels",
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(
          Math.ceil(input.width / WORKGROUP_SIDE),
          Math.ceil(input.height / WORKGROUP_SIDE),
          1,
        );
        pass.end();
        encoder.copyBufferToBuffer(destination, 0, readback, 0, size);
        device.queue.submit([encoder.finish()]);
      } catch (error) {
        executionError = error;
      }
      // Pop scopes synchronously before yielding, so an injected shared device is safe.
      const validationPromise = device.popErrorScope();
      const allocationPromise = device.popErrorScope();
      const [validation, allocation] = await Promise.all([
        validationPromise,
        allocationPromise,
      ]);
      if (executionError || validation || allocation) {
        throw executionError ?? new Error((validation ?? allocation).message);
      }
      if (this._disposed || this._device !== device)
        throw new Error("The GPU became unavailable before readback.");
      // mapAsync waits for the submitted copy. Racing loss also handles a stalled device.
      let rejectLoss;
      const loss = new Promise((resolve, reject) => {
        rejectLoss = reject;
      });
      this._lossWaiters.add(rejectLoss);
      try {
        await Promise.race([readback.mapAsync(0x01, 0, size), loss]);
      } finally {
        this._lossWaiters.delete(rejectLoss);
      }
      mapped = true;
      const output = new Uint8ClampedArray(input.data.byteLength);
      output.set(
        new Uint8Array(readback.getMappedRange(0, size), 0, output.byteLength),
      );
      readback.unmap();
      mapped = false;
      return output;
    } finally {
      if (mapped) {
        try {
          readback.unmap();
        } catch {
          /* The device may already be lost. */
        }
      }
      for (const buffer of buffers) {
        this._activeBuffers.delete(buffer);
        try {
          buffer.destroy();
        } catch {
          /* Lost devices already released these resources. */
        }
      }
    }
  }

  _setBackend(backend) {
    const previous = this.backend;
    this.backend = backend;
    if (previous !== backend) {
      try {
        this._options.onBackendChange?.(backend, previous);
      } catch {
        /* Application callback. */
      }
    }
  }

  _disableGPU(error) {
    if (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      this.warnings.push(this.error.message);
      if (this.warnings.length > 10) this.warnings.shift();
    }
    const device = this._device;
    this._device = null;
    this._pipeline = null;
    for (const reject of this._lossWaiters)
      reject(error ?? new Error("PixelOperations has been disposed."));
    this._lossWaiters.clear();
    if (this._ownsDevice) {
      try {
        device?.destroy();
      } catch {
        /* Already lost. */
      }
    }
    this._setBackend(this._disposed ? "Disposed" : "CPU");
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const buffer of this._activeBuffers) {
      try {
        buffer.destroy();
      } catch {
        /* Already lost. */
      }
    }
    this._activeBuffers.clear();
    this._disableGPU();
  }
}

export default PixelOperations;
