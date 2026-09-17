import { KokoroTTS } from "kokoro-js";
import { detectWebGPU } from "./utils.js";

/** @param {import("./messages.js").WorkerResponse} message */
function send(message) {
  self.postMessage(message);
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function initialize() {
  const device = (await detectWebGPU()) ? "webgpu" : "wasm";
  send({ status: "device", device });

  const tts = await KokoroTTS.from_pretrained(
    "onnx-community/Kokoro-82M-v1.0-ONNX",
    {
      dtype: device === "wasm" ? "q8" : "fp32",
      device,
    },
  );
  let running = false;

  self.addEventListener("messageerror", () => {
    send({
      status: "error",
      error: "The generation request could not be decoded.",
      fatal: true,
    });
  });

  self.addEventListener(
    "message",
    async (
      /** @type {MessageEvent<import("./messages.js").GenerateRequest>} */ e,
    ) => {
      if (running) {
        console.warn(
          "Ignoring a duplicate generation request while speech is running.",
        );
        return;
      }
      running = true;
      try {
        const { type, text, voice } = e.data;
        if (
          type !== "generate" ||
          typeof text !== "string" ||
          !text.trim() ||
          !Object.hasOwn(tts.voices, voice)
        ) {
          throw new Error(
            "Enter non-empty text and select an available voice.",
          );
        }
        const audio = await tts.generate(text.trim(), { voice });
        send({ status: "complete", audio: audio.toBlob(), text: text.trim() });
      } catch (error) {
        send({ status: "error", error: errorMessage(error), fatal: false });
      } finally {
        running = false;
      }
    },
  );
  send({ status: "ready", voices: tts.voices, device });
}

await initialize().catch((error) => {
  send({ status: "error", error: errorMessage(error), fatal: true });
});
