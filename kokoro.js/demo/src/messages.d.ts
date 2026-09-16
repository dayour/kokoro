import type { KokoroTTS } from "kokoro-js";

export type Voices = KokoroTTS["voices"];
export type VoiceId = keyof Voices;
export type Device = "webgpu" | "wasm";
export type Status = "loading" | "ready" | "running" | "failed";

export type GenerateRequest = {
  type: "generate";
  text: string;
  voice: VoiceId;
};

export type WorkerResponse = { status: "device"; device: Device } | { status: "ready"; voices: Voices; device: Device } | { status: "complete"; audio: Blob; text: string } | { status: "error"; error: string; fatal: boolean };

export type Result = { text: string; src: string };
