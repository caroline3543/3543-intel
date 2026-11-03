const isRosterKey = key => /^svs_rally_data(?::state:[1-9]\d{0,4})?$/.test(key);

// Keep synchronous reads for the existing UI, but acknowledge writes only after
// the IndexedDB transaction commits. No roster fields are discarded or trimmed.
export function createRosterStorage(storage, database, onError = () => {}) {
  const cache = new Map();
  let pending = Promise.resolve();
  let lastError = null;
  let queued = 0;
  function enqueue(task) {
    queued++;
    pending = pending.catch(() => {}).then(task).then(() => { lastError = null; }, error => {
      lastError = error;
      onError(error);
      throw error;
    }).finally(() => { queued--; });
    // Autosave is fire-and-forget; explicit flush still observes the failure.
    pending.catch(() => {});
  }
  return {
    async initialize() {
      for (const [key, value] of await database.entries()) cache.set(key, value);
      const keys = Array.from({length: storage.length}, (_, i) => storage.key(i)).filter(isRosterKey);
      for (const key of keys) {
        const value = storage.getItem(key);
        if (value == null) continue;
        // A local copy wins during migration; it may be newer than an earlier
        // interrupted migration. Never remove the source before commit/readback.
        await database.put(key, value);
        if (await database.get(key) !== value) throw new Error('Saved roster could not be verified. Your original data is unchanged.');
        cache.set(key, value);
        if (storage.getItem(key) === value) storage.removeItem(key);
      }
    },
    getItem(key) { return isRosterKey(key) ? (cache.get(key) ?? storage.getItem(key)) : storage.getItem(key); },
    setItem(key, value) {
      if (!isRosterKey(key)) return storage.setItem(key, value);
      cache.set(key, value);
      enqueue(() => database.put(key, value));
    },
    async flush() { await pending; if (lastError) throw lastError; },
    hasUnsavedChanges() { return queued > 0 || lastError != null; },
  };
}

export function openRosterDatabase(factory = indexedDB) {
  return new Promise((resolve, reject) => {
    const request = factory.open('svs_rosters_v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('rosters');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Intel app tabs, then retry opening saved data.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const transaction = (mode, work) => new Promise((done, fail) => {
        let result;
        const tx = db.transaction('rosters', mode);
        tx.oncomplete = () => done(result);
        tx.onabort = () => fail(tx.error || new Error('Roster save was interrupted.'));
        tx.onerror = () => {}; // onabort reports the transaction failure
        work(tx.objectStore('rosters'), value => { result = value; });
      });
      resolve({
        entries: () => transaction('readonly', (store, set) => {
          const entries = [];
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const row = cursor.result;
            if (row) { entries.push([row.key, row.value]); row.continue(); }
            else set(entries);
          };
        }),
        get: key => transaction('readonly', (store, set) => { const r = store.get(key); r.onsuccess = () => set(r.result); }),
        put: (key, value) => transaction('readwrite', store => { store.put(value, key); }),
      });
    };
  });
}

let rosterStorage;
export async function initializeRosterStorage() {
  const database = await openRosterDatabase();
  const next = createRosterStorage(localStorage, database, () => {
    window.dispatchEvent(new CustomEvent('app:storage-full'));
  });
  await next.initialize();
  rosterStorage = next;
}
// Reloads triggered by state switching run after flush. For other navigation,
// request the browser's normal leave-page warning while a save is outstanding.
if (typeof window !== 'undefined') window.addEventListener('beforeunload', event => {
  if (rosterStorage?.hasUnsavedChanges()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
export const appStorage = {
  getItem: key => (rosterStorage || localStorage).getItem(key),
  setItem: (key, value) => (rosterStorage || localStorage).setItem(key, value),
};
export async function flushRosterStorage() { await rosterStorage?.flush(); }
