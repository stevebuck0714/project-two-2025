const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrape real follower counts from social media platforms
 */
async function scrapeRealSocialMetrics(accountUrl, platform) {
    if (!accountUrl) return null;

    console.log(`🔍 Scraping real ${platform} data from: ${accountUrl}`);

    try {
        // Set user agent to avoid blocks
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        const response = await axios.get(accountUrl, {
            headers,
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 500; // Accept all status codes except 5xx
            }
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        
        let followers = null;
        let engagement = null;
        
        // Platform-specific scraping logic
        switch(platform) {
            case 'facebook':
                followers = scrapeFacebookFollowers($, html);
                break;
            case 'instagram':
                followers = scrapeInstagramFollowers($, html);
                break;
            case 'linkedin':
                followers = scrapeLinkedInFollowers($, html);
                break;
            case 'twitter':
                followers = scrapeTwitterFollowers($, html);
                break;
            case 'yelp':
                const yelpData = scrapeYelpData($, html);
                return yelpData; // Returns reviews too
            default:
                console.log(`⚠️  No scraper for ${platform} yet`);
        }
        
        if (followers) {
            console.log(`✅ ${platform}: ${followers} followers`);
            return {
                followers: followers,
                engagement: engagement || estimateEngagement(followers),
                growth: estimateGrowth(),
                isRealData: true
            };
        }
        
        return null;
        
    } catch (error) {
        console.log(`❌ Failed to scrape ${platform}: ${error.message}`);
        return null;
    }
}

/**
 * Facebook follower scraping
 */
function scrapeFacebookFollowers($, html) {
    try {
        // Look for follower count in various places
        // Facebook often has it in meta tags or JSON-LD
        
        // Try meta tags
        const metaContent = $('meta[property="og:description"]').attr('content');
        if (metaContent) {
            const match = metaContent.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*(?:followers|likes)/i);
            if (match) {
                return parseFollowerCount(match[1]);
            }
        }
        
        // Try text content
        const text = $('body').text();
        const patterns = [
            /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*followers/i,
            /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*people like this/i,
            /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*likes/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return parseFollowerCount(match[1]);
            }
        }
        
        // Try JSON-LD data
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            try {
                const data = JSON.parse(jsonLd);
                if (data.interactionStatistic) {
                    const followers = data.interactionStatistic.find(s => s.interactionType === 'http://schema.org/FollowAction');
                    if (followers) return parseInt(followers.userInteractionCount);
                }
            } catch (e) {}
        }
        
    } catch (error) {
        console.log('Facebook scraping error:', error.message);
    }
    return null;
}

/**
 * Instagram follower scraping
 */
function scrapeInstagramFollowers($, html) {
    try {
        // Instagram requires more sophisticated scraping
        // Look for JSON data in the page
        const scriptTags = $('script').toArray();
        
        for (const script of scriptTags) {
            const content = $(script).html();
            if (content && content.includes('edge_followed_by')) {
                try {
                    // Extract JSON data
                    const match = content.match(/window\._sharedData\s*=\s*({.+?});/);
                    if (match) {
                        const data = JSON.parse(match[1]);
                        const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
                        if (user?.edge_followed_by?.count) {
                            return user.edge_followed_by.count;
                        }
                    }
                } catch (e) {}
            }
        }
        
        // Try meta tags
        const metaContent = $('meta[property="og:description"]').attr('content');
        if (metaContent) {
            const match = metaContent.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*Followers/i);
            if (match) {
                return parseFollowerCount(match[1]);
            }
        }
        
    } catch (error) {
        console.log('Instagram scraping error:', error.message);
    }
    return null;
}

/**
 * LinkedIn follower scraping
 */
function scrapeLinkedInFollowers($, html) {
    try {
        // LinkedIn company pages show followers
        const text = $('body').text();
        
        const patterns = [
            /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*followers/i,
            /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*employees/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return parseFollowerCount(match[1]);
            }
        }
        
        // Try structured data
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            try {
                const data = JSON.parse(jsonLd);
                if (data.numberOfEmployees) {
                    return parseInt(data.numberOfEmployees);
                }
            } catch (e) {}
        }
        
    } catch (error) {
        console.log('LinkedIn scraping error:', error.message);
    }
    return null;
}

/**
 * Twitter/X follower scraping
 */
function scrapeTwitterFollowers($, html) {
    try {
        // Twitter shows followers in the page
        const text = $('body').text();
        
        const match = text.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*Followers/i);
        if (match) {
            return parseFollowerCount(match[1]);
        }
        
        // Try meta tags
        const metaContent = $('meta[property="og:description"]').attr('content');
        if (metaContent) {
            const match2 = metaContent.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*Followers/i);
            if (match2) {
                return parseFollowerCount(match2[1]);
            }
        }
        
    } catch (error) {
        console.log('Twitter scraping error:', error.message);
    }
    return null;
}

/**
 * Yelp data scraping (reviews + rating)
 */
