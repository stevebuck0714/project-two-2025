/**
 * Google Analytics API Integration
 * Fetches real traffic data using Google Analytics Data API (GA4)
 */

const { google } = require('googleapis');

/**
 * Get real organic traffic data from Google Analytics
 * @param {string} propertyId - GA4 Property ID (e.g., "properties/123456789")
 * @param {object} credentials - OAuth credentials or service account key
 */
async function getOrganicTrafficData(propertyId, credentials) {
    try {
        // Initialize Google Analytics Data API
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/analytics.readonly']
        });

        const analyticsData = google.analyticsdata('v1beta');
        
        // Date ranges: current month and previous month
        const today = new Date();
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        
        // Format dates as YYYY-MM-DD
        const formatDate = (date) => date.toISOString().split('T')[0];
        
        // Get current month data
        const currentMonthResponse = await analyticsData.properties.runReport({
            auth,
            property: propertyId,
            requestBody: {
                dateRanges: [
                    {
                        startDate: formatDate(firstOfMonth),
                        endDate: formatDate(today)
                    }
                ],
                dimensions: [
                    { name: 'sessionDefaultChannelGroup' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'activeUsers' },
                    { name: 'averageSessionDuration' }
                ],
                dimensionFilter: {
                    filter: {
                        fieldName: 'sessionDefaultChannelGroup',
                        stringFilter: {
                            value: 'Organic Search'
                        }
                    }
                }
            }
        });
        
        // Get previous month data
        const previousMonthResponse = await analyticsData.properties.runReport({
            auth,
            property: propertyId,
            requestBody: {
                dateRanges: [
                    {
                        startDate: formatDate(firstOfLastMonth),
                        endDate: formatDate(lastOfLastMonth)
                    }
                ],
                dimensions: [
                    { name: 'sessionDefaultChannelGroup' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'activeUsers' }
                ],
                dimensionFilter: {
                    filter: {
                        fieldName: 'sessionDefaultChannelGroup',
                        stringFilter: {
                            value: 'Organic Search'
                        }
                    }
                }
            }
        });
        
        // Get top landing pages
        const landingPagesResponse = await analyticsData.properties.runReport({
            auth,
            property: propertyId,
            requestBody: {
                dateRanges: [
                    {
                        startDate: formatDate(firstOfMonth),
                        endDate: formatDate(today)
                    }
                ],
                dimensions: [
                    { name: 'landingPage' },
                    { name: 'pageTitle' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'bounceRate' }
                ],
                dimensionFilter: {
                    filter: {
                        fieldName: 'sessionDefaultChannelGroup',
                        stringFilter: {
                            value: 'Organic Search'
                        }
                    }
                },
                orderBys: [
                    {
                        metric: { metricName: 'sessions' },
                        desc: true
                    }
                ],
                limit: 5
            }
        });
        
        // Parse current month data
        const currentData = currentMonthResponse.data.rows?.[0] || {};
        const currentVisitors = parseInt(currentData.metricValues?.[1]?.value || 0);
        const avgSessionSeconds = parseFloat(currentData.metricValues?.[2]?.value || 0);
        
        // Parse previous month data
        const previousData = previousMonthResponse.data.rows?.[0] || {};
        const previousVisitors = parseInt(previousData.metricValues?.[1]?.value || 0);
        
        // Calculate growth
        const growth = previousVisitors > 0 
            ? Math.round(((currentVisitors - previousVisitors) / previousVisitors) * 100)
            : 0;
        
        // Parse landing pages
        const topPages = (landingPagesResponse.data.rows || []).map(row => ({
            page: row.dimensionValues[1].value || 'Untitled',
            url: row.dimensionValues[0].value,
            visits: parseInt(row.metricValues[0].value || 0),
            bounceRate: Math.round(parseFloat(row.metricValues[1].value || 0) * 100)
        }));
        
        // Format session duration
        const minutes = Math.floor(avgSessionSeconds / 60);
        const seconds = Math.floor(avgSessionSeconds % 60);
        
        return {
            monthlyVisitors: currentVisitors,
            growth: growth,
            topPages: topPages,
            avgSessionDuration: `${minutes}m ${seconds}s`,
            avgSessionSeconds: Math.floor(avgSessionSeconds),
            isRealData: true
        };
        
    } catch (error) {
        console.error('Error fetching Google Analytics data:', error.message);
        throw new Error(`Google Analytics API error: ${error.message}`);
    }
}

module.exports = {
    getOrganicTrafficData
};


