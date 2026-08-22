/* ============================================================
   KXS SARI-SARI STORE POS — expenses.js
   ============================================================ */

const EXPENSE_CATEGORIES = ["Electricity", "Delivery", "Transportation", "Store Supplies", "Rent", "Water", "Miscellaneous", "Other"];

const Expenses = (() => {

  async function getAll() {
    const all = await DB.getAll("expenses");
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function save(expense) {
    const e = { ...expense };
    if (!e.name || !e.name.trim()) return { ok: false, message: "Expense name is required." };
    const amount = Number(e.amount);
    if (isNaN(amount) || amount <= 0) return { ok: false, message: "Expense amount must be a valid positive number." };
    e.name = e.name.trim();
    e.amount = amount;
    e.category = e.category || "Miscellaneous";
    e.date = e.date || new Date().toISOString();
    e.notes = e.notes || "";
    if (!e.id) {
      const id = await DB.add("expenses", e);
      e.id = id;
      return { ok: true, message: "Expense recorded.", expense: e };
    } else {
      await DB.put("expenses", e);
      return { ok: true, message: "Expense updated.", expense: e };
    }
  }

  async function remove(id) {
    await DB.del("expenses", id);
    return { ok: true, message: "Expense deleted." };
  }

  async function totalForRange(startDate, endDate) {
    const all = await getAll();
    return all.filter(e => inRange(e.date, startDate, endDate)).reduce((s, e) => s + e.amount, 0);
  }

  function inRange(dateStr, start, end) {
    const d = new Date(dateStr).getTime();
    return d >= new Date(start).getTime() && d <= new Date(end).getTime();
  }

  return { getAll, save, remove, totalForRange, EXPENSE_CATEGORIES };
})();
