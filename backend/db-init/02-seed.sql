BEGIN;

-- Insert the SISS data provider if it doesn't exist.
INSERT INTO data_providers (name, slug)
VALUES ('SISS', 'siss')
ON CONFLICT (slug) DO NOTHING;

-- Use a DO block to ensure the main seeding logic only runs on a fresh database.
DO $$
DECLARE
    -- Provider and Connection UUIDs
    siss_provider_id UUID;
    siss_connection_id UUID;

    -- Account UUID
    account_id_checking UUID;

    -- Category UUIDs
    category_id_revenue UUID;
    category_id_groceries UUID;
    category_id_utilities UUID;
    category_id_transport UUID;
    category_id_dining UUID;
    category_id_uncategorized UUID;
    category_id_entertainment UUID;
    category_id_job1 UUID;
    category_id_salary UUID;
    category_id_reimbursed UUID;
BEGIN
    -- If there are any connections, we assume the database is already seeded.
    IF (SELECT COUNT(*) FROM provider_connections) > 0 THEN
        RAISE NOTICE 'Database already seeded. Skipping.';
        RETURN;
    END IF;

    RAISE NOTICE 'Database is empty. Seeding with test data...';

    -- Get the SISS provider ID.
    SELECT id INTO siss_provider_id FROM data_providers WHERE slug = 'siss';

    -- Insert a placeholder SISS connection and capture its ID.
    -- In a real app, these values would come from the user.
    INSERT INTO provider_connections (provider_id, api_key, customer_id, institution_name)
    VALUES (siss_provider_id, 'YOUR_SISS_API_KEY', 'YOUR_SISS_CUSTOMER_ID', 'Sample Bank')
    RETURNING id INTO siss_connection_id;

    -- Insert a manually created account not linked to any provider.
    INSERT INTO accounts (name, type, include_in_budget)
    VALUES ('Main Checking Account', 'checking', true)
    RETURNING id INTO account_id_checking;

    -- Insert categories (this part is unchanged)
    INSERT INTO categories (name, parent_id)
    VALUES
        ('Uncategorized', NULL), ('Groceries', NULL), ('Utilities', NULL),
        ('Transport', NULL), ('Dining', NULL), ('Entertainment', NULL),
        ('Revenue', NULL)
    ON CONFLICT (name, parent_id) DO NOTHING;

    -- Get top-level category IDs
    SELECT id INTO category_id_revenue FROM categories WHERE name = 'Revenue' AND parent_id IS NULL;
    SELECT id INTO category_id_groceries FROM categories WHERE name = 'Groceries' AND parent_id IS NULL;
    SELECT id INTO category_id_utilities FROM categories WHERE name = 'Utilities' AND parent_id IS NULL;
    SELECT id INTO category_id_transport FROM categories WHERE name = 'Transport' AND parent_id IS NULL;
    SELECT id INTO category_id_dining FROM categories WHERE name = 'Dining' AND parent_id IS NULL;
    SELECT id INTO category_id_uncategorized FROM categories WHERE name = 'Uncategorized' AND parent_id IS NULL;
    SELECT id INTO category_id_entertainment FROM categories WHERE name = 'Entertainment' AND parent_id IS NULL;

    -- Insert nested categories and get their IDs
    INSERT INTO categories (name, parent_id) VALUES ('Job 1', category_id_revenue) RETURNING id INTO category_id_job1;
    INSERT INTO categories (name, parent_id) VALUES ('Salary', category_id_job1) RETURNING id INTO category_id_salary;
    INSERT INTO categories (name, parent_id) VALUES ('Reimbursed Expenses', category_id_job1) RETURNING id INTO category_id_reimbursed;

    -- Insert sample transactions linked to the manually created checking account
    INSERT INTO transactions (account_id, category_id, date, description, amount, status)
    VALUES
        (account_id_checking, category_id_salary, '2024-07-25', 'Monthly Salary Deposit', 5000.00, 'cleared'),
        (account_id_checking, category_id_reimbursed, '2024-07-25', 'Internet Bill Reimbursement', 80.00, 'cleared'),
        (account_id_checking, category_id_groceries, '2024-07-26', 'Trader Joe''s', -85.42, 'cleared'),
        (account_id_checking, category_id_utilities, '2024-07-24', 'PG&E Electricity Bill', -120.75, 'cleared'),
        (account_id_checking, category_id_transport, '2024-07-22', 'Shell Gas Station', -45.50, 'cleared'),
        (account_id_checking, category_id_dining, '2024-07-21', 'Starbucks', -5.75, 'pending'),
        (account_id_checking, category_id_uncategorized, '2024-07-20', 'Amazon.com Purchase', -250.00, 'cleared');

    -- Insert sample budget amounts
    INSERT INTO budgets (category_id, month, amount)
    VALUES
        (category_id_groceries, '2024-07-01', 500.00),
        (category_id_dining, '2024-07-01', 250.00),
        (category_id_transport, '2024-07-01', 150.00),
        (category_id_entertainment, '2024-07-01', 100.00);

    RAISE NOTICE 'Successfully seeded the database.';

END $$;

COMMIT;
