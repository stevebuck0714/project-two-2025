const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// Store for posted investments (in memory for now)
let postedInvestments = [];

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
    
    postedInvestments = uniqueInvestments;
    console.log('Removed duplicates. Current posted investments:', postedInvestments.length);
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).send('Something broke!');
});

// Middleware to pass current path to all views
app.use((req, res, next) => {
    res.locals.path = req.path;
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
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/briefing', (req, res) => {
    // Sample data for the briefing page
    const briefingData = {
        portfolioNAV: 8750000,
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

app.get('/portfolio', (req, res) => {
    res.render('portfolio');
});

app.get('/portfolio-summary', (req, res) => {
    try {
        // Read portfolio data
        const portfolio1 = readExcelFile(path.join(__dirname, 'data', 'portfolio1.xlsx'));
        const portfolio2 = readExcelFile(path.join(__dirname, 'data', 'portfolio2.xlsx'));

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
            formatNumber // Pass formatNumber explicitly
        });
    } catch (error) {
        console.error('Error loading portfolio data:', error);
        res.status(500).render('error', { error: 'Failed to load portfolio data' });
    }
});

app.get('/liquidity-summary', (req, res) => {
    res.render('liquidity-summary');
});

app.get('/portfolio-builder', (req, res) => {
    res.render('portfolio-builder');
});

app.get('/investment-opportunities', (req, res) => {
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
    
    res.render('investment-opportunities', {
        postedInvestments: postedInvestments,
        activeTab: tab,
        successMessage: displayMessage,
        isError: !!message && !postedFund // Flag to show error styling
    });
});

app.get('/transactions', (req, res) => {
    res.render('transactions');
});

app.get('/messages', (req, res) => {
    res.render('messages');
});

app.get('/support', (req, res) => {
    res.render('support');
});

app.get('/fund-details', async (req, res) => {
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

app.get('/create-bid', (req, res) => {
    res.render('create-bid');
});

app.get('/contact-advisor', (req, res) => {
    // Get URL parameters to pass fund information
    const market = req.query.market || 'secondary';
    const fund = req.query.fund || 'buyout';
    
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
    
    const currentFund = fundData[market]?.[fund] || fundData.secondary.buyout;
    
    res.render('contact-advisor', {
        fundInfo: currentFund,
        market: market,
        fundType: fund
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
            return res.redirect('/investment-opportunities?tab=listings&message=' + encodeURIComponent(`${investment['Fund Name']} is already posted for sale!`));
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
        
        console.log('Investment posted for sale:', postedInvestment);
        
        // Redirect to investment opportunities page with success message
        res.redirect('/investment-opportunities?tab=listings&posted=' + encodeURIComponent(investment['Fund Name']));
        
    } catch (error) {
        console.error('Error posting investment for sale:', error);
        res.status(500).render('error', { 
            error: 'Failed to post investment for sale',
            message: error.message
        });
    }
});

// Investment details route
app.get('/investment-details/:fundName', (req, res) => {
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
        
        res.render('investment-details', {
            investment,
            kpis,
            portfolioNumber,
            fundName: investment['Fund Name']
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

// Risk/Return Profile page
app.get('/risk-return-profile', (req, res) => {
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
app.get('/esg-framework', (req, res) => {
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
app.get('/fund-manager-attributes', (req, res) => {
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
app.get('/commitment-criteria', (req, res) => {
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