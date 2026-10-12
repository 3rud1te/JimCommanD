const DB_NAME = "jimcommand-captures";
const STORE = "captures";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class CaptureStore {
  async put(kind, hardwareSlot, file, metadata = {}) {
    const db = await openDB();
    const record = { key: `${kind}:${hardwareSlot}`, kind, hardwareSlot, name: file.name, type: file.type, size: file.size, modified: file.lastModified, blob: file, ...metadata, savedAt: Date.now() };
    try { await transaction(db, "readwrite", store => store.put(record)); }
    finally { db.close(); }
    return record;
  }

  async get(kind, hardwareSlot) {
    const db = await openDB();
    try { return await transaction(db, "readonly", store => store.get(`${kind}:${hardwareSlot}`)); }
    finally { db.close(); }
  }

  async inventory() {
    const db = await openDB();
    try { return await transaction(db, "readonly", store => store.getAll()); }
    finally { db.close(); }
  }
}

function transaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode); const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error || new Error("Capture storage failed"));
    tx.onabort = () => reject(tx.error || new Error("Capture storage was aborted"));
  });
}
