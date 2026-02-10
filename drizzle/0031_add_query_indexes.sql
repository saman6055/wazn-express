-- Indexes for frequently queried columns (packages, batches, ledger, customers, invoices)

-- packages
CREATE INDEX idx_packages_customer_id ON packages (customerId);
CREATE INDEX idx_packages_batch_id ON packages (batchId);
CREATE INDEX idx_packages_status ON packages (status);
CREATE INDEX idx_packages_tracking_number ON packages (trackingNumber);
CREATE INDEX idx_packages_created_at ON packages (createdAt);

-- batches
CREATE INDEX idx_batches_status ON batches (status);
CREATE INDEX idx_batches_shipping_type ON batches (shippingType);
CREATE INDEX idx_batches_created_at ON batches (createdAt);

-- ledgerTransactions
CREATE INDEX idx_ledger_account_id ON ledgerTransactions (accountId);
CREATE INDEX idx_ledger_created_at ON ledgerTransactions (createdAt);
CREATE INDEX idx_ledger_transaction_type ON ledgerTransactions (transactionType);
CREATE INDEX idx_ledger_account_created ON ledgerTransactions (accountId, createdAt);

-- customers (customerCode and mobileNumber may already have unique indexes; these support lookups)
CREATE INDEX idx_customers_customer_code ON customers (customerCode);
CREATE INDEX idx_customers_mobile_number ON customers (mobileNumber);

-- invoices
CREATE INDEX idx_invoices_customer_id ON invoices (customerId);
CREATE INDEX idx_invoices_batch_id ON invoices (batchId);
CREATE INDEX idx_invoices_created_at ON invoices (createdAt);
