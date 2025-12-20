-- Create a custom type for transaction status to ensure data integrity
CREATE TYPE transaction_status AS ENUM ('pending', 'cleared', 'failed');

-- Create the data_providers table to store information about each provider (e.g., SISS, Plaid)
CREATE TABLE IF NOT EXISTS data_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE, -- e.g., 'SISS', 'Plaid'
    slug VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'siss', 'plaid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create the provider_connections table to store the credentials/tokens for each linked provider
CREATE TABLE IF NOT EXISTS provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES data_providers(id) ON DELETE CASCADE,
    -- In a multi-user system, this would also have a user_id
    -- For SISS, we will store the API key and customer ID here, encrypted.
    -- For now, we will store them as plain text for simplicity in development.
    -- IMPORTANT: In production, these values MUST be encrypted.
    api_key TEXT NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

-- Create the accounts table to store different financial accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Link to the provider connection this account belongs to
    connection_id UUID REFERENCES provider_connections(id) ON DELETE SET NULL,
    -- The unique ID for this account from the provider (e.g., from SISS or Plaid)
    provider_account_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- e.g., 'checking', 'savings', 'credit'
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    include_in_budget BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create the categories table for classifying transactions (unchanged)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, parent_id),
    CONSTRAINT fk_parent_category
        FOREIGN KEY(parent_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
);

-- Create the transactions table, which is the core of the application
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    -- The unique ID for this transaction from the provider (e.g., from SISS or Plaid)
    provider_transaction_id VARCHAR(255) UNIQUE,
    date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create the budgets table to store monthly allocations per category (unchanged)
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, month)
);

-- Create indexes for frequently queried columns for performance
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_accounts_provider_id ON accounts(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
