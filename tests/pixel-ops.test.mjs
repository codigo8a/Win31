import test from "node:test";
import assert from "node:assert/strict";
import { PixelOperations } from "../dist/packages/render/pixel-ops.js";

const sample = () => ({
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    1, 2, 3, 0, 20, 40, 60, 127, 100, 150, 200, 1, 253, 254, 255, 255,
  ]),
});
const expected = {
  invert: [254, 253, 252, 0, 235, 215, 195, 127, 155, 105, 55, 1, 2, 1, 0, 255],
  "flip-horizontal": [
    20, 40, 60, 127, 1, 2, 3, 0, 253, 254, 255, 255, 100, 150, 200, 1,
  ],
  "flip-vertical": [
    100, 150, 200, 1, 253, 254, 255, 255, 1, 2, 3, 0, 20, 40, 60, 127,
  ],
};

function fakeDevice({ readError = null, limits = {}, holdRead = null } = {}) {
  const calls = {
    buffers: [],
    dispatches: [],
    submissions: 0,
    destroyed: 0,
    shaders: [],
  };
  let lose;
  const device = {
    limits: {
      maxBufferSize: 1024 * 1024,
      maxStorageBufferBindingSize: 1024 * 1024,
      maxComputeWorkgroupsPerDimension: 65535,
      ...limits,
    },
    lost: new Promise((resolve) => {
      lose = resolve;
    }),
    pushErrorScope() {},
    popErrorScope: async () => null,
    createShaderModule: (descriptor) => {
      calls.shaders.push(descriptor.code);
      return {};
    },
    createComputePipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createBindGroup: (descriptor) => descriptor,
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        bytes: new Uint8Array(descriptor.size),
        mapped: false,
        destroyed: false,
        async mapAsync(mode, offset, size) {
          assert.equal(mode, 1);
          assert.equal(offset % 8, 0);
          assert.equal(size % 4, 0);
          if (readError) throw readError;
          if (holdRead) await holdRead;
          this.mapped = true;
        },
        getMappedRange(offset, size) {
          assert.ok(this.mapped);
          return this.bytes.buffer.slice(offset, offset + size);
        },
        unmap() {
          this.mapped = false;
        },
        destroy() {
          this.destroyed = true;
        },
      };
      calls.buffers.push(buffer);
      return buffer;
    },
    createCommandEncoder() {
      const commands = [];
      return {
        beginComputePass() {
          let group;
          return {
            setPipeline() {},
            setBindGroup: (index, value) => {
              group = value;
            },
            end() {},
            dispatchWorkgroups(x, y, z) {
              calls.dispatches.push([x, y, z]);
              commands.push(() => {
                const source = new Uint32Array(
                  group.entries[0].resource.buffer.bytes.buffer,
                );
                const destination = new Uint32Array(
                  group.entries[1].resource.buffer.bytes.buffer,
                );
                const parameters = new Uint32Array(
                  group.entries[2].resource.buffer.bytes.buffer,
                );
                const [width, height, operation] = parameters;
                for (let row = 0; row < height; row++) {
                  for (let column = 0; column < width; column++) {
                    const sourceX =
                      operation === 1 ? width - 1 - column : column;
                    const sourceY = operation === 2 ? height - 1 - row : row;
                    const pixel = source[sourceY * width + sourceX];
                    destination[row * width + column] =
                      operation === 0 ? pixel ^ 0x00ffffff : pixel;
                  }
                }
              });
            },
          };
        },
        copyBufferToBuffer(
          source,
          sourceOffset,
          destination,
          destinationOffset,
          size,
        ) {
          commands.push(() =>
            destination.bytes.set(
              source.bytes.subarray(sourceOffset, sourceOffset + size),
              destinationOffset,
            ),
          );
        },
        finish: () => commands,
      };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        buffer.bytes.set(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
          offset,
        );
      },
      submit(commandBuffers) {
        calls.submissions++;
        for (const commands of commandBuffers)
          for (const command of commands) command();
      },
    },
    destroy() {
      calls.destroyed++;
    },
  };
  return {
    device,
    calls,
    lose: () => lose({ message: "Device lost during test" }),
  };
}

for (const operation of Object.keys(expected)) {
  test(`CPU ${operation} returns exact RGBA bytes without changing the source`, async () => {
    const operations = new PixelOperations({
      gpu: { requestAdapter: async () => null },
    });
    const input = sample();
    const before = [...input.data];
    const output = await operations.transform(input, operation);
    assert.equal(operations.backend, "CPU");
    assert.deepEqual([...output.data], expected[operation]);
    assert.deepEqual([...input.data], before);
    assert.notEqual(output.data, input.data);
    assert.equal(output.width, 2);
    assert.equal(output.height, 2);
    operations.dispose();
  });

  test(`WebGPU ${operation} dispatches compute and reads the exact unpadded RGBA result`, async () => {
    const gpu = fakeDevice();
    const operations = new PixelOperations({ device: gpu.device });
    const input = sample();
    const output = await operations.transform(input, operation);
    assert.equal(operations.backend, "WebGPU");
    assert.equal(operations.lastBackend, "WebGPU");
    assert.deepEqual([...output.data], expected[operation]);
    assert.equal(output.data.length, 16);
    assert.deepEqual(gpu.calls.dispatches, [[1, 1, 1]]);
    assert.equal(gpu.calls.submissions, 1);
    assert.ok(
      gpu.calls.buffers.every(
        (buffer) =>
          buffer.size % 256 === 0 && buffer.destroyed && !buffer.mapped,
      ),
    );
    assert.match(gpu.calls.shaders[0], /@compute/);
    assert.equal(operations._lossWaiters.size, 0);
    operations.dispose();
    assert.equal(
      gpu.calls.destroyed,
      0,
      "A supplied shared device must not be destroyed.",
    );
  });
}

