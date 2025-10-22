/**
 * API Credentials Loader
 * Loads API credentials from config file with fallback to environment variables
 */

const fs = require('fs');
const path = require('path');

let credentials = null;

/**
 * Load API credentials from file or environment
 */
function loadCredentials() {
    if (credentials) {
        return credentials;
    }
    
    // Try to load from config file
    const configPath = path.join(__dirname, 'api-credentials.json');
    
    if (fs.existsSync(configPath)) {
        try {
            credentials = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log('✅ API credentials loaded from config file');
            return credentials;
        } catch (error) {
            console.error('❌ Error loading API credentials:', error.message);
        }
    }
    
    // Fallback to environment variables
    credentials = {
        googleAnalytics: {
            enabled: process.env.GA_ENABLED === 'true',
            propertyId: process.env.GA_PROPERTY_ID,
            credentials: process.env.GA_CREDENTIALS ? JSON.parse(process.env.GA_CREDENTIALS) : null
        },
        googleSearchConsole: {
            enabled: process.env.GSC_ENABLED === 'true',
            siteUrl: process.env.GSC_SITE_URL,
            credentials: process.env.GSC_CREDENTIALS ? JSON.parse(process.env.GSC_CREDENTIALS) : null
        },
        facebook: {
            enabled: process.env.FB_ENABLED === 'true',
            accessToken: process.env.FB_ACCESS_TOKEN,
            pageId: process.env.FB_PAGE_ID
        },
        instagram: {
            enabled: process.env.IG_ENABLED === 'true',
            accessToken: process.env.IG_ACCESS_TOKEN,
            accountId: process.env.IG_ACCOUNT_ID
        },
        twitter: {
            enabled: process.env.TWITTER_ENABLED === 'true',
            bearerToken: process.env.TWITTER_BEARER_TOKEN
        },
        linkedin: {
            enabled: process.env.LINKEDIN_ENABLED === 'true',
            accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
            organizationId: process.env.LINKEDIN_ORG_ID
        }
    };
    
    console.log('⚠️  No API credentials file found. Using environment variables or falling back to estimated data.');
    return credentials;
}

/**
 * Check if a specific API is enabled and configured
 */
function isApiEnabled(apiName) {
    const creds = loadCredentials();
    return creds[apiName]?.enabled === true && hasRequiredCredentials(apiName);
}

/**
 * Check if all required credentials are present for an API
 */
function hasRequiredCredentials(apiName) {
    const creds = loadCredentials();
    const api = creds[apiName];
    
    if (!api) return false;
    
    switch (apiName) {
        case 'googleAnalytics':
            return !!api.propertyId && !!api.credentials;
        case 'googleSearchConsole':
            return !!api.siteUrl && !!api.credentials;
        case 'facebook':
        case 'instagram':
            return !!api.accessToken && (api.pageId || api.accountId);
        case 'twitter':
            return !!api.bearerToken;
        case 'linkedin':
            return !!api.accessToken && !!api.organizationId;
        default:
            return false;
    }
}

/**
 * Get credentials for a specific API
 */
function getApiCredentials(apiName) {
    const creds = loadCredentials();
    return creds[apiName] || null;
}

module.exports = {
    loadCredentials,
    isApiEnabled,
    getApiCredentials,
    hasRequiredCredentials
};


