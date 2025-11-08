const { Pool } = require('pg');

// Create a connection pool
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test the connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database error:', err);
});

// Helper function to query the database
async function query(text, params) {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Messages functions
async function loadMessages() {
    try {
        const result = await query('SELECT * FROM messages ORDER BY date DESC');
        return result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            subject: row.subject,
            from: row.from_name,
            to: row.to_name,
            date: row.date,
            preview: row.preview,
            fullMessage: row.full_message,
            type: row.type,
            unread: row.unread
        }));
    } catch (error) {
        console.error('Error loading messages:', error);
        return [];
    }
}

async function saveMessage(message) {
    try {
        await query(
            `INSERT INTO messages (id, user_id, subject, from_name, to_name, date, preview, full_message, type, unread)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE SET
                subject = EXCLUDED.subject,
                from_name = EXCLUDED.from_name,
                to_name = EXCLUDED.to_name,
                date = EXCLUDED.date,
                preview = EXCLUDED.preview,
                full_message = EXCLUDED.full_message,
                type = EXCLUDED.type,
                unread = EXCLUDED.unread`,
            [
                message.id,
                message.userId,
                message.subject,
                message.from,
                message.to,
                message.date,
                message.preview,
                message.fullMessage,
                message.type,
                message.unread
            ]
        );
        return true;
    } catch (error) {
        console.error('Error saving message:', error);
        return false;
    }
}

async function saveMessages(messages) {
    try {
        for (const message of messages) {
            await saveMessage(message);
        }
        return true;
    } catch (error) {
        console.error('Error saving messages:', error);
        return false;
    }
}

async function deleteMessage(messageId, userId) {
    try {
        const result = await query(
            'DELETE FROM messages WHERE id = $1 AND user_id = $2',
            [messageId, userId]
        );
        return result.rowCount > 0;
    } catch (error) {
        console.error('Error deleting message:', error);
        return false;
    }
}

// Posted investments functions
async function loadPostedInvestments() {
    try {
        const result = await query('SELECT * FROM posted_investments ORDER BY created_at DESC');
        return result.rows.map(row => ({
            fundName: row.fund_name,
            type: row.type,
            totalCommitment: row.total_commitment,
            calledCapital: row.called_capital,
            currentValue: row.current_value,
            remaining: row.remaining,
            calledPercent: row.called_percent,
            remainingPercent: row.remaining_percent,
            postedDate: row.posted_date,
            portfolioNumber: row.portfolio_number,
            sellerId: row.seller_id,
            sellerName: row.seller_name
        }));
    } catch (error) {
        console.error('Error loading posted investments:', error);
        return [];
    }
}

async function savePostedInvestment(investment) {
    try {
        await query(
            `INSERT INTO posted_investments 
             (fund_name, type, total_commitment, called_capital, current_value, remaining, 
              called_percent, remaining_percent, posted_date, portfolio_number, seller_id, seller_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (fund_name) DO NOTHING`,
            [
                investment.fundName,
                investment.type,
                investment.totalCommitment,
                investment.calledCapital,
                investment.currentValue,
                investment.remaining,
                investment.calledPercent,
                investment.remainingPercent,
                investment.postedDate,
                investment.portfolioNumber,
                investment.sellerId || null,
                investment.sellerName || null
            ]
        );
        return true;
    } catch (error) {
        console.error('Error saving posted investment:', error);
        return false;
    }
}

async function removePostedInvestment(fundName) {
    try {
        const result = await query(
            'DELETE FROM posted_investments WHERE LOWER(TRIM(fund_name)) = LOWER(TRIM($1))',
            [fundName]
        );
        return result.rowCount > 0;
    } catch (error) {
        console.error('Error removing posted investment:', error);
        return false;
    }
}

// Client mandates functions
async function loadClientMandates() {
    try {
        const result = await query('SELECT * FROM client_mandates');
        const mandates = {};
        result.rows.forEach(row => {
            mandates[row.user_id] = row.mandate_data;
        });
        return mandates;
    } catch (error) {
        console.error('Error loading client mandates:', error);
        return {};
    }
}

async function saveClientMandates(userId, mandateData) {
    try {
        await query(
            `INSERT INTO client_mandates (user_id, mandate_data, last_updated)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
                mandate_data = EXCLUDED.mandate_data,
                last_updated = CURRENT_TIMESTAMP`,
            [userId, JSON.stringify(mandateData)]
        );
        return true;
    } catch (error) {
        console.error('Error saving client mandates:', error);
        return false;
    }
}

// Resolved alerts functions
async function loadResolvedAlerts() {
    try {
        const result = await query('SELECT * FROM resolved_alerts WHERE resolved = true');
        const alerts = {};
        result.rows.forEach(row => {
            if (!alerts[row.user_id]) {
                alerts[row.user_id] = {};
            }
            alerts[row.user_id][row.alert_id] = true;
        });
        return alerts;
    } catch (error) {
        console.error('Error loading resolved alerts:', error);
        return {};
    }
}

async function saveResolvedAlert(userId, alertId, resolved) {
    try {
        if (resolved) {
            await query(
                `INSERT INTO resolved_alerts (user_id, alert_id, resolved)
                 VALUES ($1, $2, true)
                 ON CONFLICT (user_id, alert_id) DO UPDATE SET
                    resolved = true`,
                [userId, alertId]
            );
        } else {
            await query(
                'DELETE FROM resolved_alerts WHERE user_id = $1 AND alert_id = $2',
                [userId, alertId]
            );
        }
        return true;
    } catch (error) {
        console.error('Error saving resolved alert:', error);
        return false;
    }
}

module.exports = {
    query,
    pool,
    loadMessages,
    saveMessage,
    saveMessages,
    deleteMessage,
    loadPostedInvestments,
    savePostedInvestment,
    removePostedInvestment,
    loadClientMandates,
    saveClientMandates,
    loadResolvedAlerts,
    saveResolvedAlert
};






