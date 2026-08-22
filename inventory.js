/* ============================================================
   KXS SARI-SARI STORE POS — inventory.js
   Stock-In (receiving from suppliers) + Stock Adjustment
   (damaged / expired / missing / correction) + inventory log.
   Actual qty math is handled by Products.adjustStock so the
   "products" store and "inventory_log" store always agree.
   ============================================================ */

const ADJUSTMENT_REASONS = ["Damaged", "Expired", "Missing", "Spoiled", "Wrong Count", "Correction", "Other"];

const Inventory = (() => {

  // entry: {product_code, qty, cost_price, supplier, date, reference, notes}
  async function stockIn(entry) {
    const code = (entry.product_code || "").trim();
    if (!code) return { ok: false, message: "Please select a product." };
    const qty = Number(entry.qty);
    if (isNaN(qty) || qty <= 0) return { ok: false, message: "Stock-in quantity must be a valid positive number." };

    const product = await Products.getProduct(code);
    if (!product) return { ok: false, message: "Product not found." };

    const result = await Products.adjustStock(code, qty, {
      type: "STOCK_IN",
      supplier: entry.supplier || "",
      reference: entry.reference || "",
      cost_price: entry.cost_price !== undefined && entry.cost_price !== "" ? Number(entry.cost_price) : null,
      notes: entry.notes || ""
    });
    if (!result.ok) return result;

    // Optionally update the product's cost price to the latest received cost
    if (entry.cost_price !== undefined && entry.cost_price !== "" && !isNaN(Number(entry.cost_price))) {
      const p = await Products.getProduct(code);
      p.cost_price = Number(entry.cost_price);
      await DB.put("products", p);
    }

    await DB.add("stockins", {
      product_code: code,
      product_name: product.product_name,
      qty,
      cost_price: entry.cost_price !== undefined && entry.cost_price !== "" ? Number(entry.cost_price) : product.cost_price,
      supplier: entry.supplier || "",
      reference: entry.reference || "",
      notes: entry.notes || "",
      date: entry.date || new Date().toISOString(),
      new_qty: result.newQty
    });

    return { ok: true, message: `Stock-in recorded. New stock: ${result.newQty} ${product.unit}.`, newQty: result.newQty };
  }

  async function stockInHistory() {
    const all = await DB.getAll("stockins");
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // entry: {product_code, new_qty, reason, notes}
  async function adjustStock(entry) {
    const code = (entry.product_code || "").trim();
    if (!code) return { ok: false, message: "Please select a product." };
    const product = await Products.getProduct(code);
    if (!product) return { ok: false, message: "Product not found." };

    const newQty = Number(entry.new_qty);
    if (isNaN(newQty) || newQty < 0) return { ok: false, message: "New quantity must be a valid number." };
    if (!entry.reason) return { ok: false, message: "Please select a reason for the adjustment." };

    const previousQty = product.qty || 0;
    const delta = newQty - previousQty;

    const result = await Products.adjustStock(code, delta, {
      type: "ADJUSTMENT",
      reason: entry.reason,
      notes: entry.notes || "",
      allowNegative: false
    });
    if (!result.ok) return result;

    await DB.add("adjustments", {
      product_code: code,
      product_name: product.product_name,
      previous_qty: previousQty,
      adjustment: delta,
      new_qty: newQty,
      reason: entry.reason,
      notes: entry.notes || "",
      date: new Date().toISOString()
    });

    return { ok: true, message: "Stock adjustment saved.", newQty };
  }

  async function adjustmentHistory() {
    const all = await DB.getAll("adjustments");
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function logFor(productCode) {
    const all = await DB.getAllByIndex("inventory_log", "product_code", productCode);
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return { stockIn, stockInHistory, adjustStock, adjustmentHistory, logFor, ADJUSTMENT_REASONS };
})();
