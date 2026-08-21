/* ============================================================
   KXS SARI-SARI STORE POS — pos.js
   Cart engine used by the POS screen in app.js
   ============================================================ */

const Cart = (() => {
  let items = []; // {product_code, product_name, unit, qty, price, subtotal, stock}
  let pricingMode = "RETAIL";

  function getItems() { return items; }

  function setPricingMode(mode) { pricingMode = mode; }
  function getPricingMode() { return pricingMode; }

  function priceFor(product) {
    if (pricingMode === "WHOLESALE" && product.wholesale_price) return product.wholesale_price;
    return product.selling_price;
  }

  // Returns {ok, message}
  function addProduct(product, qty = 1) {
    if (!product) return { ok: false, message: "Product not found." };
    if ((product.qty || 0) <= 0) return { ok: false, message: `${product.product_name} is out of stock.` };

    const existing = items.find(i => i.product_code === product.product_code);
    const currentQtyInCart = existing ? existing.qty : 0;
    if (currentQtyInCart + qty > product.qty) {
      return { ok: false, message: `Only ${product.qty} ${product.unit} of ${product.product_name} available.` };
    }

    const price = priceFor(product);
    if (existing) {
      existing.qty += qty;
      existing.subtotal = existing.qty * existing.price;
    } else {
      items.push({
        product_code: product.product_code,
        product_name: product.product_name,
        unit: product.unit,
        qty,
        price,
        subtotal: price * qty,
        stock: product.qty
      });
    }
    return { ok: true, message: "Added to cart." };
  }

  function updateQty(productCode, qty) {
    const item = items.find(i => i.product_code === productCode);
    if (!item) return { ok: false, message: "Item not in cart." };
    if (qty <= 0) {
      return removeItem(productCode);
    }
    if (qty > item.stock) {
      return { ok: false, message: `Only ${item.stock} ${item.unit} available.` };
    }
    item.qty = qty;
    item.subtotal = item.qty * item.price;
    return { ok: true, message: "Updated." };
  }

  function removeItem(productCode) {
    items = items.filter(i => i.product_code !== productCode);
    return { ok: true, message: "Item removed." };
  }

  function clear() {
    items = [];
  }

  function total() {
    return items.reduce((s, i) => s + i.subtotal, 0);
  }

  function count() {
    return items.reduce((s, i) => s + i.qty, 0);
  }

  return { getItems, addProduct, updateQty, removeItem, clear, total, count, setPricingMode, getPricingMode, priceFor };
})();
