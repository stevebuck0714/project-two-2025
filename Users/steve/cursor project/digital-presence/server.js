// Digital Presence Analysis Server
const express = require('express');
const path = require('path');
const fs = require('fs');
const { analyzeCompany } = require('./api/analyzer');

const app = express();
const PORT = process.env.PORT || 3001;

// Storage directory for analysis results
const STORAGE_DIR = path.join(__dirname, 'analysis-storage');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Helper functions for persistent storage
function saveAnalysis(analysisId, data) {
    const filePath = path.join(STORAGE_DIR, `${analysisId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadAnalysis(analysisId) {
    const filePath = path.join(STORAGE_DIR, `${analysisId}.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/analytics', (req, res) => {
    // Serve the analytics page (results.html)
    res.sendFile(path.join(__dirname, 'views', 'results.html'));
});

app.get('/your-metrics', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'your-metrics.html'));
});

// Serve data files
app.get('/data/company-data.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'data', 'company-data.js'));
});

app.get('/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'reports.html'));
});

app.get('/input', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'analyze.html'));
});

app.get('/analyze', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'analyze.html'));
});

app.get('/test-results', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'test-results.html'));
});

// API endpoint for analysis
app.post('/api/analyze', async (req, res) => {
    try {
        console.log('Received analysis request:', req.body);
        
        // Run analysis
        const results = await analyzeCompany(req.body);
        
        // Store results persistently
        const analysisId = Date.now().toString();
        saveAnalysis(analysisId, results);
        
        console.log(`✅ Analysis saved with ID: ${analysisId}`);
        
        res.json({
            success: true,
            analysisId,
            message: 'Analysis complete'
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Analysis failed'
        });
    }
});

// API endpoint to list all analyses
app.get('/api/analyses', (req, res) => {
    try {
        const files = fs.readdirSync(STORAGE_DIR);
        const analyses = files
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const id = f.replace('.json', '');
                const data = loadAnalysis(id);
                return {
                    id,
                    companyName: data.companyName,
                    websiteUrl: data.websiteUrl,
                    analyzedAt: data.analyzedAt
                };
            })
            .sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
        
        res.json(analyses);
    } catch (error) {
        console.error('Error listing analyses:', error);
        res.status(500).json({ error: 'Could not list analyses' });
    }
});

// API endpoint to get analysis results
app.get('/api/analysis/:id', (req, res) => {
    const { id } = req.params;
    console.log(`📊 Fetching analysis results for ID: ${id}`);
    
    const results = loadAnalysis(id);
    
    if (results) {
        console.log(`✅ Found analysis for ${results.companyName}`);
        res.json(results);
    } else {
        console.log(`❌ Analysis not found for ID: ${id}`);
        res.status(404).json({ error: 'Analysis not found' });
    }
});

// API endpoint to get historical trends
app.get('/api/historical-trends/:id', (req, res) => {
    const { id } = req.params;
    console.log(`📈 Generating historical trends for analysis ID: ${id}`);
    
    const analysis = loadAnalysis(id);
    
    if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
    }
    
    // Generate 6 months of historical data
    // TODO: Replace with real API data when available
    const historicalData = generateHistoricalTrends(analysis);
    
    res.json(historicalData);
});

