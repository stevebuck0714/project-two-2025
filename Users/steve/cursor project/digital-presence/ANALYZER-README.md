# 🔍 Digital Presence Analyzer

## Overview

The Digital Presence Analyzer is an **automated tool** that allows you to analyze any company's digital footprint by simply entering their name and website URL.

---

## ✨ How It Works

### 1. **User Input**
Visit http://localhost:3001/analyze and enter:
- Company name (required)
- Website URL (required)
- Social media profile URLs (optional)
- Competitor names or URLs (optional)
- Analysis options (social media, SEO, reviews, content, competitors)

### 2. **Automated Analysis**
The system automatically:
- ✅ Scans the company website
- ✅ Analyzes social media presence
- ✅ Checks online reviews and ratings
- ✅ Evaluates SEO performance
- ✅ Compares against competitors
- ✅ Generates actionable recommendations

### 3. **Results Dashboard**
View comprehensive results including:
- Total followers across all platforms
- Average engagement rates
- Monthly growth metrics
- Digital presence score (0-100)
- Competitor benchmarking
- Digital footprint radar chart
- Reputation monitoring (star ratings)
- SEO keyword rankings
- AI-generated recommendations

---

## 🚀 Quick Start

### Basic Usage

```
1. Open http://localhost:3001/analyze

2. Fill in the form:
   Company Name: Acme Corporation
   Website URL: https://www.acmecorp.com
   Facebook: https://facebook.com/acmecorp
   LinkedIn: https://linkedin.com/company/acme

3. Click "Analyze Digital Presence"

4. Wait 30-60 seconds for analysis

5. View comprehensive results dashboard
```

---

## 🔌 API Integration

### Current Status: **Phase 1** (Estimation)
The analyzer currently provides **estimated metrics** based on website analysis. This is perfect for:
- Demo purposes
- Quick assessments
- Initial evaluations
- Proof of concept

### Phase 2: **Real API Integration** (Future)
To get **actual real-time data**, integrate with:

#### Social Media APIs
```javascript
// Facebook Graph API
const facebook = require('facebook-api');
const pageData = await facebook.getPage(pageId);

// LinkedIn API
const linkedin = require('linkedin-api-client');
const companyStats = await linkedin.getCompanyStats(companyId);

// Twitter API v2
const twitter = require('twitter-api-v2');
const metrics = await twitter.getUserMetrics(username);
```

#### Review APIs
```javascript
// Google Places API
const google = require('@googlemaps/google-maps-services-js');
const reviews = await google.placeDetails({ place_id: placeId });

// Yelp Fusion API
const yelp = require('yelp-fusion');
const business = await yelp.business(businessId);
```

#### SEO APIs
```javascript
// Google Search Console API
const {google} = require('googleapis');
const searchconsole = google.searchconsole('v1');
const seoData = await searchconsole.searchanalytics.query();

// Semrush API
const semrush = require('semrush-api');
const rankings = await semrush.domain_ranks(domain);
```

---

## 📊 What Gets Analyzed

### Website Analysis ✅
- SSL certificate (HTTPS)
- Meta descriptions
- Social media tags (Open Graph)
- Structured data (Schema.org)
- Page load time
- Overall web score (0-100)

### Social Media (Estimated) 📱
- Follower counts
- Engagement rates
- Monthly growth percentages
- Platform-specific metrics

### SEO (Estimated) 🔍
- Keyword rankings
- Search visibility
- Organic traffic trends
- SEO score (0-100)

### Reviews (Estimated) ⭐
- Star ratings from major platforms
- Positive sentiment percentage
- Review score (0-100)

### Competitors 🏆
- Relative scoring
- Benchmarking comparison
- Competitive positioning

---

## 🎯 Real-World Use Cases

### 1. **Sales Prospecting**
Before reaching out to a potential client:
```
→ Analyze their digital presence
→ Identify gaps and opportunities
→ Customize your pitch based on findings
```

### 2. **Competitive Intelligence**
Monitor your competitors:
```
→ Compare your metrics side-by-side
→ Identify what they're doing better
→ Spot market opportunities
```

