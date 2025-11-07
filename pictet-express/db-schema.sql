-- Messages table for storing user messages
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    from_name VARCHAR(255) NOT NULL,
    to_name VARCHAR(255) NOT NULL,
    date TIMESTAMP NOT NULL,
    preview TEXT,
    full_message TEXT,
    type VARCHAR(50) NOT NULL,
    unread BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posted investments table
CREATE TABLE IF NOT EXISTS posted_investments (
    id SERIAL PRIMARY KEY,
    fund_name VARCHAR(500) NOT NULL,
    type VARCHAR(255),
    total_commitment VARCHAR(100),
    called_capital VARCHAR(100),
    current_value VARCHAR(100),
    remaining VARCHAR(100),
    called_percent VARCHAR(50),
    remaining_percent VARCHAR(50),
    posted_date VARCHAR(100),
    portfolio_number INTEGER,
    seller_id VARCHAR(255),
    seller_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fund_name)
);

-- Client mandates table
CREATE TABLE IF NOT EXISTS client_mandates (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    mandate_data JSONB NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resolved alerts table
CREATE TABLE IF NOT EXISTS resolved_alerts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    alert_id VARCHAR(255) NOT NULL,
    resolved BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, alert_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date DESC);
CREATE INDEX IF NOT EXISTS idx_posted_investments_fund_name ON posted_investments(fund_name);
CREATE INDEX IF NOT EXISTS idx_client_mandates_user_id ON client_mandates(user_id);
CREATE INDEX IF NOT EXISTS idx_resolved_alerts_user_id ON resolved_alerts(user_id);

