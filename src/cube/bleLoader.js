// Shared lazy loader for smartcube-web-bluetooth (works in both Vite browser and Node test runs)

let cachedModPromise = null;

export async function loadSmartCubeBluetooth() {
  if (cachedModPromise) return cachedModPromise;
  cachedModPromise = (async () => {
    if (typeof window !== "undefined") {
      try {
        return await import("smartcube-web-bluetooth");
      } catch (e) {
        console.warn("Could not preload smartcube-web-bluetooth:", e);
        cachedModPromise = null;
        return null;
      }
    }
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        const moduleName = "node" + ":module";
        const nodeModule = await import(/* @vite-ignore */ moduleName);
        const req = nodeModule.createRequire(import.meta.url);
        return req("smartcube-web-bluetooth");
      } catch {
        // Fallback to standard dynamic ESM import
      }
    }
    try {
      return await import("smartcube-web-bluetooth");
    } catch {
      cachedModPromise = null;
      return null;
    }
  })();
  return cachedModPromise;
}

export async function getConnectSmartCubeFn() {
  const mod = await loadSmartCubeBluetooth();
  return mod?.connectSmartCube || mod?.default?.connectSmartCube || null;
}

export async function getConnectGanTimerFn() {
  const mod = await loadSmartCubeBluetooth();
  return mod?.connectGanTimer || mod?.default?.connectGanTimer || null;
}
