const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { parse: csvParse } = require('csv-parse');
const app = express();
// const port = 3001;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

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

// Function to read Excel file
function readExcelFile(filePath) {
    try {
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
                "Fund Name": "Lombard Odier SPV 1",
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
                totalValue: 1000000,
                totalInvestments: 15,
                averageInvestmentSize: 66666.67,
                totalCommitment: 1200000,
                assetAllocation: {
                    'Cash': 5.00,
                    'Marketable Securities': 60.00,
                    'Fixed Income': 15.00,
                    'Private Funds': 15.00,
                    'Hedge Funds': 5.00,
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
                { category: 'Private Equity', value: 400000, percentage: 40 },
                { category: 'Real Estate', value: 300000, percentage: 30 },
                { category: 'Infrastructure', value: 200000, percentage: 20 },
                { category: 'Hedge Funds', value: 100000, percentage: 10 }
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
    res.render('investment-opportunities');
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
        const filePath = path.join(__dirname, 'data', 'Fund cash flows 2.csv');
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const records = csvParse(csvContent, { skip_empty_lines: true });
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
            distributionsData
        });
    } catch (error) {
        console.error(error);
        res.render('fund-details', {
            capitalCalledData: [],
            distributionsData: []
        });
    }
});

app.get('/create-bid', (req, res) => {
    res.render('create-bid');
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

// Start server with port retry logic
function startServer(port) {
    console.log('About to start server on port', port);
    const server = app.listen(port, '0.0.0.0')
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is busy, trying ${port + 1}`);
                startServer(port + 1);
            } else {
                console.error('Server error:', err);
            }
        })
        .on('listening', () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    console.log('app.listen called, waiting for events...');
}

// Start server on port 3001, will automatically try next port if busy
startServer(port);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 