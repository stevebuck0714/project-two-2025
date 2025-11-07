require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { parse: csvParse } = require('csv-parse');
const db = require('./lib/db');
const app = express();
// const port = 3001;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4001;

// Enable CORS for all routes with specific options
app.use(cors());

// Set up view engine
app.set('view engine', 'ejs');

// Set views directory with absolute path
const viewsPath = path.join(__dirname, 'views');
console.log('Views directory path:', viewsPath); // Debug log
app.set('views', viewsPath);

// Disable view caching for development
app.set('view cache', false);

// Disable ETag for development
app.set('etag', false);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Store for strategy selections and commitment criteria (in memory for now)
let savedStrategies = {};
let savedCommitmentCriteria = {
    targetCommitment: '500000',
    investmentHorizon: '7',
    deploymentDate: ''
};

// Store for posted investments (now using database)
let postedInvestments = [];

// Load posted investments from database
async function loadPostedInvestments() {
    try {
        postedInvestments = await db.loadPostedInvestments();
        console.log('Loaded', postedInvestments.length, 'posted investments from database');
    } catch (error) {
        console.error('Error loading posted investments:', error);
        postedInvestments = [];
    }
}

// Save posted investment to database
async function savePostedInvestment(investment) {
    try {
        const success = await db.savePostedInvestment(investment);
        if (success) {
            console.log('Saved posted investment to database:', investment.fundName);
            // Reload from database to keep in-memory cache in sync
            await loadPostedInvestments();
        }
        return success;
    } catch (error) {
        console.error('Error saving posted investment:', error);
        return false;
    }
}

// Remove investment from database
async function removePostedInvestment(fundName) {
    try {
        const success = await db.removePostedInvestment(fundName);
        if (success) {
            console.log('Removed posted investment from database:', fundName);
            // Reload from database to keep in-memory cache in sync
            await loadPostedInvestments();
        }
        return success;
    } catch (error) {
        console.error('Error removing posted investment:', error);
        return false;
    }
}

// Initialize posted investments on server startup
loadPostedInvestments().catch(err => console.error('Failed to load posted investments:', err));

// Function to remove duplicates from posted investments
function removeDuplicateInvestments() {
    const uniqueInvestments = [];
    const seenNames = new Set();
    
    for (const investment of postedInvestments) {
        const normalizedName = investment.fundName.toLowerCase().trim();
        if (!seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            uniqueInvestments.push(investment);
        }
    }
    
    if (postedInvestments.length !== uniqueInvestments.length) {
        postedInvestments = uniqueInvestments;
        savePostedInvestments(); // Save to file after removing duplicates
        console.log('Removed duplicates. Current posted investments:', postedInvestments.length);
    }
}

// Add formatNumber to app.locals so it's available to all views
app.locals.formatNumber = function(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }).replace('EUR', '€');
};

