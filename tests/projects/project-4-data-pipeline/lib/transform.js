function transform(record, tableName) {
  const result = { ...record };

  if (tableName === 'transactions') {
    result.amount = parseFloat(result.amount);
    result.tax = Math.round(result.amount * 0.1 * 100) / 100;
    result.total = result.amount + result.tax;
    if (result.date) {
      result.date = new Date(result.date).toISOString();
    }
    if (result.currency && result.currency !== 'USD') {
      const rates = { EUR: 1.1, GBP: 1.27, JPY: 0.0067 };
      result.amount_usd = result.amount * rates[result.currency];
    }
  }

  if (tableName === 'products') {
    result.price = parseFloat(result.price);
    result.name = result.name.trim().substring(0, 255);
    result.sku = result.sku?.toUpperCase();
  }

  if (tableName === 'users') {
    result.email = result.email?.toLowerCase().trim();
    result.created_at = result.created_at || new Date().toISOString();
  }

  return result;
}

module.exports = { transform };
