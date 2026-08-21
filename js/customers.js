/* ============================================================
   KXS SARI-SARI STORE POS — customers.js
   Customer management + Utang (credit) ledger
   ============================================================ */

const Customers = (() => {

  async function getAll() {
    return await DB.getAll("customers");
  }

  async function get(id) {
    return await DB.get("customers", id);
  }

  async function search(term) {
    const all = await getAll();
    if (!term) return all;
    const t = term.trim().toLowerCase();
    return all.filter(c => (c.name || "").toLowerCase().includes(t) || (c.contact || "").includes(t));
  }

  async function save(customer) {
    const c = { ...customer };
    if (!c.name || !c.name.trim()) return { ok: false, message: "Customer name is required." };
    c.name = c.name.trim();
    c.balance = c.balance !== undefined ? Number(c.balance) : 0;
    c.updated_at = new Date().toISOString();
    if (!c.id) {
      c.created_at = new Date().toISOString();
      const id = await DB.add("customers", c);
      c.id = id;
      return { ok: true, message: "Customer saved.", customer: c };
    } else {
      await DB.put("customers", c);
      return { ok: true, message: "Customer updated.", customer: c };
    }
  }

  async function remove(id) {
    const ledger = await DB.getAllByIndex("utang_ledger", "customer_id", id);
    if (ledger.length) {
      return { ok: false, message: "Cannot delete a customer with utang history." };
    }
    await DB.del("customers", id);
    return { ok: true, message: "Customer deleted." };
  }

  // Record a credit sale against a customer (increases balance)
  async function recordCredit(customerId, amount, txnNumber, notes = "") {
    const c = await get(customerId);
    if (!c) return { ok: false, message: "Customer not found." };
    c.balance = (c.balance || 0) + amount;
    await DB.put("customers", c);
    await DB.add("utang_ledger", {
      customer_id: customerId,
      type: "CREDIT",
      amount,
      txn_number: txnNumber || "",
      balance_after: c.balance,
      date: new Date().toISOString(),
      notes
    });
    return { ok: true, message: "Credit recorded.", balance: c.balance };
  }

  // Record a payment toward utang (decreases balance, allows partial)
  async function recordPayment(customerId, amount, notes = "") {
    const c = await get(customerId);
    if (!c) return { ok: false, message: "Customer not found." };
    if (amount <= 0) return { ok: false, message: "Payment amount must be greater than zero." };
    const applied = Math.min(amount, c.balance || 0);
    c.balance = Math.max(0, (c.balance || 0) - amount);
    await DB.put("customers", c);
    await DB.add("utang_ledger", {
      customer_id: customerId,
      type: "PAYMENT",
      amount,
      applied,
      balance_after: c.balance,
      date: new Date().toISOString(),
      notes
    });
    return { ok: true, message: "Payment recorded.", balance: c.balance };
  }

  async function ledgerFor(customerId) {
    const rows = await DB.getAllByIndex("utang_ledger", "customer_id", customerId);
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function totalOutstanding() {
    const all = await getAll();
    return all.reduce((sum, c) => sum + (c.balance || 0), 0);
  }

  return { getAll, get, search, save, remove, recordCredit, recordPayment, ledgerFor, totalOutstanding };
})();