// Helper function to format numbers
function formatNumber(num) {
    if (num === undefined || num === null) return '€ 0';
    return '€ ' + num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Make formatNumber available to all views
app.use((req, res, next) => {
    res.locals.formatNumber = formatNumber;
    res.locals.path = req.path;
    next();
});

// Request logging middleware - make it more detailed
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// Add a health check route
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Simple user authentication (in production, use proper authentication)
const users = {
    // Private Bankers
    'alexandra.steinberg': { password: 'venturis0801', type: 'banker', name: 'Alexandra Steinberg - Senior Private Banker' },
    'maximilian.dubois': { password: 'venturis0801', type: 'banker', name: 'Maximilian Dubois - Portfolio Manager' },
    'catherine.whitmore': { password: 'venturis0801', type: 'banker', name: 'Catherine Whitmore - Wealth Advisor' },
    
    // Clients - each assigned to one of the three bankers
    // Alexandra Steinberg's clients (7 clients)
    'john.smith': { password: 'venturis0801', type: 'client', name: 'John Smith - London, UK', banker: 'Alexandra Steinberg - Senior Private Banker' },
    'marie.dubois': { password: 'venturis0801', type: 'client', name: 'Marie Dubois - Paris, France', banker: 'Alexandra Steinberg - Senior Private Banker' },
    'hans.weber': { password: 'venturis0801', type: 'client', name: 'Hans Weber - Munich, Germany', banker: 'Alexandra Steinberg - Senior Private Banker' },
    'sofia.rossi': { password: 'venturis0801', type: 'client', name: 'Sofia Rossi - Milan, Italy', banker: 'Alexandra Steinberg - Senior Private Banker' },
    'carlos.garcia': { password: 'venturis0801', type: 'client', name: 'Carlos Garcia - Madrid, Spain', banker: 'Alexandra Steinberg - Senior Private Banker' },
    'anna.kowalski': { password: 'venturis0801', type: 'client', name: 'Anna Kowalski - Warsaw, Poland', banker: 'Alexandra Steinberg - Senior Private Banker' },
    'erik.andersson': { password: 'venturis0801', type: 'client', name: 'Erik Andersson - Stockholm, Sweden', banker: 'Alexandra Steinberg - Senior Private Banker' },
    
    // Maximilian Dubois's clients (7 clients)
    'elena.popov': { password: 'venturis0801', type: 'client', name: 'Elena Popov - Moscow, Russia', banker: 'Maximilian Dubois - Portfolio Manager' },
    'dimitris.papadopoulos': { password: 'venturis0801', type: 'client', name: 'Dimitris Papadopoulos - Athens, Greece', banker: 'Maximilian Dubois - Portfolio Manager' },
    'jan.devries': { password: 'venturis0801', type: 'client', name: 'Jan de Vries - Amsterdam, Netherlands', banker: 'Maximilian Dubois - Portfolio Manager' },
    'lars.nielsen': { password: 'venturis0801', type: 'client', name: 'Lars Nielsen - Copenhagen, Denmark', banker: 'Maximilian Dubois - Portfolio Manager' },
    'marco.silva': { password: 'venturis0801', type: 'client', name: 'Marco Silva - Lisbon, Portugal', banker: 'Maximilian Dubois - Portfolio Manager' },
    'andrei.ionescu': { password: 'venturis0801', type: 'client', name: 'Andrei Ionescu - Bucharest, Romania', banker: 'Maximilian Dubois - Portfolio Manager' },
    'eva.novotna': { password: 'venturis0801', type: 'client', name: 'Eva Novotna - Prague, Czech Republic', banker: 'Maximilian Dubois - Portfolio Manager' },
    
    // Catherine Whitmore's clients (6 clients)
    'marta.kovac': { password: 'venturis0801', type: 'client', name: 'Marta Kovac - Budapest, Hungary', banker: 'Catherine Whitmore - Wealth Advisor' },
    'liam.obrien': { password: 'venturis0801', type: 'client', name: 'Liam O\'Brien - Dublin, Ireland', banker: 'Catherine Whitmore - Wealth Advisor' },
    'gustav.nilsson': { password: 'venturis0801', type: 'client', name: 'Gustav Nilsson - Oslo, Norway', banker: 'Catherine Whitmore - Wealth Advisor' },
    'isabella.marino': { password: 'venturis0801', type: 'client', name: 'Isabella Marino - Rome, Italy', banker: 'Catherine Whitmore - Wealth Advisor' },
    'thomas.muller': { password: 'venturis0801', type: 'client', name: 'Thomas Müller - Vienna, Austria', banker: 'Catherine Whitmore - Wealth Advisor' },
    'sophie.laurent': { password: 'venturis0801', type: 'client', name: 'Sophie Laurent - Brussels, Belgium', banker: 'Catherine Whitmore - Wealth Advisor' }
};

// Session middleware (cookie-based for serverless compatibility)
// Secret key for signing session cookies (in production, use environment variable)
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';

// Helper function to create signed session cookie
function createSessionCookie(userData) {
    const sessionData = JSON.stringify(userData);
    const signature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(sessionData)
        .digest('hex');
    
    return Buffer.from(JSON.stringify({
        data: sessionData,
        signature: signature
    })).toString('base64');
}

// Helper function to verify and parse session cookie
function parseSessionCookie(cookie) {
    try {
        const decoded = JSON.parse(Buffer.from(cookie, 'base64').toString('utf8'));
        const expectedSignature = crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(decoded.data)
            .digest('hex');
        
        if (decoded.signature === expectedSignature) {
            return JSON.parse(decoded.data);
        }
    } catch (error) {
        console.error('Error parsing session cookie:', error);
    }
    return null;
}

// Middleware to check authentication
function requireAuth(req, res, next) {
    const sessionCookie = req.headers.cookie?.match(/sessionData=([^;]+)/)?.[1];
    
    console.log('Auth check for:', req.path, 'Session cookie:', sessionCookie ? 'present' : 'none');
    
    if (sessionCookie) {
        const userData = parseSessionCookie(decodeURIComponent(sessionCookie));
        if (userData) {
            req.user = userData;
            console.log('Auth successful for user:', userData.username);
            next();
            return;
        }
    }
    
    console.log('Auth failed - redirecting to login');
    res.redirect('/login');
}

// Login page route
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Login form handler
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    
    if (user && user.password === password) {
        // Create session data
        const userData = {
            username: username,
            type: user.type,
            name: user.name,
            banker: user.banker || null, // Include banker info for clients
            createdAt: new Date().toISOString()
        };
        
        // Create signed session cookie
        const sessionCookie = createSessionCookie(userData);
        
        // Set cookie with better settings
        res.setHeader('Set-Cookie', `sessionData=${encodeURIComponent(sessionCookie)}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
        
        console.log('User logged in:', username);
        
        // Redirect based on user type
        if (user.type === 'banker') {
            res.redirect('/'); // Current home page for bankers
        } else {
            res.redirect('/briefing'); // Briefing page for clients
        }
    } else {
        res.render('login', { error: 'Invalid username or password' });
    }
});

// Logout route
app.get('/logout', (req, res) => {
    console.log('User logged out');
    // Clear cookie
    res.setHeader('Set-Cookie', 'sessionData=; HttpOnly; Path=/; Max-Age=0');
    res.redirect('/login');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).send('Something broke!');
});

// Middleware to pass current path and user to all views
app.use((req, res, next) => {
    res.locals.path = req.path;
    
    // Make user session available to all views
    const sessionCookie = req.headers.cookie?.match(/sessionData=([^;]+)/)?.[1];
    if (sessionCookie) {
        const userData = parseSessionCookie(decodeURIComponent(sessionCookie));
        res.locals.user = userData || null;
    } else {
        res.locals.user = null;
    }
    
    next();
});

// Function to convert Excel date serial number to JS Date
function excelDateToJSDate(serial) {
    // Excel's epoch starts from 1900-01-01
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;  
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

// Function to read CSV file
function readCSVFile(filePath) {
    try {
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
        
        return data;
    } catch (error) {
        console.error('Error reading CSV file:', error);
        return [];
    }
}

// Function to read Excel file
function readExcelFile(filePath) {
    try {
        // Try CSV first
        const csvPath = filePath.replace('.xlsx', '.csv');
        if (fs.existsSync(csvPath)) {
            return readCSVFile(csvPath);
        }
        
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read as objects with headers
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        if (data.length === 0) {
            throw new Error('No data found in Excel file');
        }

        return data;
    } catch (error) {
        console.error('Error reading Excel file:', error);
        // Return sample data if file reading fails
        return [
            {
                "Fund Name": "UBS SPV 1",
                "Type": "Private Equity",
                "Total Commitment": "€ 5.000.000",
                "Called Capital": "€ 4.750.000",
                "Remaining": "€ 250.000",
                "Current Value": "€ 4.500.000",
                "Called %": "95,00%",
                "Remaining %": "5,00%"
            }
        ];
    }
}

// Function to safely parse amount
function parseAmount(amount) {
    if (!amount) return 0;
    if (typeof amount === 'number') return amount;
    // Remove currency symbols, spaces, and convert commas to dots
    const cleanAmount = amount.toString()
        .replace(/[€$\s]/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.');
    return parseFloat(cleanAmount) || 0;
}

// Sample data for when CSV files are not present
const samplePortfolioData = [
    {
        "Fund Name": "Lombard Odier SPV 1",
        "Type": "Private Equity",
        "Total Commitment": "€ 5.000.000",
        "Called Capital": "€ 4.750.000",
        "Remaining": "€ 250.000",
        "Current Value": "€ 4.500.000",
        "Called %": "95,00%",
        "Remaining %": "5,00%"
    },
    {
        "Fund Name": "Lombard Odier SPV 2",
        "Type": "Private Equity",
        "Total Commitment": "€ 10.000.000",
        "Called Capital": "€ 9.500.000",
        "Remaining": "€ 500.000",
        "Current Value": "€ 8.000.000",
        "Called %": "95,00%",
        "Remaining %": "5,00%"
    }
];

// Function to process portfolio data for visualization
function processPortfolioData(portfolios) {
    // Fixed asset allocation as specified
    const assetAllocationPercentages = {
        'Cash': '5.00',
        'Marketable Securities': '60.00',
        'Fixed Income': '15.00',
        'Private Funds': '15.00',
        'Hedge Funds': '5.00',
        'Other Assets': '0.00'
    };

    // Fixed geographic allocation as specified
    const geographicAllocationPercentages = {
        'Europe': '30.00',
        'Asia': '26.00',
        'Africa': '6.00',
        'North America': '33.00',
        'South America': '5.00'
    };

    // Calculate performance metrics
    const performanceMetrics = {
        totalValue: 10000000, // Example total value
        assetAllocation: assetAllocationPercentages,
        geographicAllocation: geographicAllocationPercentages,
        totalInvestments: 25, // Example number of investments
        averageInvestmentSize: 400000, // Example average size
        assetTypeBreakdown: {
            'Cash': 2,
            'Marketable Securities': 10,
            'Fixed Income': 5,
            'Private Funds': 4,
            'Hedge Funds': 3,
            'Other Assets': 1
        }
    };

    return {
        rawData: [],
        metrics: performanceMetrics
    };
}

// Routes

// Root route - show welcome page (public landing page)
app.get('/', (req, res) => {
    const sessionCookie = req.headers.cookie?.match(/sessionData=([^;]+)/)?.[1];
    if (sessionCookie) {
        const userData = parseSessionCookie(decodeURIComponent(sessionCookie));
        if (userData) {
            // If user is a banker/advisor, show client selection page
            if (userData.type === 'banker') {
                res.render('index', { 
                    user: userData,
                    path: req.path
                });
                return;
            }
            // If user is a client, redirect to PE Briefing
            res.redirect('/briefing');
            return;
        }
    }
    // User not logged in, show welcome page
    res.render('welcome');
});

// Client Alerts route - only for Private Bankers
app.get('/client-alerts', requireAuth, (req, res) => {
    // req.user is set by requireAuth middleware
    
    // Only allow bankers to access this page
    if (req.user.type !== 'banker') {
        return res.status(403).send('Access denied. This page is only available to Private Bankers.');
    }
    
    res.render('client-alerts', { user: req.user });
});

app.get('/briefing', requireAuth, (req, res) => {
    // Sample data for the briefing page
    const briefingData = {
        portfolioNAV: 8750000,
        privateAssetsNAV: 8750000,
        oneDayChange: 0.42,
        mtdChange: 2.15,
        ytdChange: 14.8,
        upcomingCapitalCalls: 350000,
        expectedDistributions: 180000,
        volatility: 'Medium',
        creditSpreads: 'Neutral',
        macroRegime: 'Expansion',
        clientFirstName: 'John',
        peStrategies: [
            { name: 'Buyout', percentage: 45 },
            { name: 'Growth', percentage: 30 },
            { name: 'Venture', percentage: 15 },
            { name: 'Special Situations', percentage: 10 }
        ],
        portfolioCompanyNews: [
            {
                symbol: 'AAPL',
                company: 'Apple Inc.',
                headline: 'Apple Reports Record Q4 Revenue Driven by iPhone 15 Sales',
                summary: 'Apple exceeded analyst expectations with $89.5B in quarterly revenue, led by strong iPhone 15 adoption and Services growth.',
                impact: 'Positive',
                timeAgo: '2 hours ago',
                source: 'Reuters',
                relevance: 'High - Largest holding in your portfolio'
            },
            {
                symbol: 'NVDA',
                company: 'NVIDIA Corporation',
                headline: 'NVIDIA Announces New AI Chip Architecture for Data Centers',
                summary: 'The new H200 chips promise 2.5x performance improvement over previous generation, targeting enterprise AI workloads.',
                impact: 'Positive',
                timeAgo: '4 hours ago',
                source: 'TechCrunch',
                relevance: 'High - Second largest holding, strong AI exposure'
            },
            {
                symbol: 'MSFT',
                company: 'Microsoft Corporation',
                headline: 'Microsoft Azure Gains Market Share in Cloud Computing',
                summary: 'Azure cloud services grew 29% YoY, closing the gap with AWS as enterprise customers accelerate digital transformation.',
                impact: 'Positive',
                timeAgo: '6 hours ago',
                source: 'Bloomberg',
                relevance: 'High - Significant position, cloud growth driver'
            },
            {
                symbol: 'META',
                company: 'Meta Platforms Inc.',
                headline: 'Meta Invests $10B in VR/AR Development for 2024',
                summary: 'Continued investment in Reality Labs despite current losses, targeting consumer and enterprise metaverse applications.',
                impact: 'Neutral',
                timeAgo: '8 hours ago',
                source: 'Wall Street Journal',
                relevance: 'Medium - Monitor VR investments vs core advertising'
            },
            {
                symbol: 'TSLA',
                company: 'Tesla Inc.',
                headline: 'Tesla Cybertruck Production Ramp Faces Supply Chain Issues',
                summary: 'Manufacturing delays expected to push full production to mid-2024, impacting delivery targets for the electric pickup.',
                impact: 'Negative',
                timeAgo: '12 hours ago',
                source: 'Automotive News',
                relevance: 'Medium - Production challenges may affect near-term performance'
            },
            {
                symbol: 'GOOGL',
                company: 'Alphabet Inc.',
                headline: 'Google Cloud Wins Major Enterprise Contracts in AI Services',
                summary: 'Significant partnerships with Fortune 500 companies for AI-powered business solutions, competing directly with Microsoft and Amazon.',
                impact: 'Positive',
                timeAgo: '1 day ago',
                source: 'Financial Times',
                relevance: 'Medium - Cloud and AI growth competitive position'
            }
        ]
    };
    res.render('briefing', briefingData);
});

app.get('/portfolio', requireAuth, (req, res) => {
    res.render('portfolio');
});

app.get('/portfolio-summary', requireAuth, (req, res) => {
    try {
        // Read portfolio data - force CSV reading
        console.log('Reading portfolio data from:', __dirname);
        const portfolio1 = readCSVFile(path.join(__dirname, 'data', 'portfolio1.csv'));
        const portfolio2 = readCSVFile(path.join(__dirname, 'data', 'portfolio2.csv'));
        console.log('Portfolio1 data:', portfolio1);
        console.log('Portfolio2 data:', portfolio2);

        // Sample data for portfolio summary
        const processedData = {
            metrics: {
                totalValue: 20000000,
                totalInvestments: 15,
                averageInvestmentSize: 1333333.33,
                totalCommitment: 24000000,
                assetAllocation: {
                    'Cash': 5.00,
                    'Marketable Securities': 45.3125,
                    'Fixed Income': 15.00,
                    'Private Funds': 27.75,
                    'Hedge Funds': 6.9375,
                    'Other Assets': 0.00
                },
                assetTypeBreakdown: {
                    'Cash': 2,
                    'Marketable Securities': 10,
                    'Fixed Income': 5,
                    'Private Funds': 4,
                    'Hedge Funds': 3,
                    'Other Assets': 1
                },
                geographicAllocation: {
                    'Europe': 40,
                    'North America': 30,
                    'Asia': 20,
                    'Other': 10
                }
            },
            portfolioBreakdown: [
                { category: 'Private Equity', value: 8000000, percentage: 40 },
                { category: 'Real Estate', value: 6000000, percentage: 30 },
                { category: 'Infrastructure', value: 4000000, percentage: 20 },
                { category: 'Hedge Funds', value: 2000000, percentage: 10 }
            ],
            marketableSecurities: [
                { symbol: 'AAPL', name: 'Apple Inc.', shares: 6625, basis: 150.25, currentPrice: 185.40, dayChange: 2.85, dayChangePercent: 1.56, marketValue: 1227825, totalReturn: 232575, returnPercent: 23.39 },
                { symbol: 'MSFT', name: 'Microsoft Corporation', shares: 4765, basis: 240.80, currentPrice: 412.50, dayChange: -5.20, dayChangePercent: -1.24, marketValue: 1965563, totalReturn: 817813, returnPercent: 71.20 },
                { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 3180, basis: 98.50, currentPrice: 162.75, dayChange: 3.45, dayChangePercent: 2.17, marketValue: 517545, totalReturn: 204255, returnPercent: 65.08 },
                { symbol: 'AMZN', name: 'Amazon.com Inc.', shares: 2515, basis: 105.20, currentPrice: 155.80, dayChange: -1.90, dayChangePercent: -1.20, marketValue: 391837, totalReturn: 127259, returnPercent: 48.09 },
                { symbol: 'NVDA', name: 'NVIDIA Corporation', shares: 2120, basis: 220.00, currentPrice: 875.25, dayChange: 12.75, dayChangePercent: 1.48, marketValue: 1855530, totalReturn: 1389530, returnPercent: 298.75 },
                { symbol: 'TSLA', name: 'Tesla Inc.', shares: 1590, basis: 180.50, currentPrice: 248.75, dayChange: -7.25, dayChangePercent: -2.83, marketValue: 395512, totalReturn: 108725, returnPercent: 37.90 },
                { symbol: 'META', name: 'Meta Platforms Inc.', shares: 1853, basis: 195.30, currentPrice: 495.20, dayChange: 8.90, dayChangePercent: 1.83, marketValue: 917842, totalReturn: 555733, returnPercent: 153.60 },
                { symbol: 'NFLX', name: 'Netflix Inc.', shares: 1192, basis: 385.75, currentPrice: 615.80, dayChange: -4.15, dayChangePercent: -0.67, marketValue: 733634, totalReturn: 274094, returnPercent: 59.64 },
                { symbol: 'AMD', name: 'Advanced Micro Devices', shares: 2915, basis: 95.40, currentPrice: 142.60, dayChange: 4.20, dayChangePercent: 3.04, marketValue: 415579, totalReturn: 137279, returnPercent: 49.45 },
                { symbol: 'CRM', name: 'Salesforce Inc.', shares: 2250, basis: 165.90, currentPrice: 285.30, dayChange: -2.70, dayChangePercent: -0.94, marketValue: 641925, totalReturn: 268650, returnPercent: 72.01 }
            ]
        };

        res.render('portfolio-summary', {
            processedData,
            portfolio1,
            portfolio2,
            postedInvestments, // Pass posted investments to check which are listed
            formatNumber // Pass formatNumber explicitly
        });
    } catch (error) {
        console.error('Error loading portfolio data:', error);
        res.status(500).render('error', { error: 'Failed to load portfolio data' });
    }
});

app.get('/liquidity-summary', requireAuth, (req, res) => {
    res.render('liquidity-summary');
});

// Investment Opportunities page - shows Secondary Market and PE Investments
app.get('/investment-opportunities', requireAuth, (req, res) => {
    const tab = req.query.tab || 'secondary';
    res.render('investment-opportunities', {
        user: req.user,
        tab: tab
    });
});

// My Transactions page (old route) - handles My Listings and Transactions
app.get('/my-transactions-old', requireAuth, async (req, res) => {
    const tab = req.query.tab || 'listings';
    const postedFund = req.query.posted || null;
    const message = req.query.message || null;
    
    // Remove duplicates before rendering
    removeDuplicateInvestments();
    
    let displayMessage = null;
    if (postedFund) {
        displayMessage = `${postedFund} has been successfully posted for sale!`;
    } else if (message) {
        displayMessage = message;
    }
    
    // Sample offers data - in production this would come from a database
    const sampleOffers = [
        {
            id: 'offer-001',
            listingName: 'LOMBARD ODIER European Growth Fund II',
            buyerName: 'Institutional Investor Group',
            offerAmount: '€5,800,000',
            pricePercentage: '95%',
            offerDate: '2025-01-15',
            status: 'pending',
            comments: 'Interested in acquiring the full position. Can close within 30 days.'
        },
        {
            id: 'offer-002',
            listingName: 'LOMBARD ODIER European Growth Fund II',
            buyerName: 'Private Equity Secondary Fund',
            offerAmount: '€5,500,000',
            pricePercentage: '90%',
            offerDate: '2025-01-12',
            status: 'pending',
            comments: 'Seeking 10% discount due to market conditions. Flexible on timing.'
        },
        {
            id: 'offer-003',
            listingName: 'LOMBARD ODIER Tech Ventures Fund',
            buyerName: 'Family Office Investment',
            offerAmount: '€4,200,000',
            pricePercentage: '92%',
            offerDate: '2025-01-18',
            status: 'pending',
            comments: 'Strong interest in the technology portfolio. Would like to discuss terms.'
        }
    ];
    
    // Filter offers to only show those for investments that are actually listed
    const validOffers = sampleOffers.filter(offer => 
        postedInvestments.some(inv => inv.fundName === offer.listingName)
    );
    
    res.render('my-transactions', {
        postedInvestments: postedInvestments,
        offers: validOffers,
        tab: tab,
        successMessage: displayMessage,
        isError: !!message && !postedFund, // Flag to show error styling
        user: req.user
    });
});

// Redirect old transactions route to my-transactions with transactions tab
app.get('/transactions', requireAuth, (req, res) => {
    res.redirect('/my-transactions?tab=transactions');
});

// My Transactions page - handles My Listings and Transactions
app.get('/my-transactions', requireAuth, async (req, res) => {
    const tab = req.query.tab || 'listings';
    const postedFund = req.query.posted || null;
    const message = req.query.message || null;
    
    // Remove duplicates before rendering
    removeDuplicateInvestments();
    
    let displayMessage = null;
    if (postedFund) {
        displayMessage = `${postedFund} has been successfully posted for sale!`;
    } else if (message) {
        displayMessage = message;
    }
    
    // Sample offers data
    const sampleOffers = [
        {
            id: 'offer-001',
            listingName: 'LOMBARD ODIER European Growth Fund II',
            buyerName: 'Institutional Investor Group',
            offerAmount: '€5,800,000',
            pricePercentage: '95%',
            offerDate: '2025-01-15',
            status: 'pending',
            comments: 'Interested in acquiring the full position. Can close within 30 days.'
        }
    ];
    
    // Reload posted investments from database
    await loadPostedInvestments();
    
    res.render('my-transactions', {
        user: req.user,
        tab: tab,
        successMessage: displayMessage,
        isError: !!message && !postedFund,
        postedInvestments: postedInvestments,
        offers: sampleOffers
    });
});

app.get('/messages', requireAuth, (req, res) => {
    res.render('messages');
});

// API endpoint to get messages
app.get('/api/get-messages', requireAuth, async (req, res) => {
    try {
        const userId = req.user.username;
        const allMessages = await db.loadMessages();
        
        // Filter messages for the current user
        const userMessages = allMessages.filter(msg => msg.userId === userId);
        
        res.json({
            success: true,
            messages: userMessages
        });
    } catch (error) {
        console.error('Error loading messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading messages: ' + error.message
        });
    }
});

app.get('/support', requireAuth, (req, res) => {
    res.render('support');
});

app.get('/fund-details', requireAuth, async (req, res) => {
    try {
        // Get URL parameters to determine which fund to show
        const market = req.query.market || 'primary'; // primary or secondary
        const fund = req.query.fund || 'buyout'; // buyout, venture, hedge
        const source = req.query.source || null; // 'posted' if from My Listings
        const fundName = req.query.name || null; // name of posted investment
        const fundId = req.query.fundId || null; // specific fund ID for available investments
        
        // If this is a posted investment, get the data from posted investments
        if (source === 'posted' && fundName) {
            const postedInvestment = postedInvestments.find(investment => 
                investment.fundName === decodeURIComponent(fundName)
            );
            
            if (postedInvestment) {
                // Use posted investment data for fund details
                const fundInfo = {
                    title: `${postedInvestment.fundName} - Secondary Market`,
                    strategy: postedInvestment.type,
                    sector: 'Various',
                    size: postedInvestment.totalCommitment,
                    vintage: '2020-2025',
                    currentValue: postedInvestment.currentValue,
                    totalCommitment: postedInvestment.totalCommitment,
                    calledCapital: postedInvestment.calledCapital,
                    remaining: postedInvestment.remaining,
                    postedDate: postedInvestment.postedDate,
                    portfolioNumber: postedInvestment.portfolioNumber
                };
                
                return res.render('fund-details', {
                    market: 'secondary',
                    fundType: fund,
                    fundInfo: fundInfo,
                    isPostedInvestment: true,
                    postedInvestment: postedInvestment
                });
            }
        }
        
        // Define fund-specific data
        const fundData = {
            primary: {
                buyout: {
                    title: 'LOMBARD ODIER SPV BUYOUT FUND 2025',
                    strategy: 'Buyout',
                    sector: 'Telecommunications',
                    size: '>€1Bil',
                    vintage: '2016'
                },
                venture: {
                    title: 'LOMBARD ODIER SPV VENTURE FUND 2025',
                    strategy: 'Venture Capital',
                    sector: 'Multi-Balanced',
                    size: '>€1Bil',
                    vintage: '2016'
                },
                hedge: {
                    title: 'LOMBARD ODIER SPV HEDGE FUND 2025',
                    strategy: 'Growth',
                    sector: 'Utility',
                    size: '>€1Bil',
                    vintage: '2016'
                }
            },
            secondary: {
                buyout: {
                    title: 'SECONDARY MARKET OPPORTUNITIES',
                    strategy: 'Secondary Buyout',
                    sector: 'Various',
                    size: 'Mixed',
                    vintage: 'Various'
                },
                venture: {
                    title: 'SECONDARY MARKET OPPORTUNITIES',
                    strategy: 'Secondary Venture Capital',
                    sector: 'Various',
                    size: 'Mixed',
                    vintage: 'Various'
                },
                infrastructure: {
                    title: 'SECONDARY MARKET OPPORTUNITIES',
                    strategy: 'Secondary Infrastructure',
                    sector: 'Various',
                    size: 'Mixed',
                    vintage: 'Various'
                }
            }
        };

        // Define specific available investment data
        const availableInvestments = {
            spv1: {
                title: 'LOMBARD ODIER SPV 1',
                strategy: 'Buyout',
                sector: 'Telecommunications',
                size: '>€1Bil',
                vintage: '2016',
                currentValue: '€4,800,000',
                totalCalled: '€2,900,000',
                commitment: '€3,000,000',
                currentDPI: '0.75x',
                postedDate: '5/14/2025'
            },
            spv2: {
                title: 'LOMBARD ODIER SPV 2',
                strategy: 'Venture Capital',
                sector: 'Multi-Balanced',
                size: '>€800M',
                vintage: '2017',
                currentValue: '€6,200,000',
                totalCalled: '€3,800,000',
                commitment: '€4,500,000',
                currentDPI: '0.85x',
                postedDate: '3/22/2025'
            },
            spv3: {
                title: 'LOMBARD ODIER SPV 3',
                strategy: 'Infrastructure',
                sector: 'Utility',
                size: '>€1.2Bil',
                vintage: '2018',
                currentValue: '€7,200,000',
                totalCalled: '€4,100,000',
                commitment: '€5,000,000',
                currentDPI: '0.92x',
                postedDate: '1/15/2025'
            }
        };
        
        // Use specific fund data if fundId is provided (for available investments)
        let currentFund;
        if (fundId && availableInvestments[fundId]) {
            currentFund = availableInvestments[fundId];
        } else {
            currentFund = fundData[market]?.[fund] || fundData.primary.buyout;
        }
        const filePath = path.join(__dirname, 'data', 'Fund cash flows 2.csv');
        const csvContent = fs.readFileSync(filePath, 'utf8');
        
        // Parse CSV using sync API
        let records;
        try {
            // Split lines manually and parse
            const lines = csvContent.split('\n').filter(line => line.trim());
            records = lines.map(line => line.split(',').map(cell => cell.trim()));
        } catch (error) {
            console.error('CSV parsing error:', error);
            return res.status(500).send('Error parsing CSV data');
        }
        
        // Check if records is valid
        if (!Array.isArray(records) || records.length < 3) {
            console.error('Records is not valid:', records?.length || 'undefined');
            return res.status(500).send('Invalid data format');
        }
        
        // records[0] is header row, records[1] is column header row
        const dataRows = records.slice(2);
        const capitalCalledData = [];
        const distributionsData = [];
        dataRows.forEach(row => {
            // Capital Called: cols 0,1,2
            if (row[0] && row[1] && row[2] && !row[0].toLowerCase().includes('total')) {
                capitalCalledData.push({
                    Date: row[0],
                    Amount: row[1].replace(/[^\d.\-]/g, ''),
                    Name: row[2]
                });
            }
            // Distributions: cols 4,5,6
            if (row[4] && row[5] && row[6] && !row[4].toLowerCase().includes('total')) {
                distributionsData.push({
                    Date: row[4],
                    Amount: row[5].replace(/[^\d.\-]/g, ''),
                    Name: row[6]
                });
            }
        });
        // Generate listingId for available investments
        const listingIdMap = {
            'spv1': 'LST-SPV1',
            'spv2': 'LST-SPV2',
            'spv3': 'LST-SPV3'
        };
        
        res.render('fund-details', {
            capitalCalledData,
            distributionsData,
            fundInfo: currentFund,
            market: market,
            fundType: fund,
            fundId: fundId,
            listingId: fundId ? listingIdMap[fundId] : null,
            isAvailableInvestment: !!(fundId && availableInvestments[fundId]),
            availableInvestmentData: fundId && availableInvestments[fundId] ? availableInvestments[fundId] : null
        });
    } catch (error) {
        console.error(error);
        res.render('fund-details', {
            capitalCalledData: [],
            distributionsData: [],
            fundInfo: { title: 'Fund Details', strategy: 'N/A', sector: 'N/A', size: 'N/A', vintage: 'N/A' },
            market: 'primary',
            fundType: 'buyout'
        });
    }
});

app.get('/create-bid', requireAuth, (req, res) => {
    res.render('create-bid');
});

app.get('/contact-advisor', requireAuth, (req, res) => {
    // Three email types: generic, express-interest, specific
    const emailType = req.query.type || 'generic';
    const fundName = req.query.fundName || '';
    const listingId = req.query.listingId || '';
    const context = req.query.context || '';
    const action = req.query.action || '';
    const market = req.query.market || 'secondary';
    const fund = req.query.fund || 'buyout';
    
    // Build context data based on parameters
    let contextData = {};
    
    // For backwards compatibility with old links
    if (req.query.from === 'my-transactions' && !req.query.type) {
        return res.render('contact-advisor', {
            emailType: 'generic',
            subject: '',
            messageBody: '',
            contextData: null,
            path: req.path + '?type=generic&from=my-transactions',
            user: req.user
        });
    }
    
    // Handle different email types
    switch(emailType) {
        case 'generic':
            // Level 1: Generic emails - blank subject and body
            res.render('contact-advisor', {
                emailType: 'generic',
                subject: '',
                messageBody: '',
                contextData: null,
                path: req.path + '?type=generic',
                user: req.user
            });
            break;
            
        case 'express-interest':
            // Level 2: Express Interest - prefilled subject and partial body
            let expressSubject = '';
            let expressBody = '';
            
            if (fundName) {
                const decodedFundName = decodeURIComponent(fundName);
                contextData.fundName = decodedFundName;
                
                if (listingId) {
                    contextData.listingId = listingId;
                    expressSubject = `Interest in ${decodedFundName} - Listing #${listingId}`;
                    expressBody = `Dear Advisor,\n\nI am interested in learning more about the following investment opportunity:\n\n`;
                    expressBody += `Investment: ${decodedFundName}\n`;
                    expressBody += `Listing ID: ${listingId}\n\n`;
                    expressBody += `I would like to discuss:\n`;
                    expressBody += `• Investment details and performance metrics\n`;
                    expressBody += `• Pricing and terms\n`;
                    expressBody += `• Next steps for proceeding\n\n`;
                    expressBody += `Please let me know when you're available to discuss this opportunity.\n\n`;
                } else if (context === 'post-for-sale') {
                    expressSubject = `Question about posting ${decodedFundName} for sale`;
                    expressBody = `Dear Advisor,\n\nI am considering posting my position in ${decodedFundName} for sale on the secondary market.\n\n`;
                    expressBody += `Before proceeding, I would like to discuss:\n`;
                    expressBody += `• Current market conditions for this investment\n`;
                    expressBody += `• Appropriate pricing strategy\n`;
                    expressBody += `• Tax implications and timing considerations\n`;
                    expressBody += `• Any restrictions or approval requirements\n\n`;
                    expressBody += `Could we schedule a time to review this?\n\n`;
                } else {
                    expressSubject = `Question about ${decodedFundName}`;
                    expressBody = `Dear Advisor,\n\nI would like to discuss ${decodedFundName}.\n\n`;
                    expressBody += `Specifically, I'm interested in:\n\n`;
                }
            } else {
                expressSubject = `Investment Inquiry`;
                expressBody = `Dear Advisor,\n\nI would like to discuss an investment opportunity.\n\n`;
            }
            
            contextData.market = market;
            contextData.fund = fund;
            contextData.context = context;
            
            res.render('contact-advisor', {
                emailType: 'express-interest',
                subject: expressSubject,
                messageBody: expressBody,
                contextData: contextData,
                path: req.path,
                user: req.user
            });
            break;
            
        case 'specific':
            // Level 3: Specific Response - context-specific but open subject/body for user to fill
            let specificSubject = '';
            let specificBody = '';
            
            if (action === 'capital-call-confirm') {
                specificSubject = `Capital Call Confirmation - ${decodeURIComponent(fundName)}`;
                specificBody = `Dear Advisor,\n\nI acknowledge receipt of the capital call notice for ${decodeURIComponent(fundName)}.\n\n`;
                specificBody += `Please confirm:\n`;
                specificBody += `• Amount due: [Amount from notice]\n`;
                specificBody += `• Due date: [Date from notice]\n`;
                specificBody += `• Wire instructions\n\n`;
                specificBody += `I am prepared to fulfill this capital call and request confirmation of receipt once the transfer is complete.\n\n`;
            } else if (action === 'distribution-details') {
                specificSubject = `Distribution Details Request - ${decodeURIComponent(fundName)}`;
                specificBody = `Dear Advisor,\n\nI would like to request details about the recent distribution from ${decodeURIComponent(fundName)}.\n\n`;
                specificBody += `Please provide:\n`;
                specificBody += `• Distribution amount and breakdown\n`;
                specificBody += `• Return of capital vs. gains classification\n`;
                specificBody += `• Tax documentation timeline\n`;
                specificBody += `• Wire transfer details and expected date\n\n`;
            } else if (action === 'document-request') {
                specificSubject = `Data Room Document Access Request - ${decodeURIComponent(fundName)}`;
                specificBody = `Dear Advisor,\n\nI would like to request access to additional documents in the data room for ${decodeURIComponent(fundName)}.\n\n`;
                specificBody += `Please provide access to:\n`;
                specificBody += `[Specify document names or categories]\n\n`;
            } else if (context === 'bid-transaction' || context === 'offer-received') {
                // Transaction-related inquiry - open subject and body but with fund context
                specificSubject = `Question about ${decodeURIComponent(fundName)} Transaction`;
                specificBody = `Dear Advisor,\n\nI have a question regarding my ${context === 'bid-transaction' ? 'bid' : 'offer received'} for ${decodeURIComponent(fundName)}.\n\n`;
            } else {
                // Generic specific inquiry with fund context
                specificSubject = `Inquiry about ${decodeURIComponent(fundName)}`;
                specificBody = `Dear Advisor,\n\nI would like to discuss ${decodeURIComponent(fundName)}.\n\n`;
            }
            
            contextData.action = action;
            contextData.fundName = decodeURIComponent(fundName);
            contextData.context = context;
            
            res.render('contact-advisor', {
                emailType: 'specific',
                subject: specificSubject,
                messageBody: specificBody,
                contextData: contextData,
                path: req.path,
                user: req.user
            });
            break;
            
        default:
            res.render('contact-advisor', {
                emailType: 'generic',
                subject: '',
                messageBody: '',
                contextData: null,
                path: req.path,
                user: req.user
            });
    }
});

