import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  load: vi.fn(),
  generate: vi.fn(),
  voices: { af_heart: { name: "Heart", language: "en-us", gender: "Female" } },
}));

vi.mock("kokoro-js", () => ({ KokoroTTS: { from_pretrained: engine.load } }));

let listeners;
let send;
const request = { type: "generate", text: " Hello. ", voice: "af_heart" };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  listeners = new Map();
  send = vi.fn();
  vi.stubGlobal("self", {
    postMessage: send,
    addEventListener: (type, callback) => listeners.set(type, callback),
  });
  vi.stubGlobal("navigator", {});
  engine.load.mockResolvedValue({
    voices: engine.voices,
    generate: engine.generate,
  });
  engine.generate.mockResolvedValue({ toBlob: () => new Blob(["audio"]) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function initialize() {
  await import("../demo/src/worker.js");
}

async function dispatch(data) {
  const listener = listeners.get("message");
  if (!listener) throw new Error("The worker is not ready");
  await listener({ data });
}

describe("speech worker", () => {
  it("loads the quantized WASM model without WebGPU", async () => {
    await initialize();
    expect(engine.load).toHaveBeenCalledWith(expect.any(String), {
      device: "wasm",
      dtype: "q8",
    });
    expect(send).toHaveBeenLastCalledWith({
      status: "ready",
      voices: engine.voices,
      device: "wasm",
    });
  });

  it("selects WebGPU only when an adapter is available", async () => {
    vi.stubGlobal("navigator", {
      gpu: { requestAdapter: vi.fn().mockResolvedValue({}) },
    });
    await initialize();
    expect(engine.load).toHaveBeenCalledWith(expect.any(String), {
      device: "webgpu",
      dtype: "fp32",
    });
  });

  it("reports WebGPU detection errors and falls back to WASM", async () => {
    const error = new Error("Adapter unavailable");
    vi.stubGlobal("navigator", {
      gpu: { requestAdapter: vi.fn().mockRejectedValue(error) },
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await initialize();
    expect(warning).toHaveBeenCalledWith(expect.any(String), error);
    expect(engine.load).toHaveBeenCalledWith(expect.any(String), {
      device: "wasm",
      dtype: "q8",
    });
  });

  it("reports model-load failures as fatal", async () => {
    engine.load.mockRejectedValue(new Error("Download failed"));
    await initialize();
    expect(send).toHaveBeenLastCalledWith({
      status: "error",
      error: "Download failed",
      fatal: true,
    });
    expect(listeners.has("message")).toBe(false);
  });

  it("returns a Blob owned by the receiving page, not a worker URL", async () => {
    await initialize();
    await dispatch(request);
    expect(engine.generate).toHaveBeenCalledWith("Hello.", {
      voice: "af_heart",
    });
    expect(send).toHaveBeenLastCalledWith({
      status: "complete",
      audio: expect.any(Blob),
      text: "Hello.",
    });
  });

  it.each([
    null,
    {},
    { ...request, type: "unknown" },
    { ...request, text: " " },
    { ...request, text: 123 },
    { ...request, voice: "constructor" },
  ])(
    "rejects malformed requests without calling inference: %j",
    async (invalid) => {
      await initialize();
      await dispatch(invalid);
      expect(engine.generate).not.toHaveBeenCalled();
      expect(send).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "error", fatal: false }),
      );
    },
  );

  it("accepts a new request after an inference failure", async () => {
    engine.generate.mockRejectedValueOnce(new Error("Inference failed"));
    await initialize();
    await dispatch(request);
    expect(send).toHaveBeenLastCalledWith({
      status: "error",
      error: "Inference failed",
      fatal: false,
    });
    await dispatch(request);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "complete" }),
    );
  });

  it("does not run concurrent inference for duplicate requests", async () => {
    let finish;
    engine.generate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await initialize();
    const pending = dispatch(request);
    await dispatch(request);
    expect(engine.generate).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledOnce();
    finish({ toBlob: () => new Blob(["audio"]) });
    await pending;
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "complete" }),
    );
  });

  it("reports undecodable requests explicitly", async () => {
    await initialize();
    listeners.get("messageerror")();
    expect(send).toHaveBeenLastCalledWith({
      status: "error",
      error: "The generation request could not be decoded.",
      fatal: true,
    });
  });
});
