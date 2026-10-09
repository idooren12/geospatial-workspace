/** A tiny promise wrapper around one IndexedDB object store of documents keyed by name. */
export interface DocStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
}

export const DB_NAME = 'gws';
const DB_VERSION = 1;
const STORE = 'docs';

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Opens (or creates) the database. Rejects when IndexedDB is missing or blocked. */
export function openDocStore(factory: IDBFactory | undefined = globalThis.indexedDB, timeoutMs = 3000): Promise<DocStore> {
  if (!factory) return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IndexedDB open timed out')), timeoutMs);
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch (e) {
      clearTimeout(timer);
      reject(e as Error);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
  }).then((db) => ({
    get: (key) => done(db.transaction(STORE, 'readonly').objectStore(STORE).get(key)),
    put: (key, value) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      }),
  }));
}
