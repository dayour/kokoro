import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";

export default function App() {
  const workerRef = useRef(/** @type {Worker | null} */ (null));
  const busyRef = useRef(false);
  const audioUrls = useRef(/** @type {Set<string>} */ (new Set()));

  const [inputText, setInputText] = useState("Life is like a box of chocolates. You never know what you're gonna get.");
  const [selectedSpeaker, setSelectedSpeaker] = useState(/** @type {import("./messages.js").VoiceId} */ ("af_heart"));

  const [voices, setVoices] = useState(/** @type {import("./messages.js").Voices | null} */ (null));
  const [status, setStatus] = useState(/** @type {import("./messages.js").Status} */ ("loading"));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  const [results, setResults] = useState(/** @type {import("./messages.js").Result[]} */ ([]));

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    const worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    const urls = audioUrls.current;

    /** @param {MessageEvent<import("./messages.js").WorkerResponse>} e */
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case "device":
          setLoadingMessage(`Loading model (device="${e.data.device}")`);
          break;
        case "ready":
          setStatus("ready");
          setVoices(e.data.voices);
          break;
        case "error":
          busyRef.current = false;
          setError(e.data.fatal ? `${e.data.error} Reload the page to try again.` : e.data.error);
          setStatus(e.data.fatal ? "failed" : "ready");
          break;
        case "complete": {
          const { audio, text } = e.data;
          const src = URL.createObjectURL(audio);
          urls.add(src);
          busyRef.current = false;
          setResults((prev) => [{ text, src }, ...prev]);
          setStatus("ready");
          break;
        }
      }
    };

    /** @param {ErrorEvent} e */
    const onErrorReceived = (e) => {
      console.error("Worker error:", e);
      busyRef.current = false;
      setError(e.message || "The speech worker failed. Reload the page to try again.");
      setStatus("failed");
    };

    // Attach the callback function as an event listener.
    worker.addEventListener("message", onMessageReceived);
    worker.addEventListener("error", onErrorReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.removeEventListener("message", onMessageReceived);
      worker.removeEventListener("error", onErrorReceived);
      worker.terminate();
      workerRef.current = null;
      busyRef.current = false;
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  /** @param {import("react").SubmitEvent<HTMLFormElement>} e */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (status !== "ready" || busyRef.current || !workerRef.current) {
      return;
    }
    const text = inputText.trim();
    if (!text) {
      setError("Enter some text to generate speech.");
      return;
    }
    busyRef.current = true;
    setError(null);
    setStatus("running");

    /** @type {import("./messages.js").GenerateRequest} */
    const request = {
      type: "generate",
      text,
      voice: selectedSpeaker,
    };
    workerRef.current.postMessage(request);
  };

  return (
    <div className="relative w-full min-h-screen bg-linear-to-br from-gray-900 to-gray-700 flex flex-col items-center justify-center p-4 overflow-hidden font-sans">
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: status === "loading" || status === "failed" ? 1 : 0 }} transition={{ duration: 0.5 }} className="absolute w-screen h-screen justify-center flex flex-col items-center z-10 bg-gray-800/95 backdrop-blur-md" style={{ pointerEvents: status === "loading" || status === "failed" ? "auto" : "none" }} aria-hidden={status !== "loading" && status !== "failed"}>
        <div className="w-[250px] h-[250px] border-4 border-white shadow-[0_0_0_5px_#4973ff] rounded-full overflow-hidden">
          <div className="loading-wave"></div>
        </div>
        <p role={error ? "alert" : "status"} className={`text-3xl my-5 text-center ${error ? "text-red-500" : "text-white"}`}>
          {error ?? loadingMessage}
        </p>
      </motion.div>

      <div className="max-w-3xl w-full space-y-8 relative z-[2]">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-gray-100 mb-2 drop-shadow-lg font-heading">Kokoro Text-to-Speech</h1>
          <p className="text-2xl text-gray-300 font-semibold font-subheading">
            Powered by&nbsp;
            <a href="https://github.com/hexgrad/kokoro" target="_blank" rel="noreferrer" className="underline">
              Kokoro
            </a>
            &nbsp;and&nbsp;
            <a href="https://huggingface.co/docs/transformers.js" target="_blank" rel="noreferrer" className="underline">
              <img width="40" src="hf-logo.svg" alt="" className="inline translate-y-[-2px] me-1"></img>Transformers.js
            </a>
          </p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && status === "ready" && (
              <p role="alert" className="text-white">
                {error}
              </p>
            )}
            <textarea aria-label="Text to speak" placeholder="Enter text..." value={inputText} onChange={(e) => setInputText(e.target.value)} className="w-full min-h-[100px] max-h-[300px] bg-gray-700/50 backdrop-blur-sm border-2 border-gray-600 rounded-xl resize-y text-gray-100 placeholder-gray-400 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={Math.min(8, inputText.split("\n").length)} />
            <div className="flex flex-col items-center space-y-4">
              <select
                aria-label="Voice"
                value={selectedSpeaker}
                onChange={(e) => {
                  const voice = e.target.value;
                  if (voices && Object.hasOwn(voices, voice)) {
                    setSelectedSpeaker(/** @type {import("./messages.js").VoiceId} */ (voice));
                  }
                }}
                className="w-full bg-gray-700/50 backdrop-blur-sm border-2 border-gray-600 rounded-xl text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {(voices ? Object.entries(voices) : []).map(([id, voice]) => (
                  <option key={id} value={id}>
                    {voice.name} ({voice.language === "en-us" ? "American" : "British"} {voice.gender})
                  </option>
                ))}
              </select>
              <button type="submit" className="inline-flex justify-center items-center px-6 py-2 text-lg font-semibold bg-linear-to-t from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-colors duration-300 rounded-xl text-white disabled:opacity-50" disabled={status !== "ready" || inputText.trim() === ""}>
                {status === "running" ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>
        </div>

        {results.length > 0 && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="max-h-[250px] overflow-y-auto px-2 mt-4 space-y-6 relative z-[2]">
            {results.map((result, i) => (
              <div key={result.src}>
                <div className="text-white bg-gray-800/70 backdrop-blur-sm border border-gray-700 rounded-lg p-4 z-10">
                  <span className="absolute right-5 font-bold">#{results.length - i}</span>
                  <p className="mb-3 max-w-[95%]">{result.text}</p>
                  <audio controls src={result.src} className="w-full">
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <div className="bg-[#015871] pointer-events-none absolute left-0 w-full h-[5%] bottom-[-50px]">
        <div className="wave"></div>
        <div className="wave"></div>
      </div>
    </div>
  );
}
