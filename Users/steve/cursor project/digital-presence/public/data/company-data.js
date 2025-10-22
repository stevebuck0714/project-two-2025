// Company Digital Presence Data Configuration
// Update this file with your company's actual data

const companyData = {
    // ===== COMPANY INFO =====
    companyName: "Your Company Name",
    dateRangeLabel: "Last 30 days",
    
    // ===== SOCIAL MEDIA METRICS =====
    // Update with your actual follower counts and engagement rates
    socialMetrics: [
        {
            platform: "Facebook",
            followers: 20000,
            engagementRate: 4.2,  // percentage (4.2 = 4.2%)
            monthlyGrowth: 12      // percentage (+12 = +12%)
        },
        {
            platform: "𝕏 (Twitter)",
            followers: 8500,
            engagementRate: 3.8,
            monthlyGrowth: 9
        },
        {
            platform: "LinkedIn",
            followers: 12000,
            engagementRate: 4.5,
            monthlyGrowth: 11
        },
        {
            platform: "Instagram",
            followers: 15000,
            engagementRate: 5.1,
            monthlyGrowth: 13
        }
    ],
    
    // ===== OVERALL METRICS =====
    overallEngagement: 4.2,     // Average across all platforms
    overallGrowth: 12,          // Average monthly growth
    digitalPresenceScore: 75,   // Your overall score (0-100)
    
    // ===== COMPETITOR BENCHMARKING =====
    // Compare your digital presence against competitors
    competitors: [
        { name: "You", score: 75 },
        { name: "Competitor A", score: 92 },
        { name: "Competitor B", score: 58 },
        { name: "Competitor C", score: 48 }
    ],
    
    // ===== DIGITAL FOOTPRINT =====
    // Score each category from 0-100
    digitalFootprint: {
        brand: 74,   // Brand awareness & recognition
        web: 68,     // Website performance & traffic
        seo: 81,     // Search engine optimization
        review: 88,  // Online reviews & ratings
        social: 72   // Social media presence
    },
    
    // ===== REPUTATION MONITORING =====
    // Your star ratings on review platforms
    reputation: [
        { site: "Google", stars: 4.8 },
        { site: "Yelp", stars: 4.5 },
        { site: "Facebook", stars: 4.9 }
    ],
    
    // ===== SENTIMENT ANALYSIS =====
    positiveSentiment: 80,  // Percentage of positive mentions (0-100)
    
    // ===== SEO KEYWORDS =====
    // Your top ranking keywords
    seoKeywords: [
        { keyword: "digital marketing", rank: 3, trend: "up" },      // trend: "up", "down", or "flat"
        { keyword: "business analytics", rank: 5, trend: "up" },
        { keyword: "financial reporting", rank: 8, trend: "flat" }
    ],
    
    // ===== KEY METRICS =====
    keyMetrics: {
        avgEngagement: "4.2%",
        monthlyGrowth: "+12%",
        brandMentions: "+9%",
        organicTraffic: "↑"  // Use: ↑, ↓, or →
    },
    
    // ===== RECOMMENDATIONS =====
    // Prioritized action items
    recommendations: [
        {
            category: "Content",
            action: "Publish 3 thought-leadership posts/week on LinkedIn; add 1 case study/month.",
            impact: "high"  // Options: "high", "medium", "low"
        },
        {
            category: "SEO",
            action: "Target 10 mid-intent keywords; refresh 5 legacy posts with internal links.",
            impact: "medium"
        },
        {
            category: "Reputation",
            action: "Automate post-purchase review asks; respond within 24h.",
            impact: "high"
        },
        {
            category: "Social",
            action: "Shift 20% budget to short-form video experiments.",
            impact: "medium"
        },
        {
            category: "Competitive",
            action: "Add feature comparison page; capture competitor alt-brand traffic.",
            impact: "low"
        },
        {
            category: "Budget",
            action: "Reallocate 15% from under-performing display to branded search.",
            impact: "high"
        }
    ]
};

// Calculate total followers
companyData.totalFollowers = companyData.socialMetrics.reduce((sum, platform) => sum + platform.followers, 0);


