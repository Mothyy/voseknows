-- Add Scrapers table to list available scripts
CREATE TABLE IF NOT EXISTS scrapers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE, -- e.g. 'anz', 'bom'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automated connections for bank scraping
CREATE TABLE IF NOT EXISTS automated_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scraper_id UUID NOT NULL REFERENCES scrapers(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- Target account for this connection
    name VARCHAR(255) NOT NULL, -- User friendly name e.g. "ANZ Savings"
    
    -- Encrypted credentials
    encrypted_username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    encrypted_metadata JSONB, -- For extra fields like secret answers
    
    status VARCHAR(50) DEFAULT 'idle', -- 'idle', 'running', 'error'
    last_run_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scraping Scheduless
CREATE TABLE IF NOT EXISTS scraping_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES automated_connections(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'manual'
    is_active BOOLEAN DEFAULT true,
    next_run_at TIMESTAMPTZ,
    last_successful_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial scrapers based on ActualAutomation
INSERT INTO scrapers (name, slug, description)
VALUES 
    ('ANZ Bank', 'anz', 'Scrapes ANZ Internet Banking for transactions'),
    ('Bank of Melbourne', 'bom', 'Scrapes Bank of Melbourne for transactions')
ON CONFLICT (slug) DO NOTHING;