test("GPU mapping failure returns the CPU result and releases every per-operation buffer", async () => {
  const gpu = fakeDevice({ readError: new Error("Readback failed") });
  const operations = new PixelOperations({ device: gpu.device });
  const output = await operations.transform(sample(), "invert");
  assert.equal(operations.backend, "CPU");
  assert.deepEqual([...output.data], expected.invert);
  assert.match(operations.error.message, /Readback failed/);
  assert.ok(gpu.calls.buffers.every((buffer) => buffer.destroyed));
  const second = await operations.transform(sample(), "flip-vertical");
  assert.deepEqual([...second.data], expected["flip-vertical"]);
  assert.equal(gpu.calls.submissions, 1);
  operations.dispose();
});

test("device loss during a stalled map falls back without waiting for the map promise", async () => {
  const gpu = fakeDevice({ holdRead: new Promise(() => {}) });
  const operations = new PixelOperations({ device: gpu.device });
  await operations.init();
  const result = operations.transform(sample(), "invert");
  while (!gpu.calls.submissions) await Promise.resolve();
  gpu.lose();
  const output = await result;
  assert.equal(operations.backend, "CPU");
  assert.deepEqual([...output.data], expected.invert);
  assert.ok(gpu.calls.buffers.every((buffer) => buffer.destroyed));
  operations.dispose();
});

test("limits fall back for oversized work while later supported work can still use the GPU", async () => {
  const gpu = fakeDevice({ limits: { maxStorageBufferBindingSize: 256 } });
  const operations = new PixelOperations({ device: gpu.device });
  const large = {
    width: 65,
    height: 1,
    data: new Uint8ClampedArray(65 * 4).fill(3),
  };
  const output = await operations.transform(large, "invert");
  assert.equal(operations.backend, "CPU");
  assert.equal(output.data[0], 252);
  assert.equal(output.data[3], 3);
  assert.equal(gpu.calls.submissions, 0);
  await operations.transform(sample(), "invert");
  assert.equal(operations.backend, "WebGPU");
  assert.equal(gpu.calls.submissions, 1);
  operations.dispose();
});

test("unsupported operations and malformed dimensions reject without allocating GPU buffers", async () => {
  const gpu = fakeDevice();
  const operations = new PixelOperations({ device: gpu.device });
  await assert.rejects(operations.transform(sample(), "blur"), /Unsupported/);
  await assert.rejects(
    operations.transform(
      { width: 0, height: 1, data: new Uint8ClampedArray() },
      "invert",
    ),
    /dimensions/,
  );
  await assert.rejects(
    operations.transform(
      { width: 2, height: 2, data: new Uint8ClampedArray(3) },
      "invert",
    ),
    /RGBA bytes/,
  );
  assert.equal(gpu.calls.buffers.length, 0);
  operations.dispose();
  await assert.rejects(operations.transform(sample(), "invert"), /disposed/);
});

test("input is snapshotted before asynchronous initialization", async () => {
  let initialize;
  const adapterReady = new Promise((resolve) => {
    initialize = resolve;
  });
  const operations = new PixelOperations({
    gpu: { requestAdapter: () => adapterReady },
  });
  const input = sample();
  const result = operations.transform(input, "invert");
  input.data.fill(0);
  initialize(null);
  assert.deepEqual([...(await result).data], expected.invert);
  operations.dispose();
});

test("owned devices are released and browser ImageData shape and color space are retained", async () => {
  const previous = globalThis.ImageData;
  globalThis.ImageData = class ImageData {
    constructor(data, width, height, options = {}) {
      this.data = data;
      this.width = width;
      this.height = height;
      this.colorSpace = options.colorSpace ?? "srgb";
    }
  };
  try {
    const gpu = fakeDevice();
    const operations = new PixelOperations({
      gpu: {
        requestAdapter: async () => ({ requestDevice: async () => gpu.device }),
      },
    });
    const image = sample();
    const input = new ImageData(image.data, image.width, image.height, {
      colorSpace: "display-p3",
    });
    const output = await operations.transform(input, "flip-horizontal");
    assert.ok(output instanceof ImageData);
    assert.equal(output.colorSpace, "display-p3");
    assert.deepEqual([...output.data], expected["flip-horizontal"]);
    operations.dispose();
    assert.equal(gpu.calls.destroyed, 1);
  } finally {
    if (previous === undefined) delete globalThis.ImageData;
    else globalThis.ImageData = previous;
  }
});
