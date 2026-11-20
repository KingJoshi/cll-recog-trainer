// Safe browser persistence helpers (localStorage, sessionStorage, document.cookie)
// All helpers guard non-DOM / Node / SSR environments gracefully.

export function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

export function hasSessionStorage() {
  return typeof sessionStorage !== "undefined";
}

export function readStorageRaw(key) {
  if (!hasLocalStorage()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageRaw(key, value) {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorageKey(key) {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function listStorageKeys() {
  if (!hasLocalStorage()) return [];
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
  } catch {}
  return keys;
}

export function readStorageJSON(key, fallback = null) {
  const raw = readStorageRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorageJSON(key, value) {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readSessionStorageJSON(key, fallback = null) {
  if (!hasSessionStorage()) return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionStorageJSON(key, value) {
  if (!hasSessionStorage()) return false;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readCookieJSON(name, fallback = null) {
  if (typeof document === "undefined") return fallback;
  try {
    const prefix = encodeURIComponent(name) + "=";
    const match = document.cookie.split("; ").find(row => row.startsWith(prefix));
    if (!match) return fallback;
    return JSON.parse(decodeURIComponent(match.slice(prefix.length)));
  } catch {
    return fallback;
  }
}

export function writeCookieJSON(name, value, maxAgeDays = 365) {
  if (typeof document === "undefined") return false;
  try {
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(JSON.stringify(value))}; max-age=${maxAge}; path=/; SameSite=Lax`;
    return true;
  } catch {
    return false;
  }
}
