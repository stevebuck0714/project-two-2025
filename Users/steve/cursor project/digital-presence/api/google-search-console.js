/**
 * Google Search Console API Integration
 * Fetches real SEO ranking data
 */

const { google } = require('googleapis');

/**
 * Get real SEO ranking data from Google Search Console
 * @param {string} siteUrl - Website URL (e.g., "https://example.com")
 * @param {object} credentials - OAuth credentials or service account key
 */
async function getSEORankingData(siteUrl, credentials) {
    try {
        // Initialize Google Search Console API
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
        });

        const searchConsole = google.webmasters('v3');
        
        // Date range: last 28 days
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1); // Yesterday
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 28);
        
        // Format dates as YYYY-MM-DD
        const formatDate = (date) => date.toISOString().split('T')[0];
        
        // Get top queries (keywords) with their rankings
        const response = await searchConsole.searchanalytics.query({
            auth,
            siteUrl: siteUrl,
            requestBody: {
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
                dimensions: ['query'],
                rowLimit: 10,
                dimensionFilterGroups: []
            }
        });
        
        // Parse keywords
        const keywords = (response.data.rows || []).map(row => {
            const position = Math.round(row.position);
            
            // Determine trend (simplified - would need historical data for real trends)
            let trend = 'flat';
            if (position <= 3) trend = 'up';
            else if (position >= 15) trend = 'down';
            
            return {
                keyword: row.keys[0],
                rank: position,
                trend: trend,
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: (row.ctr * 100).toFixed(1)
            };
        }).slice(0, 5); // Top 5 keywords
        
        // Calculate average position
        const avgPosition = keywords.length > 0
            ? Math.round(keywords.reduce((sum, k) => sum + k.rank, 0) / keywords.length)
            : 50;
        
        // Calculate SEO score based on average position
        // Position 1-3 = 90-100 score
        // Position 4-10 = 70-89 score
        // Position 11-20 = 50-69 score
        // Position 20+ = 30-49 score
        let seoScore;
        if (avgPosition <= 3) seoScore = 100 - (avgPosition - 1) * 3;
        else if (avgPosition <= 10) seoScore = 89 - (avgPosition - 4) * 3;
        else if (avgPosition <= 20) seoScore = 69 - (avgPosition - 11) * 2;
        else seoScore = Math.max(30, 50 - (avgPosition - 20));
        
        return {
            keywords: keywords,
            seoScore: Math.round(seoScore),
            avgPosition: avgPosition,
            isRealData: true
        };
        
    } catch (error) {
        console.error('Error fetching Search Console data:', error.message);
        throw new Error(`Google Search Console API error: ${error.message}`);
    }
}

module.exports = {
    getSEORankingData
};


