/* ============================================================
   KXS SARI-SARI STORE POS — sales.js
   Completed sale persistence + history + receipts
   ============================================================ */

const Sales = (() => {

  async function nextTxnNumber() {
    return await DB.nextCounter("txn", 6, "TXN-");
  }

  // cart: [{product_code, product_name, unit, qty, price, subtotal}]
  // payment: {type: 'CASH'|'UTANG', cash_received, customer_id}
  async function completeSale(cart, payment) {
    if (!cart || !cart.length) return { ok: false, message: "Cart is empty." };

    // validate stock first
    for (const item of cart) {
      const p = await Products.getProduct(item.product_code);
      if (!p) return { ok: false, message: `Product ${item.product_code} no longer exists.` };
      if (p.qty < item.qty) return { ok: false, message: `Insufficient stock for ${p.product_name}. Available: ${p.qty}.` };
    }

    const total = cart.reduce((s, i) => s + i.subtotal, 0);

    if (payment.type === "CASH") {
      const cashReceived = Number(payment.cash_received) || 0;
      if (cashReceived < total) {
        return { ok: false, message: "Cash received is insufficient." };
      }
    }
    if (payment.type === "UTANG" && !payment.customer_id) {
      return { ok: false, message: "Please select a customer for utang/credit sales." };
    }

    const txnNumber = await nextTxnNumber();
    const now = new Date().toISOString();

    const sale = {
      txn_number: txnNumber,
      date: now,
      total,
      payment_type: payment.type,
      cash_received: payment.type === "CASH" ? Number(payment.cash_received) || 0 : null,
      change: payment.type === "CASH" ? (Number(payment.cash_received) || 0) - total : null,
      customer_id: payment.customer_id || null,
      pricing_mode: payment.pricing_mode || "RETAIL"
    };

    const saleId = await DB.add("sales", sale);
    sale.id = saleId;

    for (const item of cart) {
      await DB.add("sale_items", {
        sale_id: saleId,
        product_code: item.product_code,
        product_name: item.product_name,
        unit: item.unit,
        qty: item.qty,
        price: item.price,
        subtotal: item.subtotal
      });
      await Products.adjustStock(item.product_code, -item.qty, { type: "SALE", reference: txnNumber });
    }

    if (payment.type === "UTANG") {
      await Customers.recordCredit(payment.customer_id, total, txnNumber);
    }

    return { ok: true, message: "Sale completed.", sale, items: cart };
  }

  async function getSale(id) {
    return await DB.get("sales", id);
  }

  async function getSaleItems(saleId) {
    return await DB.getAllByIndex("sale_items", "sale_id", saleId);
  }

  async function findByTxnNumber(txn) {
    const all = await DB.getAllByIndex("sales", "txn_number", txn);
    return all && all.length ? all[0] : null;
  }

  async function history(filters = {}) {
    let all = await DB.getAll("sales");
    if (filters.startDate) all = all.filter(s => s.date >= filters.startDate);
    if (filters.endDate) all = all.filter(s => s.date <= filters.endDate);
    if (filters.paymentType) all = all.filter(s => s.payment_type === filters.paymentType);
    if (filters.term) {
      const t = filters.term.toLowerCase();
      all = all.filter(s => s.txn_number.toLowerCase().includes(t));
    }
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function todaysSales() {
    const key = CashDrawer.todayKey();
    const all = await DB.getAll("sales");
    return all.filter(s => s.date.slice(0, 10) === key);
  }

  return { completeSale, getSale, getSaleItems, findByTxnNumber, history, todaysSales, nextTxnNumber };
})();
