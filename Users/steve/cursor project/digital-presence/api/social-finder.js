// Automatic Social Media Account Finder
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Automatically discover social media accounts for a company
 * Checks website for social links and tries common patterns
 */
async function findSocialMediaAccounts(companyName, websiteUrl) {
    console.log(`Searching for social media accounts for: ${companyName}`);
    
    const results = {
        facebook: null,
        linkedin: null,
        twitter: null,
        instagram: null,
        tiktok: null,
        snapchat: null,
        reddit: null,
        yelp: null,
        bluesky: null
    };

    try {
        // Strategy 1: Scrape website for social media links
        const websiteLinks = await scrapeSocialLinksFromWebsite(websiteUrl);
        Object.assign(results, websiteLinks);

        // Strategy 2: Try common URL patterns for missing accounts
        if (!results.facebook) {
            results.facebook = await tryCommonPatterns('facebook', companyName, websiteUrl);
        }
        if (!results.twitter) {
            results.twitter = await tryCommonPatterns('twitter', companyName, websiteUrl);
        }
        if (!results.linkedin) {
            results.linkedin = await tryCommonPatterns('linkedin', companyName, websiteUrl);
        }
        if (!results.instagram) {
            results.instagram = await tryCommonPatterns('instagram', companyName, websiteUrl);
        }
        if (!results.tiktok) {
            results.tiktok = await tryCommonPatterns('tiktok', companyName, websiteUrl);
        }
        if (!results.snapchat) {
            results.snapchat = await tryCommonPatterns('snapchat', companyName, websiteUrl);
        }
        if (!results.reddit) {
            results.reddit = await tryCommonPatterns('reddit', companyName, websiteUrl);
        }
        if (!results.yelp) {
            results.yelp = await tryCommonPatterns('yelp', companyName, websiteUrl);
        }
        if (!results.bluesky) {
            results.bluesky = await tryCommonPatterns('bluesky', companyName, websiteUrl);
        }

        console.log('Found social media accounts:', results);
        return results;

    } catch (error) {
        console.error('Error finding social media accounts:', error.message);
        return results;
    }
}

/**
 * Scrape the company website to find social media links
 */
async function scrapeSocialLinksFromWebsite(websiteUrl) {
    const found = {
        facebook: null,
        linkedin: null,
        twitter: null,
        instagram: null,
        tiktok: null,
        snapchat: null,
        reddit: null,
        yelp: null,
        bluesky: null
    };

    try {
        const response = await axios.get(websiteUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        // Find all links on the page
        $('a[href]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (!href) return;

            // Match social media URLs
            if (href.match(/facebook\.com\/([^\/\?]+)/i) && !found.facebook) {
                const match = href.match(/facebook\.com\/([^\/\?]+)/i);
                if (match && !match[1].includes('sharer') && !match[1].includes('plugins')) {
                    found.facebook = `https://facebook.com/${match[1]}`;
                }
            }
            
            if ((href.match(/twitter\.com\/([^\/\?]+)/i) || href.match(/x\.com\/([^\/\?]+)/i)) && !found.twitter) {
                const match = href.match(/(?:twitter|x)\.com\/([^\/\?]+)/i);
                if (match && !match[1].includes('intent') && !match[1].includes('share')) {
                    found.twitter = `https://twitter.com/${match[1]}`;
                }
            }
            
            if (href.match(/linkedin\.com\/company\/([^\/\?]+)/i) && !found.linkedin) {
                const match = href.match(/linkedin\.com\/company\/([^\/\?]+)/i);
                if (match && !match[1].includes('shareArticle')) {
                    found.linkedin = `https://linkedin.com/company/${match[1]}`;
                }
            }
            
            if (href.match(/instagram\.com\/([^\/\?]+)/i) && !found.instagram) {
                const match = href.match(/instagram\.com\/([^\/\?]+)/i);
                if (match && match[1] !== 'accounts') {
                    found.instagram = `https://instagram.com/${match[1]}`;
                }
            }
            
            if (href.match(/tiktok\.com\/@?([^\/\?]+)/i) && !found.tiktok) {
                const match = href.match(/tiktok\.com\/@?([^\/\?]+)/i);
                if (match) {
                    found.tiktok = `https://tiktok.com/@${match[1]}`;
                }
            }
            
            if (href.match(/snapchat\.com\/add\/([^\/\?]+)/i) && !found.snapchat) {
                const match = href.match(/snapchat\.com\/add\/([^\/\?]+)/i);
                if (match) {
                    found.snapchat = `https://snapchat.com/add/${match[1]}`;
                }
            }
            
            if (href.match(/reddit\.com\/(r|user)\/([^\/\?]+)/i) && !found.reddit) {
                const match = href.match(/reddit\.com\/(r|user)\/([^\/\?]+)/i);
                if (match) {
                    found.reddit = `https://reddit.com/${match[1]}/${match[2]}`;
                }
            }
            
            if (href.match(/yelp\.com\/biz\/([^\/\?]+)/i) && !found.yelp) {
                const match = href.match(/yelp\.com\/biz\/([^\/\?]+)/i);
                if (match) {
                    found.yelp = `https://yelp.com/biz/${match[1]}`;
                }
            }
            
            if (href.match(/bsky\.app\/profile\/([^\/\?]+)/i) && !found.bluesky) {
                const match = href.match(/bsky\.app\/profile\/([^\/\?]+)/i);
                if (match) {
                    found.bluesky = `https://bsky.app/profile/${match[1]}`;
                }
            }
        });

        console.log('Found from website:', found);
        return found;

    } catch (error) {
        console.log('Could not scrape website for social links:', error.message);
        return found;
    }
}