// Post for sale route
app.get('/post-for-sale/:fundName', async (req, res) => {
    try {
        const fundName = req.params.fundName;
        
        // Read both portfolio files to find the investment
        const portfolio1 = readExcelFile(path.join(__dirname, 'data', 'portfolio1.xlsx'));
        const portfolio2 = readExcelFile(path.join(__dirname, 'data', 'portfolio2.xlsx'));
        
        // Find the investment in either portfolio
        let investment = null;
        let portfolioNumber = null;
        
        const investment1 = portfolio1.find(item => {
            const itemName = item['Fund Name'] || '';
            const urlName = itemName.toLowerCase().replace(/\s+/g, '-');
            return urlName === fundName.toLowerCase();
        });
        
        if (investment1) {
            investment = investment1;
            portfolioNumber = 1;
        } else {
            const investment2 = portfolio2.find(item => {
                const itemName = item['Fund Name'] || '';
                const urlName = itemName.toLowerCase().replace(/\s+/g, '-');
                return urlName === fundName.toLowerCase();
            });
            if (investment2) {
                investment = investment2;
                portfolioNumber = 2;
            }
        }
        
        if (!investment) {
            return res.status(404).render('error', { 
                error: 'Investment not found',
                message: `No investment found with name: ${fundName}`
            });
        }
        
        // Check if already posted (case-insensitive comparison)
        const fundNameToCheck = investment['Fund Name'].toLowerCase().trim();
        const alreadyPosted = postedInvestments.find(posted => 
            posted.fundName.toLowerCase().trim() === fundNameToCheck
        );
        
        if (alreadyPosted) {
            console.log('Investment already posted for sale:', investment['Fund Name']);
            return res.redirect('/my-transactions?tab=listings&message=' + encodeURIComponent(`${investment['Fund Name']} is already posted for sale!`));
        }
        
        // Add to posted investments
        const postedInvestment = {
            fundName: investment['Fund Name'],
            type: investment['Type'],
            totalCommitment: investment['Total Commitment'],
            calledCapital: investment['Called Capital'],
            currentValue: investment['Current Value'],
            remaining: investment['Remaining'],
            calledPercent: investment['Called %'],
            remainingPercent: investment['Remaining %'],
            postedDate: new Date().toLocaleDateString('en-US'),
            portfolioNumber: portfolioNumber
        };
        
        // Save to database
        await savePostedInvestment(postedInvestment);
        
        console.log('Investment posted for sale:', postedInvestment);
        
        // Redirect to My Transactions page with success message
        res.redirect('/my-transactions?tab=listings&posted=' + encodeURIComponent(investment['Fund Name']));
        
    } catch (error) {
        console.error('Error posting investment for sale:', error);
        res.status(500).render('error', { 
            error: 'Failed to post investment for sale',
            message: error.message
        });
    }
});

