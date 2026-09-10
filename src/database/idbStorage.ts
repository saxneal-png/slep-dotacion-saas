/**
 * Almacenamiento binario persistente en IndexedDB para la base de datos SQLite WASM.
 * Soporta almacenamiento de hasta cientos de megabytes sin el límite de 5MB de localStorage
 * y sin el costo de serializar Uint8Array a cadenas JSON.
 */

const DB_NAME = 'slep_valle_diguillin_idb';
const STORE_NAME = 'sqlite_storage';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB no está disponible en este entorno'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getIdbBytes(key: string): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
        } else if (val instanceof Uint8Array) {
          resolve(val);
        } else if (val instanceof ArrayBuffer) {
          resolve(new Uint8Array(val));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error al leer de IndexedDB:', err);
    return null;
  }
}

export async function setIdbBytes(key: string, data: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(data, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteIdbBytes(key: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
