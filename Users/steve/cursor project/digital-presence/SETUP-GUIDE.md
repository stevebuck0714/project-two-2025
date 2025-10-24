# Digital Presence Setup Guide
## Running This for a Real Company

## Quick Start

### 1. Update Company Data

Edit `/public/data/company-data.js` with your actual company information:

```javascript
const companyData = {
    companyName: "Acme Corporation",  // ← Change this
    
    socialMetrics: [
        {
            platform: "Facebook",
            followers: 20000,      // ← Your actual follower count
            engagementRate: 4.2,   // ← Your actual engagement %
            monthlyGrowth: 12      // ← Your actual growth %
        },
        // ... update all platforms
    ],
    // ... update all other sections
};
```

### 2. Where to Get Your Data

#### Social Media Metrics
- **Facebook**: Business Manager → Insights → Audience
- **Instagram**: Business Account → Insights → Audience
- **LinkedIn**: Company Page → Analytics → Followers
- **Twitter/X**: Twitter Analytics → Audience Insights

#### Review Ratings
- **Google**: Google Business Profile dashboard
- **Yelp**: Yelp Business account
- **Facebook**: Page → Insights → Ratings & Reviews

#### SEO Rankings
- **Google Search Console**: Performance tab
- **Semrush/Ahrefs**: Organic search rankings
- **Moz**: Rank tracking tool

#### Digital Presence Score
Calculate based on:
- Social media engagement (25%)
- Website traffic growth (25%)
- SEO performance (20%)
- Review ratings (20%)
- Brand mentions (10%)

---

## Integration Options

### Option A: Static Data (Current)
✅ **Best for**: Single company, monthly updates
- Edit `company-data.js` manually
- Commit changes to git
- Redeploy when data updates

### Option B: API Integration (Recommended)
✅ **Best for**: Multiple companies, real-time data

1. Create a backend API endpoint:

```javascript
// In server.js
app.get('/api/company-data/:companyId', async (req, res) => {
    const { companyId } = req.params;
    
    // Fetch from database
    const data = await getCompanyData(companyId);
    
    res.json(data);
});
```

2. Update the frontend to fetch data:

```javascript
// In analytics.html
async function loadCompanyData() {
    const response = await fetch('/api/company-data/123');
    const data = await response.json();
    updateDashboard(data);
}
```

### Option C: Database Integration
✅ **Best for**: SaaS product, multiple clients

1. Add database (PostgreSQL, MongoDB, etc.)
2. Create company profiles table
3. Store metrics with timestamps
4. Build admin panel for data entry

---

## Data Collection Automation

### Social Media APIs
- **Facebook Graph API**: Get page insights
- **Instagram Business API**: Fetch engagement metrics
- **LinkedIn API**: Company page statistics
- **Twitter API v2**: Tweet analytics

### Review Monitoring
- **Google My Business API**: Reviews & ratings
- **Trustpilot API**: Review aggregation
- **Reviews.io**: Multi-platform monitoring

### SEO Tracking
- **Google Search Console API**: Search performance
- **Semrush API**: Rank tracking
- **Moz API**: Domain authority & rankings

---

## Step-by-Step: First Company Setup

### Step 1: Gather Your Data

Create a spreadsheet with:
- ✅ All social media follower counts
- ✅ Engagement rates (likes, comments, shares ÷ followers)
- ✅ Monthly growth percentages
- ✅ Review site ratings
- ✅ Top 5-10 ranking keywords
- ✅ Competitor names & estimated scores

### Step 2: Update the Config

Open `/public/data/company-data.js` and fill in all fields with your real data.

### Step 3: Test Locally

```bash
npm run dev
```

Visit http://localhost:3001/analytics to see your data.

### Step 4: Deploy

Options:
- **Heroku**: `git push heroku main`
- **Vercel**: `vercel deploy`
- **AWS/Azure**: Upload to VM or container
- **Digital Ocean**: Deploy to droplet

---

## Multi-Company Setup

### Create Company Profiles

```
public/data/
├── company-data.js          # Template
├── clients/
│   ├── acme-corp.js        # Client 1
│   ├── tech-startup.js     # Client 2
│   └── consulting-firm.js  # Client 3
```

### Add Company Selector

```javascript
// In server.js
app.get('/analytics/:companySlug', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'analytics.html'));
});

// In analytics.html
const companySlug = window.location.pathname.split('/')[2];
loadCompanyData(companySlug);
```

---

## Data Update Schedule

**Monthly Updates** (Minimum):
- Social media metrics
- Review ratings
- SEO rankings

**Quarterly Updates** (Recommended):
- Competitor benchmarking
- Digital footprint scores
- Strategic recommendations

**Real-time** (Ideal):
- Automated API integration
- Daily data sync
- Live dashboards

---

## Security Considerations

### Sensitive Data
- ❌ Don't commit API keys to git
- ✅ Use environment variables (`.env` file)
- ✅ Restrict dashboard access with authentication

### Client Data Privacy
- ✅ Use unique URLs per client
- ✅ Require login to view analytics
- ✅ Implement role-based access control

---

## Support & Customization

Need help setting up for your company?

1. **Email**: info@digitalpresensce.com
2. **Documentation**: See `/docs` folder
3. **Custom Development**: Contact for enterprise features

---

## Quick Checklist

- [ ] Updated company name and branding
- [ ] Filled in all social media metrics
- [ ] Added review site ratings
- [ ] Listed top SEO keywords
- [ ] Configured competitor benchmarks
- [ ] Set digital presence score
- [ ] Added actionable recommendations
- [ ] Tested on localhost
- [ ] Deployed to production
- [ ] Scheduled monthly data updates

---

**Ready to launch?** 🚀

Run `npm run dev` and visit http://localhost:3001/analytics