### 3. **Client Onboarding**
Start new client relationships with data:
```
→ Run initial assessment
→ Present findings in first meeting
→ Create data-driven strategy
```

### 4. **Monthly Reporting**
Track progress over time:
```
→ Analyze same company monthly
→ Track improvements
→ Demonstrate ROI
```

---

## 🔐 Data Storage

### Current Implementation
- **In-memory storage** (global variable)
- Results persist until server restart
- No database required
- Perfect for testing/demo

### Production Recommendation
```javascript
// Use a database for persistent storage
const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
    analysisId: String,
    companyName: String,
    websiteUrl: String,
    results: Object,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
});

// Store results
await Analysis.create({
    analysisId,
    companyName: data.companyName,
    results: analysisResults,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
});
```

---

## 🛠️ Customization

### Add New Analysis Metrics

Edit `/api/analyzer.js`:

```javascript
// Add new analysis function
async function analyzeNewMetric(companyData) {
    // Your analysis logic here
    return {
        metricName: value,
        score: 0-100
    };
}

// Add to main analysis
const [social, seo, reviews, newMetric] = await Promise.allSettled([
    analyzeSocialMedia(companyData),
    analyzeSEO(companyData),
    analyzeReviews(companyData),
    analyzeNewMetric(companyData)  // ← Your new function
]);
```

### Customize Recommendations

Edit the `generateRecommendations()` function:

```javascript
if (results.yourMetric < threshold) {
    recommendations.push({
        category: "Your Category",
        action: "Your recommendation text",
        impact: "high" // or "medium" or "low"
    });
}
```

---

## 📈 Upgrading to Real APIs

### Step 1: Get API Keys
1. Facebook Graph API: https://developers.facebook.com
2. LinkedIn API: https://www.linkedin.com/developers
3. Twitter API: https://developer.twitter.com
4. Google Places API: https://console.cloud.google.com
5. Semrush API: https://www.semrush.com/api-documentation

### Step 2: Install API Clients
```bash
npm install facebook-api linkedin-api-client twitter-api-v2 @googlemaps/google-maps-services-js semrush-api
```

### Step 3: Configure Environment Variables
```bash
# .env
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
LINKEDIN_CLIENT_ID=your_client_id
TWITTER_BEARER_TOKEN=your_bearer_token
GOOGLE_PLACES_API_KEY=your_api_key
SEMRUSH_API_KEY=your_api_key
```

### Step 4: Update Analyzer Functions
Replace estimated data with real API calls in `/api/analyzer.js`.

---

## 🚨 Limitations (Current Version)

1. **Estimated Data**: Social metrics and growth are estimated, not real
2. **No Authentication**: Anyone can analyze any company
3. **In-Memory Storage**: Results lost on server restart
4. **Rate Limiting**: No throttling on analysis requests
5. **No Caching**: Each analysis runs fresh every time

### Recommended Improvements
- [ ] Add user authentication
- [ ] Implement database storage
- [ ] Add rate limiting (e.g., 10 analyses per hour)
- [ ] Cache results for 24 hours
- [ ] Integrate real social media APIs
- [ ] Add export to PDF functionality
- [ ] Enable scheduled re-analysis

---

## 💡 Tips

1. **Start Simple**: Test with your own company first
2. **Verify URLs**: Make sure social media URLs are correct
3. **Be Patient**: Analysis takes 30-60 seconds
4. **Bookmark Results**: Results URL can be shared with others
5. **Compare Often**: Run monthly analyses to track changes

---

## 🆘 Troubleshooting

### "Analysis Failed"
- Check that the website URL is accessible
- Ensure URLs include `https://`
- Try without special characters in company name

### "Analysis Not Found"
- Results may have expired (server restart)
- Check the URL for typos
- Run a new analysis

### Slow Performance
- Large websites take longer to analyze
- Multiple social platforms increase time
- Network speed affects analysis duration

---

## 📞 Support

Need help or want to add features?
- Check `SETUP-GUIDE.md` for detailed configuration
- See `QUICKSTART.md` for basic usage
- Review `/api/analyzer.js` for technical details

---

**Ready to analyze companies?** Visit http://localhost:3001/analyze and get started! 🚀


