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

/* Restore from an export. Deliberately strict: this overwrites a training log,
   so it validates the shape and reports what it found rather than trusting the
   paste and discovering the problem afterwards. */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That isn't valid JSON. Copy the whole thing, including the outer { }." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    return { ok: false, reason: "That's valid JSON but not a training log." };
  if (!data.tm || typeof data.tm !== "object")
    return { ok: false, reason: "No training maxes in there — that isn't a Saiyan Journal export." };

  return {
    ok: true,
    data,
    summary: {
      sessions: Array.isArray(data.history) ? data.history.length : 0,
      cycle: data.cycle || 1,
      lifts: Object.entries(data.tm).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`),
      symptoms: Array.isArray(data.symptoms) ? data.symptoms.length : 0,
      notes: data.notes ? Object.keys(data.notes).length : 0,
      foodDays: data.food ? Object.keys(data.food).length : 0,
    },
  };
}
