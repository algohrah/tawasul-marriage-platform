const DATABASE_NAME = 'tawasul-local-development';
const DATABASE_VERSION = 1;
const STORE_NAME = 'localStorageMirror';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function hydrateLocalStorage(db: IDBDatabase) {
  const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
  const keys = await requestResult(store.getAllKeys());
  const values = await requestResult(store.getAll());
  keys.forEach((key, index) => {
    if (typeof key === 'string' && typeof values[index] === 'string') localStorage.setItem(key, values[index] as string);
  });
}

async function migrateCurrentLocalStorage(db: IDBDatabase) {
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    const value = localStorage.getItem(key);
    if (value !== null) store.put(value, key);
  }
}

function installWriteThroughMirror(db: IDBDatabase) {
  const prototype = Storage.prototype;
  const originalSetItem = prototype.setItem;
  const originalRemoveItem = prototype.removeItem;
  const originalClear = prototype.clear;

  prototype.setItem = function setItem(key: string, value: string) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage) db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(String(value), String(key));
  };
  prototype.removeItem = function removeItem(key: string) {
    originalRemoveItem.call(this, key);
    if (this === window.localStorage) db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(String(key));
  };
  prototype.clear = function clear() {
    originalClear.call(this);
    if (this === window.localStorage) db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
  };
}

export async function initializeIndexedDbPersistence() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const db = await openDatabase();
    await hydrateLocalStorage(db);
    await migrateCurrentLocalStorage(db);
    installWriteThroughMirror(db);
    console.info('[Storage] IndexedDB local development database is ready.');
  } catch (error) {
    console.warn('[Storage] IndexedDB unavailable; continuing with localStorage.', error);
  }
}
