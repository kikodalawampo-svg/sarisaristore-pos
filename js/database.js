/* ============================================================
   KXS SARI-SARI STORE POS — database.js
   IndexedDB wrapper. All other modules read/write through DB.*
   ============================================================ */

const DB_NAME = "kxs_sarisari_pos";
const DB_VERSION = 1;

const STORES = {
  products: "product_code",
  inventory_log: "++id", // stock-in / adjustment history
  sales: "++id",
  sale_items: "++id",
  returns: "++id",
  customers: "++id",
  utang_ledger: "++id",
  suppliers: "++id",
  expenses: "++id",
  cash_drawer: "++id",
  categories: "name",
  settings: "key",
  license: "key",
  counters: "key"
};

const DB = (() => {
  let dbInstance = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains("products")) {
          const s = db.createObjectStore("products", { keyPath: "product_code" });
          s.createIndex("barcode", "barcode", { unique: false });
          s.createIndex("name", "product_name", { unique: false });
          s.createIndex("category", "category", { unique: false });
          s.createIndex("supplier", "supplier", { unique: false });
        }

        if (!db.objectStoreNames.contains("inventory_log")) {
          const s = db.createObjectStore("inventory_log", { keyPath: "id", autoIncrement: true });
          s.createIndex("product_code", "product_code", { unique: false });
          s.createIndex("date", "date", { unique: false });
          s.createIndex("type", "type", { unique: false });
        }

        if (!db.objectStoreNames.contains("sales")) {
          const s = db.createObjectStore("sales", { keyPath: "id", autoIncrement: true });
          s.createIndex("txn_number", "txn_number", { unique: true });
          s.createIndex("date", "date", { unique: false });
          s.createIndex("payment_type", "payment_type", { unique: false });
          s.createIndex("customer_id", "customer_id", { unique: false });
        }

        if (!db.objectStoreNames.contains("sale_items")) {
          const s = db.createObjectStore("sale_items", { keyPath: "id", autoIncrement: true });
          s.createIndex("sale_id", "sale_id", { unique: false });
          s.createIndex("product_code", "product_code", { unique: false });
        }

        if (!db.objectStoreNames.contains("returns")) {
          const s = db.createObjectStore("returns", { keyPath: "id", autoIncrement: true });
          s.createIndex("sale_id", "sale_id", { unique: false });
          s.createIndex("date", "date", { unique: false });
        }

        if (!db.objectStoreNames.contains("customers")) {
          const s = db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
          s.createIndex("name", "name", { unique: false });
        }

        if (!db.objectStoreNames.contains("utang_ledger")) {
          const s = db.createObjectStore("utang_ledger", { keyPath: "id", autoIncrement: true });
          s.createIndex("customer_id", "customer_id", { unique: false });
          s.createIndex("date", "date", { unique: false });
        }

        if (!db.objectStoreNames.contains("suppliers")) {
          const s = db.createObjectStore("suppliers", { keyPath: "id", autoIncrement: true });
          s.createIndex("name", "name", { unique: false });
        }

        if (!db.objectStoreNames.contains("expenses")) {
          const s = db.createObjectStore("expenses", { keyPath: "id", autoIncrement: true });
          s.createIndex("date", "date", { unique: false });
          s.createIndex("category", "category", { unique: false });
        }

        if (!db.objectStoreNames.contains("cash_drawer")) {
          const s = db.createObjectStore("cash_drawer", { keyPath: "id", autoIncrement: true });
          s.createIndex("date", "date", { unique: true });
        }

        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "name" });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("license")) {
          db.createObjectStore("license", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("counters")) {
          db.createObjectStore("counters", { keyPath: "key" });
        }
      };

      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function tx(storeName, mode = "readonly") {
    const db = await open();
    const t = db.transaction(storeName, mode);
    return t.objectStore(storeName);
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, value) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.put(value));
  }

  async function add(storeName, value) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.add(value));
  }

  async function get(storeName, key) {
    const store = await tx(storeName, "readonly");
    return reqToPromise(store.get(key));
  }

  async function del(storeName, key) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.delete(key));
  }

  async function getAll(storeName) {
    const store = await tx(storeName, "readonly");
    return reqToPromise(store.getAll());
  }

  async function getAllByIndex(storeName, indexName, value) {
    const store = await tx(storeName, "readonly");
    const idx = store.index(indexName);
    return reqToPromise(idx.getAll(value));
  }

  async function clear(storeName) {
    const store = await tx(storeName, "readwrite");
    return reqToPromise(store.clear());
  }

  async function count(storeName) {
    const store = await tx(storeName, "readonly");
    return reqToPromise(store.count());
  }

  async function nextCounter(key, pad = 3, prefix = "") {
    const db = await open();
    const t = db.transaction("counters", "readwrite");
    const store = t.objectStore("counters");
    const rec = await reqToPromise(store.get(key));
    const next = (rec ? rec.value : 0) + 1;
    await reqToPromise(store.put({ key, value: next }));
    return prefix + String(next).padStart(pad, "0");
  }

  async function wipeAllData() {
    const names = Object.keys(STORES).filter(n => n !== "license");
    for (const n of names) {
      await clear(n);
    }
  }

  async function exportAll() {
    const dump = {};
    for (const name of Object.keys(STORES)) {
      dump[name] = await getAll(name);
    }
    dump._meta = { app: "kxs_sarisari_pos", version: DB_VERSION, exported_at: new Date().toISOString() };
    return dump;
  }

  async function importAll(dump, mode = "replace") {
    const db = await open();
    const names = Object.keys(STORES).filter(n => dump[n]);
    if (mode === "replace") {
      for (const n of names) await clear(n);
    }
    for (const n of names) {
      const t = db.transaction(n, "readwrite");
      const store = t.objectStore(n);
      for (const row of dump[n]) {
        store.put(row);
      }
      await new Promise((res, rej) => {
        t.oncomplete = res;
        t.onerror = () => rej(t.error);
      });
    }
  }

  return {
    open, put, add, get, del, getAll, getAllByIndex, clear, count,
    nextCounter, wipeAllData, exportAll, importAll
  };
})();
