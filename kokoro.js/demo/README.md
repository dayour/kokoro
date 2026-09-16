---
title: Kokoro Text-to-Speech
emoji: 🗣️
colorFrom: indigo
colorTo: purple
sdk: static
pinned: false
license: apache-2.0
short_description: High-quality speech synthesis powered by Kokoro TTS
header: mini
models:
  - onnx-community/Kokoro-82M-ONNX
custom_headers:
  cross-origin-embedder-policy: require-corp
  cross-origin-opener-policy: same-origin
  cross-origin-resource-policy: cross-origin
---

# Kokoro Text-to-Speech

A simple React + Vite application for running [Kokoro](https://github.com/hexgrad/kokoro), a frontier text-to-speech model for its size. The model runs 100% locally in the browser using [kokoro-js](https://www.npmjs.com/package/kokoro-js) and [🤗 Transformers.js](https://www.npmjs.com/package/@huggingface/transformers)!

## Getting Started

Use Node.js 22.13+, 24.x, or 26+. This demo uses React 19, Vite 8, Tailwind CSS 4,
Motion 13, and ESLint 10. Tailwind runs through its Vite plugin; the old PostCSS
and JavaScript Tailwind configurations are no longer needed. The existing layout
and visual design are retained.

Both JavaScript projects pin TypeScript 7.0.2. ESLint 10 tracks JSX references
natively; Oxlint supplies React correctness rules, with the official React Hooks
and React Refresh ESLint plugins retained. This avoids the old TypeScript
compiler API required by the TypeScript-ESLint-based React lint stack.

This demo intentionally pins React/React DOM
`19.3.0-canary-ff7445e6-20260831` and Vite `8.3.0-beta.1`. These are prereleases,
not stable releases. The targeted npm overrides allow the exact root versions
through integrations whose stable peer ranges exclude prereleases; they do not
disable peer-dependency validation globally. Recheck lint, production builds,
animations, and browser speech synthesis whenever these pins change.

Follow the steps below to set up and run the application.

### 1. Clone the Repository

```sh
git clone https://github.com/dayour/kokoro.git
```

### 2. Build the Dependencies

```sh
cd kokoro/kokoro.js
npm ci
npm run build
```

### 3. Setup the Demo Project

Note this depends on build output from the previous step.

```sh
cd demo
npm ci
```

### 4. Start the Development Server

```sh
npm run dev
```

The application should now be running locally. Open your browser and go to [http://localhost:5173](http://localhost:5173) to see it in action.