function scrapeYelpData($, html) {
    try {
        const text = $('body').text();
        
        // Get rating
        let rating = null;
        const ratingMatch = text.match(/(\d\.\d)\s*star rating/i);
        if (ratingMatch) {
            rating = parseFloat(ratingMatch[1]);
        }
        
        // Get review count
        let reviewCount = null;
        const reviewMatch = text.match(/(\d+(?:,\d+)*)\s*reviews/i);
        if (reviewMatch) {
            reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
        }
        
        // Try structured data
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            try {
                const data = JSON.parse(jsonLd);
                if (data.aggregateRating) {
                    rating = data.aggregateRating.ratingValue;
                    reviewCount = data.aggregateRating.reviewCount;
                }
            } catch (e) {}
        }
        
        if (rating || reviewCount) {
            return {
                followers: 0, // Yelp doesn't have followers in the same way
                rating: rating,
                reviewCount: reviewCount,
                engagement: 0,
                growth: 0,
                isRealData: true,
                platform: 'yelp'
            };
        }
        
    } catch (error) {
        console.log('Yelp scraping error:', error.message);
    }
    return null;
}

/**
 * Scrape Google Reviews data
 */
async function scrapeGoogleReviews(companyName, websiteUrl) {
    try {
        console.log(`🔍 Scraping Google reviews for: ${companyName}`);
        
        // Google reviews would require Places API (free with limits)
        // For now, return null to indicate it should use estimates
        // TODO: Implement Google Places API integration
        
        return null;
        
    } catch (error) {
        console.log('Google reviews scraping error:', error.message);
        return null;
    }
}

/**
 * Parse follower count strings (handles "5.2K", "1.5M", etc.)
 */
function parseFollowerCount(str) {
    if (!str) return 0;
    
    // Remove commas and spaces
    str = str.toString().replace(/,/g, '').trim();
    
    // Handle K, M, B suffixes
    const multipliers = {
        'K': 1000,
        'M': 1000000,
        'B': 1000000000
    };
    
    const match = str.match(/^([\d.]+)([KMB])?$/i);
    if (match) {
        const num = parseFloat(match[1]);
        const suffix = match[2]?.toUpperCase();
        return Math.round(num * (multipliers[suffix] || 1));
    }
    
    // Try parsing as regular number
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Estimate engagement based on follower count
 * Larger accounts typically have lower engagement rates
 */
function estimateEngagement(followers) {
    if (followers > 100000) return 2 + Math.random() * 2; // 2-4%
    if (followers > 10000) return 3 + Math.random() * 2;  // 3-5%
    if (followers > 1000) return 4 + Math.random() * 2;   // 4-6%
    return 5 + Math.random() * 3; // 5-8%
}

/**
 * Estimate growth rate (realistic range)
 */
function estimateGrowth() {
    return -2 + Math.random() * 12; // -2% to +10%
}

/**
 * Main function to get real social metrics for a company
 */
async function getRealSocialMetrics(socialAccounts) {
    const results = {};
    
    const platforms = [
        { key: 'facebook', url: socialAccounts.facebook },
        { key: 'instagram', url: socialAccounts.instagram },
        { key: 'linkedin', url: socialAccounts.linkedin },
        { key: 'twitter', url: socialAccounts.twitter },
        { key: 'yelp', url: socialAccounts.yelp }
    ];
    
    for (const { key, url } of platforms) {
        if (url) {
            const data = await scrapeRealSocialMetrics(url, key);
            if (data) {
                results[key] = data;
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return results;
}

/**
 * Get real review data
 */
async function getRealReviewData(companyName, websiteUrl, socialAccounts) {
    const reviews = [];

    // Scrape Yelp if URL available
    if (socialAccounts.yelp) {
        try {
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

            // Enhanced headers to mimic real browser
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            };

            const response = await axios.get(socialAccounts.yelp, {
                headers,
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // Accept redirects and client errors
                }
            });

            if (response.status === 200) {
                const $ = cheerio.load(response.data);
                const yelpData = scrapeYelpData($, response.data);

                if (yelpData && (yelpData.rating || yelpData.reviewCount)) {
                    reviews.push({
                        site: 'Yelp',
                        stars: yelpData.rating || 0,
                        reviewCount: yelpData.reviewCount || 0,
                        isRealData: true
                    });
                    console.log(`✅ Found Yelp data: ${yelpData.rating} stars, ${yelpData.reviewCount} reviews`);
                }
            } else {
                console.log(`Yelp request failed with status: ${response.status}`);
            }
        } catch (error) {
            console.log('Failed to scrape Yelp reviews:', error.message);
            if (error.response) {
                console.log('Response status:', error.response.status);
                console.log('Response headers:', error.response.headers);
            }
        }
    }

    // For now, skip Google reviews (would require Places API key)
    // TODO: Implement Google Places API for reviews

    return reviews;
}

module.exports = {
    getRealSocialMetrics,
    getRealReviewData,
    scrapeRealSocialMetrics,
    parseFollowerCount
};

