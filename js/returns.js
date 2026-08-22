/* ============================================================
   KXS SARI-SARI STORE POS — returns.js
   Basic sales return / refund
   ============================================================ */

const Returns = (() => {

  // items: [{sale_item_id, product_code, product_name, qty, price}]
  async function processReturn(saleId, items, reason = "") {
    const sale = await Sales.getSale(saleId);
    if (!sale) return { ok: false, message: "Original transaction not found." };
    if (!items || !items.length) return { ok: false, message: "Select at least one item to return." };

    let refundAmount = 0;
    for (const item of items) {
      refundAmount += item.qty * item.price;
      if (!item.manual_entry) {
        await Products.adjustStock(item.product_code, item.qty, {
          type: "RETURN", reference: sale.txn_number, reason: reason || "Sales return"
        });
      }
    }

    const rec = {
      sale_id: saleId,
      txn_number: sale.txn_number,
      items,
      refund_amount: refundAmount,
      reason,
      date: new Date().toISOString()
    };
    const id = await DB.add("returns", rec);
    rec.id = id;

    return { ok: true, message: "Return processed.", record: rec };
  }

  async function history() {
    const all = await DB.getAll("returns");
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return { processReturn, history };
})();
