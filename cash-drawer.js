/* ============================================================
   KXS SARI-SARI STORE POS — cash-drawer.js
   Daily beginning cash, expected vs actual, difference
   ============================================================ */

const CashDrawer = (() => {

  function todayKey(d = new Date()) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  async function getForDate(dateKey) {
    const all = await DB.getAllByIndex("cash_drawer", "date", dateKey);
    return all && all.length ? all[0] : null;
  }

  async function getToday() {
    return await getForDate(todayKey());
  }

  async function openDrawer(beginningCash) {
    const key = todayKey();
    let rec = await getForDate(key);
    if (rec) {
      rec.beginning_cash = Number(beginningCash) || 0;
    } else {
      rec = { date: key, beginning_cash: Number(beginningCash) || 0, actual_cash: null, closed: false, created_at: new Date().toISOString() };
    }
    await DB.put("cash_drawer", rec);
    return { ok: true, message: "Cash drawer opened.", record: rec };
  }

  // Compute expected cash for a given date based on sales/utang payments/expenses/refunds
  async function computeExpected(dateKey) {
    const rec = await getForDate(dateKey);
    const beginning = rec ? rec.beginning_cash || 0 : 0;

    const sales = await DB.getAll("sales");
    const daySales = sales.filter(s => s.date.slice(0, 10) === dateKey);
    const cashSales = daySales.filter(s => s.payment_type === "CASH").reduce((sum, s) => sum + s.total, 0);

    const ledger = await DB.getAll("utang_ledger");
    const dayPayments = ledger.filter(l => l.type === "PAYMENT" && l.date.slice(0, 10) === dateKey)
      .reduce((sum, l) => sum + l.amount, 0);

    const expenses = await DB.getAll("expenses");
    const dayExpenses = expenses.filter(e => e.date.slice(0, 10) === dateKey).reduce((sum, e) => sum + e.amount, 0);

    const returns = await DB.getAll("returns");
    const dayRefunds = returns.filter(r => r.date.slice(0, 10) === dateKey).reduce((sum, r) => sum + (r.refund_amount || 0), 0);

    const expected = beginning + cashSales + dayPayments - dayExpenses - dayRefunds;
    return { beginning, cashSales, dayPayments, dayExpenses, dayRefunds, expected };
  }

  async function closeDrawer(dateKey, actualCash) {
    let rec = await getForDate(dateKey);
    const calc = await computeExpected(dateKey);
    if (!rec) {
      rec = { date: dateKey, beginning_cash: 0, created_at: new Date().toISOString() };
    }
    rec.actual_cash = Number(actualCash) || 0;
    rec.expected_cash = calc.expected;
    rec.difference = rec.actual_cash - calc.expected;
    rec.closed = true;
    rec.closed_at = new Date().toISOString();
    await DB.put("cash_drawer", rec);
    return { ok: true, message: "Cash drawer closed.", record: rec, breakdown: calc };
  }

  async function history() {
    const all = await DB.getAll("cash_drawer");
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }

  return { todayKey, getForDate, getToday, openDrawer, computeExpected, closeDrawer, history };
})();
