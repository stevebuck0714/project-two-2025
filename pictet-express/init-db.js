// Script to initialize database tables
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDatabase() {
    try {
        console.log('Connecting to database...');
        
        // Read the schema file
        const schemaSQL = fs.readFileSync(path.join(__dirname, 'db-schema.sql'), 'utf8');
        
        console.log('Creating tables...');
        await pool.query(schemaSQL);
        
        console.log('✅ Database tables created successfully!');
        console.log('Tables created:');
        console.log('  - messages');
        console.log('  - posted_investments');
        console.log('  - client_mandates');
        console.log('  - resolved_alerts');
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        console.error(error);
        process.exit(1);
    }
}

initDatabase();

