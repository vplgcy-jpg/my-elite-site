/* Storage.

   window.storage when running as an artifact, localStorage otherwise.

   The important part: a READ FAILURE must never look like "no data yet".
   Conflating them drops an existing user onto Setup, where the first save
   overwrites their entire history. load() returns a tagged result so the UI
   can show a retry instead of a fresh-start screen. */

export const KEY = "saiyan-state";

function backend() {
  if (typeof window !== "undefined" && window.storage?.get && window.storage?.set)
    return {
      async get(k) {
        const r = await window.storage.get(k);
        return r ? r.value : null;
      },
      async set(k, v) {
        await window.storage.set(k, v);
      },
    };
  return {
    async get(k) {
      return window.localStorage.getItem(k);
    },
    async set(k, v) {
      window.localStorage.setItem(k, v);
    },
  };
}

export async function load(key = KEY) {
  try {
    const raw = await backend().get(key);
    if (raw == null || raw === "") return { ok: true, empty: true, value: null };
    try {
      return { ok: true, empty: false, value: JSON.parse(raw) };
    } catch (e) {
      /* Corrupt data is a read failure, not a fresh start. Never offer Setup. */
      return { ok: false, empty: false, value: null, error: e, corrupt: true, raw };
    }
  } catch (e) {
    return { ok: false, empty: false, value: null, error: e };
  }
}

export async function save(value, key = KEY) {
  try {
    await backend().set(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}
