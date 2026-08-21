/* ============================================================
   KXS SARI-SARI STORE POS — products.js
   Manual product encoding. Barcode is ALWAYS optional.
   ============================================================ */

const UNITS = ["PCS", "PIECE", "SACHET", "BOTTLE", "CAN", "PACK", "BOX", "BUNDLE", "KILO", "GRAM", "LITER", "OTHER"];
const DEFAULT_CATEGORIES = ["Beverages", "Snacks", "Canned Goods", "Noodles", "Coffee", "Personal Care", "Household", "School Supplies", "Frozen", "Rice", "Other"];

const Products = (() => {

  async function ensureDefaultCategories() {
    const existing = await DB.getAll("categories");
    if (existing.length) return;
    for (const name of DEFAULT_CATEGORIES) {
      await DB.put("categories", { name });
    }
  }

  async function generateProductCode() {
    return await DB.nextCounter("product_code", 3, "P");
  }

  async function getAllProducts() {
    return await DB.getAll("products");
  }

  async function getProduct(code) {
    return await DB.get("products", code);
  }

  async function findByBarcode(barcode) {
    if (!barcode) return null;
    const rows = await DB.getAllByIndex("products", "barcode", barcode);
    return rows && rows.length ? rows[0] : null;
  }

  async function searchProducts(term) {
    const all = await getAllProducts();
    if (!term) return all;
    const t = term.trim().toLowerCase();
    return all.filter(p =>
      (p.product_code || "").toLowerCase().includes(t) ||
      (p.product_name || "").toLowerCase().includes(t) ||
      (p.barcode || "").toLowerCase().includes(t) ||
      (p.category || "").toLowerCase().includes(t) ||
      (p.supplier || "").toLowerCase().includes(t)
    );
  }

  function validateProduct(p, existing) {
    const errors = [];
    if (!p.product_code || !p.product_code.trim()) errors.push("Product Code is required.");
    if (!p.product_name || !p.product_name.trim()) errors.push("Product Name is required.");
    if (!p.unit) errors.push("Unit is required.");
    const qty = Number(p.qty);
    if (isNaN(qty) || qty < 0) errors.push("Quantity / Stock must be a valid number.");
    const price = Number(p.selling_price);
    if (isNaN(price) || price < 0) errors.push("Selling Price must be a valid number (Invalid price).");
    if (p.cost_price !== undefined && p.cost_price !== "" && isNaN(Number(p.cost_price))) {
      errors.push("Cost Price must be a valid number.");
    }
    if (p.barcode) {
      // barcode optional, but if present must not collide with a DIFFERENT product
    }
    return errors;
  }

  // Returns {ok, message} — does NOT throw, per "simple messages" requirement
  async function saveProduct(product, isEdit = false) {
    const p = { ...product };
    p.product_code = (p.product_code || "").trim();
    p.product_name = (p.product_name || "").trim();
    p.barcode = (p.barcode || "").trim() || null;

    const errors = validateProduct(p);
    if (errors.length) return { ok: false, message: errors[0] };

    const existing = await getProduct(p.product_code);
    if (existing && !isEdit) {
      return { ok: false, message: "Product Code already exists. Please use another code." };
    }

    if (p.barcode) {
      const byBarcode = await findByBarcode(p.barcode);
      if (byBarcode && byBarcode.product_code !== p.product_code) {
        return { ok: false, message: "This barcode is already used by another product." };
      }
    }

    const record = {
      product_code: p.product_code,
      product_name: p.product_name,
      category: p.category || "Other",
      qty: Number(p.qty) || 0,
      unit: p.unit || "PCS",
      cost_price: p.cost_price !== undefined && p.cost_price !== "" ? Number(p.cost_price) : 0,
      selling_price: Number(p.selling_price) || 0,
      wholesale_price: p.wholesale_price !== undefined && p.wholesale_price !== "" ? Number(p.wholesale_price) : null,
      barcode: p.barcode,
      minimum_stock: p.minimum_stock !== undefined && p.minimum_stock !== "" ? Number(p.minimum_stock) : 5,
      supplier: p.supplier || "",
      notes: p.notes || "",
      created_at: existing ? existing.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await DB.put("products", record);
    return { ok: true, message: "Product saved.", product: record };
  }

  async function deleteProduct(code) {
    await DB.del("products", code);
    return { ok: true, message: "Product deleted." };
  }

  // Adjust stock by delta (positive = increase, negative = decrease)
  // Returns {ok, message, newQty}
  async function adjustStock(code, delta, opts = {}) {
    const p = await getProduct(code);
    if (!p) return { ok: false, message: "Product not found." };
    const newQty = (p.qty || 0) + delta;
    if (newQty < 0 && !opts.allowNegative) {
      return { ok: false, message: "Insufficient stock for " + p.product_name + "." };
    }
    p.qty = newQty;
    p.updated_at = new Date().toISOString();
    await DB.put("products", p);

    await DB.add("inventory_log", {
      product_code: code,
      product_name: p.product_name,
      type: opts.type || (delta >= 0 ? "STOCK_IN" : "SALE"),
      qty_change: delta,
      previous_qty: (p.qty - delta),
      new_qty: p.qty,
      reason: opts.reason || "",
      reference: opts.reference || "",
      supplier: opts.supplier || "",
      cost_price: opts.cost_price !== undefined ? opts.cost_price : null,
      date: new Date().toISOString(),
      notes: opts.notes || ""
    });

    return { ok: true, message: "Stock updated.", newQty };
  }

  function stockStatus(p) {
    if ((p.qty || 0) <= 0) return "OUT_OF_STOCK";
    if ((p.qty || 0) <= (p.minimum_stock || 0)) return "LOW_STOCK";
    return "OK";
  }

  async function lowStockProducts() {
    const all = await getAllProducts();
    return all.filter(p => stockStatus(p) === "LOW_STOCK");
  }

  async function outOfStockProducts() {
    const all = await getAllProducts();
    return all.filter(p => stockStatus(p) === "OUT_OF_STOCK");
  }

  // ---- CSV import/export ----
  function toCSV(rows, headers) {
    const esc = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map(h => esc(r[h])).join(","));
    }
    return lines.join("\n");
  }

  function parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return { headers: [], rows: [] };
    const headers = splitCSVLine(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      const vals = splitCSVLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => row[h.trim()] = (vals[idx] !== undefined ? vals[idx].trim() : ""));
      rows.push(row);
    }
    return { headers, rows };
  }

  function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else cur += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  async function exportProductsCSV() {
    const headers = ["Product Code", "Product Name", "Category", "Qty", "Unit", "Cost Price", "Selling Price", "Wholesale Price", "Barcode", "Minimum Stock", "Supplier"];
    const all = await getAllProducts();
    const mapped = all.map(p => ({
      "Product Code": p.product_code, "Product Name": p.product_name, "Category": p.category,
      "Qty": p.qty, "Unit": p.unit, "Cost Price": p.cost_price, "Selling Price": p.selling_price,
      "Wholesale Price": p.wholesale_price || "", "Barcode": p.barcode || "", "Minimum Stock": p.minimum_stock,
      "Supplier": p.supplier || ""
    }));
    return toCSV(mapped, headers);
  }

  // Validates + imports; returns summary {added, skipped, errors[]}
  async function importProductsCSV(text) {
    const { rows } = parseCSV(text);
    const summary = { added: 0, updated: 0, skipped: 0, errors: [] };
    const seenCodes = new Set();

    for (const [i, row] of rows.entries()) {
      const code = (row["Product Code"] || "").trim();
      const name = (row["Product Name"] || "").trim();
      if (!code || !name) {
        summary.errors.push(`Row ${i + 2}: missing Product Code or Product Name — skipped.`);
        summary.skipped++;
        continue;
      }
      if (seenCodes.has(code)) {
        summary.errors.push(`Row ${i + 2}: duplicate Product Code "${code}" in file — skipped.`);
        summary.skipped++;
        continue;
      }
      seenCodes.add(code);

      const existing = await getProduct(code);
      const result = await saveProduct({
        product_code: code,
        product_name: name,
        category: row["Category"] || "Other",
        qty: row["Qty"] || 0,
        unit: row["Unit"] || "PCS",
        cost_price: row["Cost Price"] || 0,
        selling_price: row["Selling Price"] || 0,
        wholesale_price: row["Wholesale Price"] || "",
        barcode: row["Barcode"] || "",
        minimum_stock: row["Minimum Stock"] || 5,
        supplier: row["Supplier"] || ""
      }, !!existing);

      if (result.ok) {
        existing ? summary.updated++ : summary.added++;
      } else {
        summary.errors.push(`Row ${i + 2} (${code}): ${result.message}`);
        summary.skipped++;
      }
    }
    return summary;
  }

  return {
    ensureDefaultCategories, generateProductCode, getAllProducts, getProduct, findByBarcode,
    searchProducts, saveProduct, deleteProduct, adjustStock, stockStatus,
    lowStockProducts, outOfStockProducts, exportProductsCSV, importProductsCSV,
    toCSV, parseCSV
  };
})();
