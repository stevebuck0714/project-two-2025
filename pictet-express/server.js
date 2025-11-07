const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { parse: csvParse } = require('csv-parse');
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

// Store for posted investments (persistent file storage)
const POSTED_INVESTMENTS_FILE = path.join(__dirname, 'data', 'posted-investments.json');
let postedInvestments = [];

// Load posted investments from file on startup
function loadPostedInvestments() {
    try {
        if (fs.existsSync(POSTED_INVESTMENTS_FILE)) {
            const data = fs.readFileSync(POSTED_INVESTMENTS_FILE, 'utf8');
            postedInvestments = JSON.parse(data);
            console.log('Loaded', postedInvestments.length, 'posted investments from file');
        } else {
            console.log('No posted investments file found, starting with empty array');
        }
    } catch (error) {
        console.error('Error loading posted investments:', error);
        postedInvestments = [];
    }
}

// Save posted investments to file
function savePostedInvestments() {
    try {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(POSTED_INVESTMENTS_FILE, JSON.stringify(postedInvestments, null, 2));
        console.log('Saved', postedInvestments.length, 'posted investments to file');
    } catch (error) {
        console.error('Error saving posted investments:', error);
    }
}

// Load posted investments on server startup
loadPostedInvestments();

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

// Root route - redirect to login if not authenticated
app.get('/', (req, res) => {
    const sessionCookie = req.headers.cookie?.match(/sessionData=([^;]+)/)?.[1];
    if (sessionCookie) {
        const userData = parseSessionCookie(decodeURIComponent(sessionCookie));
        if (userData) {
            // User is logged in, show the banker home page
            res.render('index', { user: userData });
            return;
        }
    }
    // User not logged in, redirect to login
    res.redirect('/login');
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

app.get('/welcome', requireAuth, (req, res) => {
    res.render('welcome');
});

app.get('/briefing', requireAuth, (req, res) => {
    // Sample data for the briefing page
    // Calculate private assets NAV (Private Funds + Hedge Funds + Other Assets)
    const totalPortfolioValue = 20000000;
    const privateAssetsPercent = 16.25 + 6.9375 + 11.5; // 34.6875%
    const privateAssetsNAV = (privateAssetsPercent / 100) * totalPortfolioValue;
    
    const briefingData = {
        portfolioNAV: 8750000,
        privateAssetsNAV: privateAssetsNAV,
        peStrategies: [
            { name: 'Large-Cap Buyout', value: 1850000, percentage: 26.7 },
            { name: 'Mid-Market Buyout', value: 2100000, percentage: 30.3 },
            { name: 'Growth Equity', value: 1750000, percentage: 25.2 },
            { name: 'Venture Capital', value: 1237500, percentage: 17.8 }
        ],
        oneDayChange: 0.42,
        mtdChange: 2.15,
        ytdChange: 14.8,
        upcomingCapitalCalls: 350000,
        expectedDistributions: 180000,
        volatility: 'Medium',
        creditSpreads: 'Neutral',
        macroRegime: 'Expansion',
        clientFirstName: 'John',
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
                    'Private Funds': 16.25,
                    'Hedge Funds': 6.9375,
                    'Other Assets': 11.5
                },
                customValues: {
                    'Private Funds': {
                        costBasis: 2500000,
                        totalValue: 3250000
                    }
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

// Redirect old investment-opportunities route to bulletin-board
app.get('/investment-opportunities', requireAuth, (req, res) => {
    const tab = req.query.tab || 'listings';
    res.redirect(`/bulletin-board?tab=${tab}`);
});

app.get('/bulletin-board', requireAuth, (req, res) => {
    const tab = req.query.tab || 'primary';
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
    
    res.render('bulletin-board', {
        postedInvestments: postedInvestments,
        offers: validOffers,
        activeTab: tab,
        successMessage: displayMessage,
        isError: !!message && !postedFund // Flag to show error styling
    });
});

// Redirect old transactions route to bulletin board with transactions tab
app.get('/transactions', requireAuth, (req, res) => {
    res.redirect('/bulletin-board?tab=transactions');
});

app.get('/messages', requireAuth, (req, res) => {
    res.render('messages');
});

app.get('/support', requireAuth, (req, res) => {
    res.render('support');
});

app.get('/fund-details', requireAuth, async (req, res) => {
    try {
        // Get URL parameters to determine which fund to show
        const market = req.query.market || 'primary'; // primary or secondary
        const fund = req.query.fund || 'buyout'; // buyout, venture, hedge
        const source = req.query.source || null; // 'posted' if from Your Listings
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
                    title: 'BULLETIN BOARD - SECONDARY MARKET OPPORTUNITIES',
                    strategy: 'Secondary Buyout',
                    sector: 'Various',
                    size: 'Mixed',
                    vintage: 'Various'
                },
                venture: {
                    title: 'BULLETIN BOARD - SECONDARY MARKET OPPORTUNITIES',
                    strategy: 'Secondary Venture Capital',
                    sector: 'Various',
                    size: 'Mixed',
                    vintage: 'Various'
                },
                infrastructure: {
                    title: 'BULLETIN BOARD - SECONDARY MARKET OPPORTUNITIES',
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
        res.render('fund-details', {
            capitalCalledData,
            distributionsData,
            fundInfo: currentFund,
            market: market,
            fundType: fund,
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
    // Get URL parameters to pass fund information
    const market = req.query.market || 'secondary';
    const fund = req.query.fund || 'buyout';
    const fundName = req.query.fundName || null;
    
    // Define fund-specific data (same as fund-details)
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
                title: 'BULLETIN BOARD - SECONDARY MARKET OPPORTUNITIES',
                strategy: 'Secondary Buyout',
                sector: 'Various',
                size: 'Mixed',
                vintage: 'Various'
            }
        }
    };
    
    let currentFund = fundData[market]?.[fund] || fundData.secondary.buyout;
    
    // Override with passed fund name if provided
    if (fundName) {
        currentFund = { ...currentFund, title: fundName };
    }
    
    res.render('contact-advisor', {
        fundInfo: currentFund,
        market: market,
        fundType: fund,
        user: req.user
    });
});

// Post for sale route
app.get('/post-for-sale/:fundName', (req, res) => {
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
            return res.redirect('/bulletin-board?tab=listings&message=' + encodeURIComponent(`${investment['Fund Name']} is already posted for sale!`));
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
        
        postedInvestments.push(postedInvestment);
        savePostedInvestments(); // Save to file
        
        console.log('Investment posted for sale:', postedInvestment);
        
        // Redirect to bulletin board page with success message
        res.redirect('/bulletin-board?tab=listings&posted=' + encodeURIComponent(investment['Fund Name']));
        
    } catch (error) {
        console.error('Error posting investment for sale:', error);
        res.status(500).render('error', { 
            error: 'Failed to post investment for sale',
            message: error.message
        });
    }
});

// Remove investment from listings route
app.post('/remove-investment', requireAuth, (req, res) => {
    try {
        const { fundName } = req.body;
        
        if (!fundName) {
            return res.status(400).json({ 
                success: false, 
                message: 'Fund name is required' 
            });
        }
        
        // Find and remove the investment from posted investments
        const initialLength = postedInvestments.length;
        postedInvestments = postedInvestments.filter(investment => 
            investment.fundName.toLowerCase().trim() !== fundName.toLowerCase().trim()
        );
        
        if (postedInvestments.length < initialLength) {
            savePostedInvestments(); // Save to file after removal
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

// Messages Storage
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_FILE)) {
            const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
    return [];
}

function saveMessages(messages) {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving messages:', error);
        return false;
    }
}

// API endpoint to contact advisor about secondary market listing
app.post('/api/contact-advisor', requireAuth, (req, res) => {
    try {
        const userId = req.user.username;
        const userName = req.user.name; // e.g. "Erik Andersson - Stockholm, Sweden"
        const bankerFullName = req.user.banker || 'Your Private Banker'; // e.g. "Alexandra Steinberg - Senior Private Banker"
        const { fundName, listingId, clientMessage } = req.body;
        
        // Extract client's name only (e.g. "Erik Andersson" from "Erik Andersson - Stockholm, Sweden")
        const clientNameOnly = userName.split(' - ')[0];
        
        // Extract client's first name (e.g. "Erik" from "Erik Andersson - Stockholm, Sweden")
        const clientFirstName = userName.split(' ')[0];
        
        // Extract banker's name only (e.g. "Alexandra Steinberg" from "Alexandra Steinberg - Senior Private Banker")
        const bankerNameOnly = bankerFullName.split(' - ')[0];
        
        // Find the listing to get seller information
        const listing = postedInvestments.find(inv => inv.fundName === fundName);
        
        // Load existing messages
        const messages = loadMessages();
        
        // Create the client's sent message
        const clientMessageText = clientMessage || "I'm interested in this fund opportunity and would like to discuss it with you. Please review the fund details and let me know your thoughts.";
        const sentMessage = {
            id: 'MSG-' + Date.now() + '-sent',
            userId: userId,
            subject: `Inquiry about Listing #${listingId} — ${fundName}`,
            from: clientNameOnly,
            to: bankerNameOnly,
            date: new Date().toISOString(),
            preview: clientMessageText.substring(0, 100) + (clientMessageText.length > 100 ? '...' : ''),
            fullMessage: `Dear ${bankerNameOnly},

${clientMessageText}

Fund Details:
• Listing #${listingId}
• Fund: ${fundName}

Best regards,

${clientNameOnly}`,
            type: 'sent',
            unread: false
        };
        
        // Generate confirmation message from advisor to buyer
        const confirmationMessage = {
            id: 'MSG-' + (Date.now() + 1),
            userId: userId,
            subject: `Next steps on Listing #${listingId} — ${fundName}`,
            from: bankerNameOnly,
            to: clientNameOnly,
            date: new Date().toISOString(),
            preview: `Thank you for your interest in Listing #${listingId}. We will coordinate introductions off‑platform...`,
            fullMessage: `Dear ${clientFirstName},

Thank you for your interest in Listing #${listingId}.

We will coordinate introductions off‑platform. Before we proceed, please note:

• This notice board is execution‑only; it is not a trading venue.
• Negotiation and acceptance occur outside the platform (email/phone).
• Secondary interests are illiquid and may transact at a discount/premium to the last NAV.
• Transfers may require GP consent, may be subject to ROFR and transfer fees, and can be refused by the GP.
• Timing of capital calls/distributions can change and may affect settlement.

If you wish, I can introduce you to the seller to discuss terms.

Best regards,

${bankerNameOnly}
Private Banker
UBS Wealth Management`,
            type: 'inbox',
            unread: true
        };
        
        // Add buyer's messages
        messages.push(sentMessage);
        messages.push(confirmationMessage);
        
        // If we found the listing, also send notification to the seller and introduction to both parties
        if (listing && listing.sellerId) {
            const sellerFirstName = listing.sellerName.split(' ')[0];
            
            // Generate notification message to seller
            const sellerNotificationMessage = {
                id: 'MSG-' + (Date.now() + 2),
                userId: listing.sellerId,
                subject: `Potential buyer inquiry — Listing #${listingId} (${fundName})`,
                from: bankerNameOnly,
                to: listing.sellerName,
                date: new Date().toISOString(),
                preview: `We have a potential buyer for your Listing #${listingId}. If you remain interested in exploring a transfer...`,
                fullMessage: `Dear ${sellerFirstName},

We have a potential buyer for your Listing #${listingId}. If you remain interested in exploring a transfer, please confirm and share any updates since the last NAV (e.g., pending calls/distributions, consent status, or constraints).

As a reminder, negotiation and any acceptance occur off‑platform. Transfers typically require GP consent and may be subject to ROFR and fees.

Kind regards,

${bankerNameOnly}
Private Banker
UBS Wealth Management`,
                type: 'inbox',
                unread: true
            };
            
            messages.push(sellerNotificationMessage);
            
            // Calculate listing details for introduction email
            const commitment = listing.totalCommitment;
            const calledPercent = listing.calledPercent;
            const unfunded = listing.remaining;
            const currentValue = listing.currentValue;
            const navDate = listing.postedDate || new Date().toLocaleDateString('en-US');
            const gpFund = listing.type;
            
            // Create introduction email content
            const introEmailBody = `${clientNameOnly} — meet ${listing.sellerName}. Copying relevant details below. Please continue discussions off‑platform.

Key facts (from listing):
• Commitment: ${commitment} | % Called: ${calledPercent} | Unfunded: ${unfunded}
• Last NAV (date/amount): ${navDate} / ${currentValue}
• Transfer constraints: Requires GP consent, may be subject to ROFR and transfer fees
• Seller indication: Contact seller for pricing (non‑binding)

Important: This is an execution‑only introduction; the notice board is not a trading venue, and no offer/acceptance occurs here. Any transaction remains subject to GP consent and bank operational checks.

Best regards,

${bankerNameOnly}
Private Banker
UBS Wealth Management`;
            
            // Send introduction email to buyer
            const buyerIntroMessage = {
                id: 'MSG-' + (Date.now() + 3),
                userId: userId,
                subject: `Introduction re: Listing #${listingId} — ${fundName} / ${gpFund}`,
                from: bankerNameOnly,
                to: clientNameOnly,
                date: new Date().toISOString(),
                preview: `${clientNameOnly} — meet ${listing.sellerName}. Copying relevant details below...`,
                fullMessage: introEmailBody,
                type: 'inbox',
                unread: true
            };
            
            // Send introduction email to seller
            const sellerIntroMessage = {
                id: 'MSG-' + (Date.now() + 4),
                userId: listing.sellerId,
                subject: `Introduction re: Listing #${listingId} — ${fundName} / ${gpFund}`,
                from: bankerNameOnly,
                to: listing.sellerName,
                date: new Date().toISOString(),
                preview: `${clientNameOnly} — meet ${listing.sellerName}. Copying relevant details below...`,
                fullMessage: introEmailBody,
                type: 'inbox',
                unread: true
            };
            
            messages.push(buyerIntroMessage);
            messages.push(sellerIntroMessage);
        }
        
        // Save messages
        const success = saveMessages(messages);
        
        if (success) {
            res.json({ success: true, message: 'Message sent to your advisor' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send message' });
        }
    } catch (error) {
        console.error('Error contacting advisor:', error);
        res.status(500).json({ success: false, message: 'Error sending message' });
    }
});

// API endpoint to get user messages
app.get('/api/get-messages', requireAuth, (req, res) => {
    try {
        const userId = req.user.username;
        const messages = loadMessages();
        
        // Filter messages for this user
        const userMessages = messages.filter(msg => msg.userId === userId);
        
        res.json({ 
            success: true, 
            messages: userMessages
        });
    } catch (error) {
        console.error('Error loading messages:', error);
        res.status(500).json({ success: false, message: 'Error loading messages' });
    }
});

// API endpoint to delete a message
app.post('/api/delete-message', requireAuth, (req, res) => {
    try {
        const userId = req.user.username;
        const { messageId } = req.body;
        
        // Load messages
        let messages = loadMessages();
        
        // Filter out the message to delete (only if it belongs to the user)
        const filteredMessages = messages.filter(msg => !(msg.id === messageId && msg.userId === userId));
        
        if (filteredMessages.length < messages.length) {
            // Message was found and deleted
            const success = saveMessages(filteredMessages);
            if (success) {
                res.json({ success: true, message: 'Message deleted' });
            } else {
                res.status(500).json({ success: false, message: 'Failed to delete message' });
            }
        } else {
            res.status(404).json({ success: false, message: 'Message not found' });
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Error deleting message' });
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