// Remove investment from listings route
app.post('/remove-investment', requireAuth, async (req, res) => {
    try {
        const { fundName } = req.body;
        
        if (!fundName) {
            return res.status(400).json({ 
                success: false, 
                message: 'Fund name is required' 
            });
        }
        
        // Remove from database
        const success = await removePostedInvestment(fundName);
        
        if (success) {
            console.log('Investment removed from listings:', fundName);
            res.json({ 
                success: true, 
                message: `${fundName} has been removed from your listings` 
            });
        } else {
            console.log('Investment not found in listings:', fundName);
            res.status(404).json({ 
                success: false, 
                message: 'Investment not found in listings' 
            });
        }
        
    } catch (error) {
        console.error('Error removing investment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to remove investment from listings' 
        });
    }
});

// Investment details route
app.get('/investment-details/:fundName', requireAuth, (req, res) => {
    try {
        const fundName = req.params.fundName;
        
        // Read both portfolio files
        const portfolio1 = readExcelFile(path.join(__dirname, 'data', 'portfolio1.xlsx'));
        const portfolio2 = readExcelFile(path.join(__dirname, 'data', 'portfolio2.xlsx'));
        
        // Find the investment in either portfolio
        let investment = null;
        let portfolioNumber = null;
        
        // Search in portfolio 1
        const investment1 = portfolio1.find(item => {
            const itemName = item['Fund Name'] || '';
            const urlName = itemName.toLowerCase().replace(/\s+/g, '-');
            console.log('Comparing:', urlName, 'with', fundName.toLowerCase());
            return urlName === fundName.toLowerCase();
        });
        
        if (investment1) {
            investment = investment1;
            portfolioNumber = 1;
        } else {
            // Search in portfolio 2
            const investment2 = portfolio2.find(item => {
                const itemName = item['Fund Name'] || '';
                const urlName = itemName.toLowerCase().replace(/\s+/g, '-');
                console.log('Comparing:', urlName, 'with', fundName.toLowerCase());
                return urlName === fundName.toLowerCase();
            });
            if (investment2) {
                investment = investment2;
                portfolioNumber = 2;
            }
        }
        
        if (!investment) {
            return res.status(404).render('error', { 
                error: 'Investment not found',
                message: `No investment found with name: ${fundName}`
            });
        }
        
        // Generate additional KPIs and metrics
        const totalCommitment = parseAmount(investment['Total Commitment']);
        const calledCapital = parseAmount(investment['Called Capital']);
        const currentValue = parseAmount(investment['Current Value']);
        const remaining = parseAmount(investment['Remaining']);
        
        console.log('Parsed values:', { totalCommitment, calledCapital, currentValue, remaining });
        
        const kpis = {
            // Performance metrics
            totalReturn: ((currentValue - calledCapital) / calledCapital * 100).toFixed(2),
            netIRR: (Math.random() * 15 + 5).toFixed(2), // Simulated
            tvpi: (currentValue / calledCapital).toFixed(2),
            dpi: (Math.random() * 0.5).toFixed(2), // Simulated distributions
            
            // Risk metrics
            volatility: (Math.random() * 20 + 10).toFixed(1),
            sharpeRatio: (Math.random() * 2 + 0.5).toFixed(2),
            maxDrawdown: (Math.random() * 15 + 5).toFixed(1),
            
            // Operational metrics
            deploymentProgress: ((calledCapital / totalCommitment) * 100).toFixed(1),
            remainingCommitment: remaining,
            vintageYear: 2020 + Math.floor(Math.random() * 5), // Simulated
            fundSize: totalCommitment * (2 + Math.random() * 3), // Simulated total fund size
            
            // Market metrics
            industryBenchmark: (Math.random() * 20 + 8).toFixed(2),
            peerRanking: Math.floor(Math.random() * 25) + 1, // Top quartile
            
            // Cashflow metrics
            monthlyIncome: (currentValue * 0.005).toFixed(0), // Simulated 0.5% monthly
            lastDistribution: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
            nextCapitalCall: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
        };
        
        // Check if this investment is already listed for sale
        const fundNameToCheck = investment['Fund Name'].toLowerCase().trim();
        const isAlreadyListed = postedInvestments.some(posted => 
            posted.fundName.toLowerCase().trim() === fundNameToCheck
        );
        
        res.render('investment-details', {
            investment,
            kpis,
            portfolioNumber,
            fundName: investment['Fund Name'],
            isAlreadyListed: isAlreadyListed
        });
        
    } catch (error) {
        console.error('Error loading investment details:', error);
        res.status(500).render('error', { 
            error: 'Failed to load investment details',
            message: error.message
        });
    }
});

