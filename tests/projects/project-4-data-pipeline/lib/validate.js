function validate(record, tableName) {
  const errors = [];

  if (tableName === 'transactions') {
    if (!record.amount || isNaN(parseFloat(record.amount))) {
      errors.push('Invalid amount');
    }
    if (!record.date) {
      errors.push('Missing date');
    }
  }

  if (tableName === 'products') {
    if (!record.name) errors.push('Missing name');
    if (!record.price || parseFloat(record.price) < 0) {
      errors.push('Invalid price');
    }
  }

  if (tableName === 'users') {
    if (!record.email) errors.push('Missing email');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validate };