// Helper function to generate historical trends (estimated data)
// This will be replaced with real API calls when social media APIs are connected
function generateHistoricalTrends(currentAnalysis) {
    const months = [];
    const now = new Date();
    
    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
            monthIndex: date.getMonth(),
            year: date.getFullYear()
        });
    }
    
    const trends = {
        companyName: currentAnalysis.companyName,
        websiteUrl: currentAnalysis.websiteUrl,
        analyzedAt: currentAnalysis.analyzedAt,
        months: months.map(m => m.month),
        platforms: {}
    };
    
    // Generate historical data for each platform in the current analysis
    if (currentAnalysis.socialMetrics) {
        // Check if we have real GA4 data for website traffic trends
        if (currentAnalysis.organicTraffic && currentAnalysis.organicTraffic.isRealData) {
            console.log('📊 Including real GA4 website traffic data in historical trends');
            trends.websiteTraffic = generateWebsiteTrafficHistory(currentAnalysis.organicTraffic);
        }
        Object.entries(currentAnalysis.socialMetrics).forEach(([platform, currentData]) => {
            if (!currentData || !currentData.followers) return;
            
            const history = [];
            const currentFollowers = currentData.followers;
            const currentEngagement = currentData.engagement || 0;
            const avgMonthlyGrowth = currentData.growth ? currentData.growth / 100 : 0.05; // Default 5%
            
            // Work backwards from current month
            for (let i = 5; i >= 0; i--) {
                const monthsAgo = i;
                const isCurrentMonth = monthsAgo === 0;
                
                // Calculate historical followers (with some randomness for realism)
                const growthFactor = Math.pow(1 + avgMonthlyGrowth, -monthsAgo);
                const randomVariation = 0.95 + Math.random() * 0.1; // ±5% variation
                const followers = isCurrentMonth 
                    ? currentFollowers 
                    : Math.round(currentFollowers / (growthFactor * randomVariation));
                
                // Calculate engagement (with realistic variation)
                const engagementVariation = 0.8 + Math.random() * 0.4; // ±20% variation
                const engagement = isCurrentMonth
                    ? currentEngagement
                    : parseFloat((currentEngagement * engagementVariation).toFixed(1));
                
                // Calculate growth rate (compared to previous month)
                const prevFollowers = i < 5 ? history[history.length - 1]?.followers || followers : followers * 0.95;
                const growth = prevFollowers > 0 
                    ? parseFloat((((followers - prevFollowers) / prevFollowers) * 100).toFixed(1))
                    : 0;
                
                history.push({
                    month: months[5 - i].month,
                    followers: followers,
                    engagement: engagement,
                    growth: i === 5 ? 0 : growth, // First month has no prior comparison
                    posts: Math.floor(Math.random() * 15) + 8, // 8-22 posts per month
                    reach: Math.round(followers * (2 + Math.random() * 3)) // 2-5x follower reach
                });
            }
            
            trends.platforms[platform] = {
                accountUrl: currentData.accountUrl,
                history: history,
                currentFollowers: currentFollowers,
                currentEngagement: currentEngagement,
                sixMonthGrowth: parseFloat((((currentFollowers - history[0].followers) / history[0].followers) * 100).toFixed(1)),
                avgEngagement: parseFloat((history.reduce((sum, m) => sum + m.engagement, 0) / history.length).toFixed(1)),
                totalPosts: history.reduce((sum, m) => sum + m.posts, 0)
            };
        });
    }
    
    // Add overall metrics
    const allPlatforms = Object.values(trends.platforms);
    if (allPlatforms.length > 0) {
        trends.overall = {
            totalFollowers: allPlatforms.reduce((sum, p) => sum + p.currentFollowers, 0),
            avgEngagement: parseFloat((allPlatforms.reduce((sum, p) => sum + p.avgEngagement, 0) / allPlatforms.length).toFixed(1)),
            totalSixMonthGrowth: parseFloat((allPlatforms.reduce((sum, p) => sum + p.sixMonthGrowth, 0) / allPlatforms.length).toFixed(1)),
            activePlatforms: allPlatforms.length
        };
        
        // Monthly totals
        trends.monthlyTotals = months.map((m, idx) => {
            return {
                month: m.month,
                totalFollowers: allPlatforms.reduce((sum, p) => sum + (p.history[idx]?.followers || 0), 0),
                avgEngagement: parseFloat((allPlatforms.reduce((sum, p) => sum + (p.history[idx]?.engagement || 0), 0) / allPlatforms.length).toFixed(1)),
                totalPosts: allPlatforms.reduce((sum, p) => sum + (p.history[idx]?.posts || 0), 0)
            };
        });
    }
    
    trends.isEstimated = true; // Flag to indicate this is estimated data
    trends.note = trends.websiteTraffic
        ? "Historical data includes real website traffic from Google Analytics and estimated social media trends."
        : "Historical data is estimated based on current metrics. Connect real social media APIs for actual historical data.";

    console.log(`✅ Generated historical trends for ${allPlatforms.length} platforms${trends.websiteTraffic ? ' with real GA4 data' : ''}`);
    return trends;
}

/**
 * Generate historical website traffic data based on real GA4 data
 * This would be replaced with actual GA4 historical API calls when available
 */
function generateWebsiteTrafficHistory(currentTraffic) {
    const months = [];
    const now = new Date();

    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
            monthIndex: date.getMonth(),
            year: date.getFullYear()
        });
    }

    const history = [];
    const currentVisitors = currentTraffic.monthlyVisitors;
    const currentGrowth = currentTraffic.growth || 5; // Use provided growth or default 5%

    // Work backwards from current month using the growth rate
    for (let i = 5; i >= 0; i--) {
        const monthsAgo = i;
        const isCurrentMonth = monthsAgo === 0;

        if (isCurrentMonth) {
            history.push({
                month: months[5].month,
                visitors: currentVisitors,
                growth: 0,
                topPages: currentTraffic.topPages || [],
                avgSessionDuration: currentTraffic.avgSessionDuration || '0m 0s'
            });
        } else {
            // Calculate historical visitors using reverse growth
            const growthFactor = Math.pow(1 + (currentGrowth / 100), monthsAgo);
            const visitors = Math.round(currentVisitors / growthFactor);

            history.push({
                month: months[5 - i].month,
                visitors: visitors,
                growth: currentGrowth,
                topPages: [], // Would need historical page data from GA4
                avgSessionDuration: currentTraffic.avgSessionDuration || '0m 0s'
            });
        }
    }

    return {
        history: history,
        currentVisitors: currentVisitors,
        currentGrowth: currentGrowth,
        hasRealData: true
    };
}

// Start server
app.listen(PORT, () => {
    console.log(`Digital Presence server running on http://localhost:${PORT}`);
    console.log(`📁 Analysis storage directory: ${STORAGE_DIR}`);
});

