import type { PersistedEntry, Store } from './contracts/storage.js';

/** Adapt synchronous Web Storage to the async cache-store contract. */
function webStore<Value>(storage: Storage, prefix: string): Store<Value> {
  return {
    async get(key) {
      const value = storage.getItem(prefix + key);
      return value == null ? undefined : (JSON.parse(value) as Value);
    },
    async set(key, value) {
      storage.setItem(prefix + key, JSON.stringify(value));
    },
    async remove(key) {
      storage.removeItem(prefix + key);
    },
  };
}
/** Persist across browser sessions; a prefix isolates an application's entries. */
export const localStore = <Value = PersistedEntry>(prefix = 'buildadiv:'): Store<Value> =>
  webStore(globalThis.localStorage, prefix);
/** Keep entries only for this browsing session while preserving the store interface. */
export const sessionStore = <Value = PersistedEntry>(prefix = 'buildadiv:'): Store<Value> =>
  webStore(globalThis.sessionStorage, prefix);

/** Larger caches use IndexedDB; operations resolve only after their transaction commits. */
export function indexedDbStore<Value = PersistedEntry>(
  name = 'buildadiv',
  storeName = 'cache',
): Store<Value> {
  let connection: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> =>
    (connection ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  /** Await commit rather than request success so failed writes are never reported as saved. */
  async function run<Result>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<Result>,
  ): Promise<Result> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  return {
    get: (key) => run<Value | undefined>('readonly', (store) => store.get(key)),
    set: async (key, value) => {
      await run('readwrite', (store) => store.put(value, key));
    },
    remove: (key) => run('readwrite', (store) => store.delete(key)),
  };
}
