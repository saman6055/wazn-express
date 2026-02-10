// Shared helper functions (no DB connection)

export function generateAccountNumber(customerCode: string): string {
  const year = new Date().getFullYear();
  return `ACC-${customerCode}-${year}`;
}

export function generateTransactionNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TXN-${date}-${random}`;
}

export function generatePaymentNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PAY-${date}-${random}`;
}
