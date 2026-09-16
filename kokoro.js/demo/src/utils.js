export async function detectWebGPU() {
  if (!("gpu" in navigator)) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch (error) {
    console.warn("WebGPU detection failed; using WebAssembly instead.", error);
    return false;
  }
}