// API endpoint to get portfolio data
app.get('/api/portfolios', (req, res) => {
  try {
    const portfolio1 = readExcelFile(path.join(__dirname, 'data', 'portfolio1.xlsx'));
    const portfolio2 = readExcelFile(path.join(__dirname, 'data', 'portfolio2.xlsx'));
    
    res.json({
      portfolio1,
      portfolio2
    });
  } catch (error) {
    console.error('Error reading portfolio data:', error);
    res.status(500).json({ error: 'Failed to read portfolio data' });
  }
});

// Client Mandates Storage
const clientMandatesFile = path.join(__dirname, 'data', 'client-mandates.json');

function loadClientMandates() {
    try {
        if (fs.existsSync(clientMandatesFile)) {
            const data = fs.readFileSync(clientMandatesFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading client mandates:', error);
    }
    return {};
}

function saveClientMandates(mandates) {
    try {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(clientMandatesFile, JSON.stringify(mandates, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving client mandates:', error);
        return false;
    }
}

// Resolved Alerts Storage
const resolvedAlertsFile = path.join(__dirname, 'data', 'resolved-alerts.json');

function loadResolvedAlerts() {
    try {
        if (fs.existsSync(resolvedAlertsFile)) {
            const data = fs.readFileSync(resolvedAlertsFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading resolved alerts:', error);
    }
    return {};
}

function saveResolvedAlerts(alerts) {
    try {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(resolvedAlertsFile, JSON.stringify(alerts, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving resolved alerts:', error);
        return false;
    }
}

// API endpoint to save client mandates
app.post('/api/save-client-mandates', requireAuth, (req, res) => {
    try {
        console.log('=== SAVE CLIENT MANDATES REQUEST ===');
        console.log('User:', req.user);
        
        const userId = req.user.username;
        const mandateData = req.body;
        
        console.log('UserId:', userId);
        console.log('Mandate data received:', JSON.stringify(mandateData, null, 2));
        
        // Load existing mandates
        const allMandates = loadClientMandates();
        console.log('Existing mandates loaded:', Object.keys(allMandates));
        
        // Save mandates for this user
        allMandates[userId] = {
            ...mandateData,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('About to save mandates for user:', userId);
        
        // Save to file
        const success = saveClientMandates(allMandates);
        
        console.log('Save result:', success);
        
        if (success) {
            console.log('✓ Client mandates saved successfully');
            res.json({ success: true, message: 'Client mandates saved successfully' });
        } else {
            console.log('✗ Failed to save client mandates');
            res.status(500).json({ success: false, message: 'Failed to save client mandates' });
        }
    } catch (error) {
        console.error('✗ Error saving client mandates:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ success: false, message: 'Error saving client mandates: ' + error.message });
    }
});

// API endpoint to get client mandates
app.get('/api/get-client-mandates', requireAuth, (req, res) => {
    try {
        const userId = req.user.username;
        const allMandates = loadClientMandates();
        
        console.log('Loading mandates for user:', userId);
        console.log('Available mandates:', Object.keys(allMandates));
        
        if (allMandates[userId]) {
            res.json({ 
                success: true, 
                mandates: allMandates[userId]
            });
        } else {
            res.json({ 
                success: false, 
                message: 'No saved client mandates found'
            });
        }
    } catch (error) {
        console.error('Error loading client mandates:', error);
        res.status(500).json({ success: false, message: 'Error loading client mandates' });
    }
});

// API endpoint to save resolved alerts
app.post('/api/save-resolved-alert', requireAuth, (req, res) => {
    try {
        const userId = req.user.username;
        const { alertId, resolved } = req.body;
        
        console.log('Saving resolved alert for user:', userId, 'Alert ID:', alertId, 'Resolved:', resolved);
        
        // Load existing resolved alerts
        const allAlerts = loadResolvedAlerts();
        
        // Initialize user's alerts if not exists
        if (!allAlerts[userId]) {
            allAlerts[userId] = {};
        }
        
        // Save or remove the alert resolution
        if (resolved) {
            allAlerts[userId][alertId] = true;
        } else {
            delete allAlerts[userId][alertId];
        }
        
        // Save to file
        const success = saveResolvedAlerts(allAlerts);
        
        if (success) {
            res.json({ success: true, message: 'Alert resolution saved' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save alert resolution' });
        }
    } catch (error) {
        console.error('Error saving resolved alert:', error);
        res.status(500).json({ success: false, message: 'Error saving alert: ' + error.message });
    }
});

// API endpoint to send contact advisor message
app.post('/api/contact-advisor', requireAuth, async (req, res) => {
    try {
        const { emailType, subject, message, clientName, clientEmail, advisorName, advisorEmail } = req.body;
        const user = req.user;
        
        console.log('Contact advisor request from:', user.name, 'Email type:', emailType);
        
        // Determine message type based on email type
        let responseMessage = '';
        
        if (emailType === 'generic') {
            responseMessage = 'Thank you for contacting us. Your message has been received and we will respond within 1-2 business days.';
        } else if (emailType === 'express-interest') {
            responseMessage = 'Thank you for expressing interest. Our team will review this investment opportunity with you and respond within 1-2 business days with detailed information.';
        } else if (emailType === 'specific') {
            responseMessage = 'Your request has been received. We will process this and respond shortly with the requested information.';
        }
        
        const timestamp = Date.now();
        
        // Create the SENT message (what the client sent to the advisor)
        const sentMessage = {
            id: `msg-${timestamp}-sent`,
            userId: user.username,
            subject: subject || 'Advisor Inquiry',
            from: user.name,
            to: advisorName || 'UBS PE Advisory Team',
            date: new Date().toISOString(),
            preview: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            fullMessage: `Dear ${advisorName || 'UBS PE Advisory Team'},\n\n${message}\n\nBest regards,\n\n${user.name}`,
            type: 'sent',
            unread: false
        };
        
        // Create the INBOX message (advisor's response back to the client)
        const inboxMessage = {
            id: `msg-${timestamp + 1}`,
            userId: user.username,
            subject: `Re: ${subject || 'Advisor Inquiry'}`,
            from: advisorName || 'UBS PE Advisory Team',
            to: user.name,
            date: new Date().toISOString(),
            preview: responseMessage,
            fullMessage: `Dear ${user.name},\n\n${responseMessage}\n\nYour message:\n"${message}"\n\nOur Private Equity advisory team is reviewing your inquiry and will provide a comprehensive response shortly.\n\nIn the meantime, if you have any urgent questions, please don't hesitate to contact your Private Banker directly.\n\nBest regards,\n${advisorName || 'UBS PE Advisory Team'}`,
            type: 'inbox',
            unread: true
        };
        
        // Save both messages to database
        const sentSuccess = await db.saveMessage(sentMessage);
        const inboxSuccess = await db.saveMessage(inboxMessage);
        
        if (sentSuccess && inboxSuccess) {
            console.log('Messages saved successfully');
            res.json({ success: true, message: 'Your message has been sent successfully. You will receive a response within 1-2 business days.' });
        } else {
            console.error('Failed to save messages');
            res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
        }
    } catch (error) {
        console.error('Error sending contact advisor message:', error);
        res.status(500).json({ success: false, message: 'Error sending message: ' + error.message });
    }
});

// API endpoint to get resolved alerts
app.get('/api/get-resolved-alerts', requireAuth, (req, res) => {
    try {
        const userId = req.user.username;
        const allAlerts = loadResolvedAlerts();
        
        console.log('Loading resolved alerts for user:', userId);
        
        const userAlerts = allAlerts[userId] || {};
        res.json({ 
            success: true, 
            resolvedAlerts: userAlerts
        });
    } catch (error) {
        console.error('Error loading resolved alerts:', error);
        res.status(500).json({ success: false, message: 'Error loading alerts' });
    }
});

// Risk/Return Profile page
app.get('/risk-return-profile', requireAuth, (req, res) => {
    res.render('risk-return-profile', {
        path: req.path,
        scenarios: {
            base: 14,
            down: 8,
            up: 22
        },
        riskProfiles: [
            { id: 'conservative', name: 'Conservative', expectedReturn: '8-10%', riskLevel: 'Low', maxDrawdown: '-10%' },
            { id: 'balanced', name: 'Balanced', expectedReturn: '10-12%', riskLevel: 'Medium', maxDrawdown: '-15%' },
            { id: 'growth', name: 'Growth', expectedReturn: '12-15%', riskLevel: 'High', maxDrawdown: '-20%' },
            { id: 'aggressive', name: 'Aggressive', expectedReturn: '15%+', riskLevel: 'Very High', maxDrawdown: '-25%' }
        ]
    });
});

// ESG Framework page
app.get('/esg-framework', requireAuth, (req, res) => {
    res.render('esg-framework', {
        path: req.path,
        esgMetrics: {
            environmental: {
                score: 85,
                carbonFootprint: '12.5 tons CO2e',
                renewableEnergy: '45%',
                wasteManagement: '92%'
            },
            social: {
                score: 78,
                laborPractices: 'Strong',
                communityEngagement: 'High',
                humanRights: 'Excellent'
            },
            governance: {
                score: 92,
                boardDiversity: '45%',
                transparencyScore: 'High',
                ethicsRating: 'AAA'
            }
        }
    });
});

// Add the new route for fund manager attributes
app.get('/fund-manager-attributes', requireAuth, (req, res) => {
    res.render('fund-manager-attributes');
});

// Add a test route
app.get('/test', (req, res) => {
    res.send('Server is working!');
});

// Route to save strategy selections
app.post('/api/save-strategies', (req, res) => {
    try {
        const { selections } = req.body;
        savedStrategies = selections;
        console.log('Saved strategies:', savedStrategies);
        res.json({ success: true, message: 'Strategies saved successfully' });
    } catch (error) {
        console.error('Error saving strategies:', error);
        res.status(500).json({ success: false, message: 'Error saving strategies' });
    }
});

// Route to get saved strategies
app.get('/api/get-strategies', (req, res) => {
    res.json(savedStrategies);
});

// Commitment Criteria route
app.get('/commitment-criteria', requireAuth, (req, res) => {
    res.render('commitment-criteria', { path: req.path });
});

// API route to save commitment criteria
app.post('/api/save-commitment-criteria', (req, res) => {
    try {
        const { targetCommitment, investmentHorizon, deploymentDate } = req.body;
        
        // Validate the data
        if (!targetCommitment || !investmentHorizon || !deploymentDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }

        // Update the saved data
        savedCommitmentCriteria = {
            targetCommitment,
            investmentHorizon,
            deploymentDate
        };
        
        console.log('Updated commitment criteria:', savedCommitmentCriteria);
        
        res.json({ 
            success: true, 
            message: 'Commitment criteria saved successfully' 
        });
    } catch (error) {
        console.error('Error saving commitment criteria:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error saving commitment criteria' 
        });
    }
});

// Minimal root route for connectivity test
app.get('/plain-root', (req, res) => {
    res.status(200).send('Server root is working!');
});

// Catch-all error handler for uncaught errors
process.on('exit', (code) => {
    console.log('Process exit event with code:', code);
});
process.on('SIGINT', () => {
    console.log('Received SIGINT. Exiting...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Exiting...');
    process.exit(0);
});

// Start server - simplified and more robust
console.log('About to start server on port', port);
const server = app.listen(port, (err) => {
    if (err) {
        console.error('Server failed to start:', err);
        process.exit(1);
    }
    console.log(`Server is running on http://localhost:${port}`);
    console.log('Server is ready to accept connections');
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 