/**
 * Try common URL patterns for social media
 */
async function tryCommonPatterns(platform, companyName, websiteUrl) {
    // Clean company name for URL
    const cleanName = companyName
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')
        .replace(/^www\./, '') // Remove www. prefix if present
        .substring(0, 30);

    // Get domain name from website
    let domainName = '';
    try {
        // Ensure URL has protocol for parsing
        const urlWithProtocol = websiteUrl.includes('://') ? websiteUrl : `https://${websiteUrl}`;
        const url = new URL(urlWithProtocol);
        domainName = url.hostname.replace('www.', '').split('.')[0];
    } catch (e) {
        domainName = cleanName;
    }

    const patterns = {
        facebook: [
            `https://facebook.com/${cleanName}`,
            `https://facebook.com/${domainName}`,
            `https://facebook.com/${companyName.replace(/\s+/g, '').toLowerCase().replace(/^www\./, '')}`
        ],
        twitter: [
            `https://twitter.com/${cleanName}`,
            `https://twitter.com/${domainName}`,
            `https://x.com/${cleanName}`,
            `https://x.com/${domainName}`
        ],
        linkedin: [
            `https://linkedin.com/company/${cleanName}`,
            `https://linkedin.com/company/${domainName}`,
            `https://linkedin.com/company/${companyName.replace(/\s+/g, '-').toLowerCase().replace(/^www\./, '')}`
        ],
        instagram: [
            `https://instagram.com/${cleanName}`,
            `https://instagram.com/${domainName}`
        ],
        tiktok: [
            `https://tiktok.com/@${cleanName}`,
            `https://tiktok.com/@${domainName}`
        ],
        snapchat: [
            `https://snapchat.com/add/${cleanName}`,
            `https://snapchat.com/add/${domainName}`
        ],
        reddit: [
            `https://reddit.com/r/${cleanName}`,
            `https://reddit.com/r/${domainName}`,
            `https://reddit.com/user/${cleanName}`
        ],
        yelp: [
            `https://yelp.com/biz/${cleanName}`,
            `https://yelp.com/biz/${domainName}`,
            `https://yelp.com/biz/${companyName.replace(/\s+/g, '-').toLowerCase().replace(/^www\./, '')}`
        ],
        bluesky: [
            `https://bsky.app/profile/${cleanName}.bsky.social`,
            `https://bsky.app/profile/${domainName}.bsky.social`
        ]
    };

    if (!patterns[platform]) return null;

    // Try each pattern
    for (const url of patterns[platform]) {
        try {
            // Quick HEAD request to check if URL exists
            const response = await axios.head(url, {
                timeout: 5000,
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });

            if (response.status === 200) {
                console.log(`✓ Found ${platform}: ${url}`);
                return url;
            }
        } catch (error) {
            // URL doesn't exist or error, continue to next pattern
            continue;
        }
    }

    console.log(`✗ Could not find ${platform} account automatically`);
    return null;
}

/**
 * Validate if a social media URL actually exists
 */
async function validateSocialUrl(url) {
    try {
        const response = await axios.head(url, {
            timeout: 5000,
            maxRedirects: 5,
            validateStatus: (status) => status < 400
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

/**
 * Format social media URL to standard format
 */
function formatSocialUrl(url, platform) {
    if (!url) return null;
    
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        
        switch (platform) {
            case 'facebook':
                return `https://facebook.com${path}`;
            case 'twitter':
                return `https://twitter.com${path}`;
            case 'linkedin':
                return `https://linkedin.com${path}`;
            case 'instagram':
                return `https://instagram.com${path}`;
            default:
                return url;
        }
    } catch (e) {
        return url;
    }
}

module.exports = {
    findSocialMediaAccounts,
    scrapeSocialLinksFromWebsite,
    tryCommonPatterns,
    validateSocialUrl,
    formatSocialUrl
};

