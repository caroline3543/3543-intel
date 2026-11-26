const databaseName = '3573-screenshot-import';

async function sessionTransaction(mode, operation) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sessions');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('sessions', mode);
      const request = operation(transaction.objectStore('sessions'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export const readScreenshotSession = key => sessionTransaction('readonly', store => store.get(key));
export const writeScreenshotSession = (key, value) => sessionTransaction('readwrite', store =>
  value ? store.put(value, key) : store.delete(key)
);
