# Quick Start: Running for a Real Company

## 🎯 Two Options Available

### Option 1: Easy Config File (Recommended)
**Best for**: Quick setup, easy updates, single company

✅ **Steps:**
1. Edit `/public/data/company-data.js`
2. Update all values with your company's actual data
3. Visit: http://localhost:3001/dynamic-analytics

**Example:**
```javascript
const companyData = {
    companyName: "Acme Corporation",  // ← Your company name
    socialMetrics: [
        {
            platform: "Facebook",
            followers: 35000,          // ← Your actual data
            engagementRate: 5.8,
            monthlyGrowth: 15
        },
        // ... add your other platforms
    ],
    // ... update all sections
};
```

### Option 2: Static HTML
**Best for**: One-time setup, no configuration needed

✅ **Steps:**
1. Edit `/views/analytics.html`
2. Find and replace all data values directly in HTML
3. Visit: http://localhost:3001/analytics

---

## 📊 Where to Get Your Data

### Social Media
- **Facebook**: Meta Business Suite → Insights → Overview
- **Instagram**: Business Profile → Insights → Audience
- **LinkedIn**: Company Page → Analytics → Visitors
- **Twitter/X**: Analytics → Dashboard → Audience

### Reviews & Ratings
- **Google**: Google Business Profile dashboard
- **Yelp**: Business account → Reviews
- **Facebook**: Page → Reviews

### SEO Rankings
- **Free**: Google Search Console
- **Paid**: Semrush, Ahrefs, Moz

---

## 🚀 Test Your Setup

1. **Start the server** (if not running):
   ```bash
   cd "C:\Users\steve\cursor project\digital-presence"
   npm run dev
   ```

2. **Visit the dashboard**:
   - Dynamic (config file): http://localhost:3001/dynamic-analytics
   - Static (HTML): http://localhost:3001/analytics

3. **Verify your data appears correctly**

---

## 📝 Example: Real Company Setup

Let's say you're setting up for **"TechStartup Inc."**:

```javascript
// public/data/company-data.js

const companyData = {
    companyName: "TechStartup Inc.",
    dateRangeLabel: "Last 30 days",
    
    socialMetrics: [
        {
            platform: "LinkedIn",
            followers: 8500,
            engagementRate: 6.2,
            monthlyGrowth: 18
        },
        {
            platform: "Twitter/X",
            followers: 12300,
            engagementRate: 4.9,
            monthlyGrowth: 14
        }
    ],
    
    overallEngagement: 5.6,
    overallGrowth: 16,
    digitalPresenceScore: 82,
    
    competitors: [
        { name: "You", score: 82 },
        { name: "CompetitorX", score: 88 },
        { name: "CompetitorY", score: 71 },
        { name: "CompetitorZ", score: 65 }
    ],
    
    digitalFootprint: {
        brand: 85,
        web: 78,
        seo: 90,
        review: 92,
        social: 80
    },
    
    reputation: [
        { site: "Google", stars: 4.9 },
        { site: "Trustpilot", stars: 4.7 }
    ],
    
    positiveSentiment: 87,
    
    seoKeywords: [
        { keyword: "saas platform", rank: 2, trend: "up" },
        { keyword: "cloud software", rank: 4, trend: "up" },
        { keyword: "business automation", rank: 6, trend: "flat" }
    ],
    
    keyMetrics: {
        avgEngagement: "5.6%",
        monthlyGrowth: "+16%",
        brandMentions: "+22%",
        organicTraffic: "↑"
    },
    
    recommendations: [
        {
            category: "Content",
            action: "Create weekly product demo videos for YouTube",
            impact: "high"
        },
        {
            category: "SEO",
            action: "Optimize for 'best saas tools' and related keywords",
            impact: "high"
        }
    ]
};
```

Save that, refresh the page, and you're done! ✅

---

## 🔄 Regular Updates

**Monthly** (Minimum):
- Update social media follower counts
- Update engagement rates
- Update review ratings
- Update SEO rankings

**Quarterly**:
- Reassess competitor scores
- Update digital footprint scores
- Refresh recommendations

---

## 🆘 Need Help?

1. Check `SETUP-GUIDE.md` for detailed instructions
2. See `README.md` for technical documentation
3. Example data is in `/public/data/company-data.js`

---

**Ready?** Just edit the data file and refresh! 🎉


