/* ============================================================
   KXS SARI-SARI STORE POS — suppliers.js
   ============================================================ */

const Suppliers = (() => {

  async function getAll() {
    return await DB.getAll("suppliers");
  }

  async function get(id) {
    return await DB.get("suppliers", id);
  }

  async function save(supplier) {
    const s = { ...supplier };
    if (!s.name || !s.name.trim()) return { ok: false, message: "Supplier name is required." };
    s.name = s.name.trim();
    s.updated_at = new Date().toISOString();
    if (!s.id) {
      s.created_at = new Date().toISOString();
      const id = await DB.add("suppliers", s);
      s.id = id;
      return { ok: true, message: "Supplier saved.", supplier: s };
    } else {
      await DB.put("suppliers", s);
      return { ok: true, message: "Supplier updated.", supplier: s };
    }
  }

  async function remove(id) {
    await DB.del("suppliers", id);
    return { ok: true, message: "Supplier deleted." };
  }

  async function productsFor(supplierName) {
    const all = await DB.getAll("products");
    return all.filter(p => p.supplier === supplierName);
  }

  async function stockInHistoryFor(supplierName) {
    const all = await DB.getAllByIndex("inventory_log", "type", "STOCK_IN");
    return all.filter(r => r.supplier === supplierName).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return { getAll, get, save, remove, productsFor, stockInHistoryFor };
})();
