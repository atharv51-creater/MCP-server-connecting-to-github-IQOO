function calculateDiscount(price, customerType) {
  let discount = 0;
  if (customerType === "premium") discount = 0.2;
  else if (customerType === "regular") discount = 0.1;
  else discount = 0;
  return price - (price * discount);
}

function formatCurrency(amount) {
  return "Rs. " + amount.toFixed(2);
}

function validateOrder(order) {
  if (!order.items || order.items.length === 0) {
    throw new Error("Order must have at least one item");
  }
  return true;
}

module.exports = { calculateDiscount, formatCurrency, validateOrder };
