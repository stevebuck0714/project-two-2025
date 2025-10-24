# 🔗 Real API Integration Setup Guide

This guide explains how to connect **real APIs** to get actual data instead of estimates.

---

## 📊 **What You Get With Real APIs**

### **Current Status: Estimated Data**
- ❌ Random growth rates
- ❌ Generic landing pages
- ❌ Estimated metrics

### **With Real APIs: Actual Data**
- ✅ Real visitor counts from Google Analytics
- ✅ Real keyword rankings from Search Console
- ✅ Real follower counts & engagement from social media
- ✅ Accurate growth trends

---

## 🚀 **Quick Start**

1. Copy the example credentials file:
   ```bash
   cp config/api-credentials.example.json config/api-credentials.json
   ```

2. Follow setup instructions below for each API you want to connect

3. Enable the APIs in your `config/api-credentials.json` file

4. Restart the server - it will automatically use real data when available!

---

## 📈 **1. Google Analytics (Traffic Data)**

### **What You Get:**
- Real monthly visitor counts
- Actual growth rates (MoM)
- Top landing pages with real visits
- Actual session duration
- Bounce rates per page

### **Setup Steps:**

#### **Step 1: Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Analytics Data API**
   - Go to "APIs & Services" → "Enable APIs and Services"
   - Search for "Google Analytics Data API"
   - Click "Enable"

#### **Step 2: Create Service Account**
1. Go to "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Name it (e.g., "digital-presence-analytics")
4. Click "Create and Continue"
5. Grant role: **Viewer**
6. Click "Done"

#### **Step 3: Generate Credentials JSON**
1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose **JSON** format
5. Download the JSON file

#### **Step 4: Grant Access in Google Analytics**
1. Go to [Google Analytics](https://analytics.google.com/)
2. Click "Admin" (gear icon)
3. In "Property" column, click "Property Access Management"
4. Click "+ Add users"
5. Add the service account email (from JSON file: `client_email`)
6. Give it "Viewer" role
7. Click "Add"

#### **Step 5: Get Property ID**
1. In Google Analytics, click "Admin"
2. Make sure correct property is selected
3. Click "Property Settings"
4. Copy the **Property ID** (format: `properties/123456789`)

#### **Step 6: Configure in Digital Presence**
Edit `config/api-credentials.json`:
```json
{
  "googleAnalytics": {
    "enabled": true,
    "propertyId": "properties/YOUR_PROPERTY_ID",
    "credentials": {
      // Paste entire contents of downloaded JSON file here
    }
  }
}
```

---

## 🔍 **2. Google Search Console (SEO Data)**

### **What You Get:**
- Real keyword rankings
- Actual search positions
- Click-through rates
- Impressions
- Real trend data

### **Setup Steps:**

#### **Step 1: Enable API**
1. In same Google Cloud Project
2. Enable **Search Console API**

#### **Step 2: Use Same Service Account**
- You can reuse the service account from Google Analytics

#### **Step 3: Grant Access in Search Console**
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property
3. Click "Settings" (gear icon)
4. Click "Users and permissions"
5. Click "Add user"
6. Add the service account email
7. Give it "Full" permission
8. Click "Add"

#### **Step 4: Configure**
Edit `config/api-credentials.json`:
```json
{
  "googleSearchConsole": {
    "enabled": true,
    "siteUrl": "https://yourwebsite.com",
    "credentials": {
      // Same JSON as Google Analytics
    }
  }
}
```

---

## 📱 **3. Facebook/Instagram (Meta Graph API)**

### **What You Get:**
- Real follower counts
- Actual engagement rates
- Post performance metrics

### **Setup Steps:**

#### **Step 1: Create Facebook App**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app → "Business"
3. Add **Instagram Graph API** product

#### **Step 2: Get Page Access Token**
1. In app dashboard, go to Tools → Graph API Explorer
2. Select your app
3. Click "Generate Access Token"
4. Grant permissions: `pages_read_engagement`, `instagram_basic`
5. Copy the access token

#### **Step 3: Make Token Long-Lived**
```bash
curl -i -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
```

#### **Step 4: Get Page/Account ID**
For Facebook:
```bash
curl -i -X GET "https://graph.facebook.com/v18.0/me/accounts?access_token=YOUR_ACCESS_TOKEN"
```

For Instagram:
```bash
curl -i -X GET "https://graph.facebook.com/v18.0/PAGE_ID?fields=instagram_business_account&access_token=YOUR_ACCESS_TOKEN"
```

#### **Step 5: Configure**
```json
{
  "facebook": {
    "enabled": true,
    "accessToken": "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN",
    "pageId": "YOUR_PAGE_ID"
  },
  "instagram": {
    "enabled": true,
    "accessToken": "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN",
    "accountId": "YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID"
  }
}
```

---

## 🐦 **4. Twitter/X API**

### **What You Get:**
- Real follower counts
- Tweet engagement metrics
- Actual growth rates

### **Cost:** $100/month for Basic tier

### **Setup Steps:**

#### **Step 1: Apply for Developer Account**
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Apply for Developer Account
3. Wait for approval (1-3 days)

#### **Step 2: Create Project & App**
1. Create a new project
2. Create an app within that project
3. Subscribe to **Basic tier** ($100/month)

#### **Step 3: Generate Bearer Token**
1. In app settings, go to "Keys and tokens"
2. Generate "Bearer Token"
3. Copy it immediately (shown only once)

#### **Step 4: Configure**
```json
{
  "twitter": {
    "enabled": true,
    "bearerToken": "YOUR_BEARER_TOKEN"
  }
}
```

---

## 💼 **5. LinkedIn API**

### **What You Get:**
- Company follower counts
- Post engagement metrics

### **Requirements:** LinkedIn Company Page with admin access

### **Setup Steps:**

#### **Step 1: Create LinkedIn App**
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create an app
3. Link it to your LinkedIn Company Page
4. Request access to **Marketing Developer Platform** (requires review)

#### **Step 2: Get Access Token**
Follow LinkedIn OAuth 2.0 flow to get access token

#### **Step 3: Get Organization ID**
```bash
curl -X GET 'https://api.linkedin.com/v2/organizations' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

#### **Step 4: Configure**
```json
{
  "linkedin": {
    "enabled": true,
    "accessToken": "YOUR_ACCESS_TOKEN",
    "organizationId": "urn:li:organization:YOUR_ORG_ID"
  }
}
```

---

## ✅ **Testing Your Setup**

1. Save your `config/api-credentials.json` file
2. Restart the Digital Presence server
3. Run a new analysis
4. Check the server logs for:
   ```
   📊 Fetching REAL data from Google Analytics...
   ✅ Real Google Analytics data loaded successfully
   ```

If you see these messages, real data is being fetched! 🎉

---

## 🔒 **Security Notes**

- ⚠️ **NEVER** commit `api-credentials.json` to version control
- ⚠️ The file is already in `.gitignore`
- ⚠️ Keep your tokens and credentials secure
- ⚠️ Use environment variables in production

---

## 💰 **Cost Summary**

| API | Cost | What You Get |
|-----|------|-------------|
| **Google Analytics** | FREE | Traffic data |
| **Google Search Console** | FREE | SEO rankings |
| **Facebook/Instagram** | FREE | Social metrics |
| **Twitter/X** | $100/month | Tweet analytics |
| **LinkedIn** | FREE (requires approval) | Company metrics |

**Most valuable:** Start with Google Analytics & Search Console (both FREE!)

---

## 🆘 **Troubleshooting**

### **"Analysis not found" error**
- Check that server is running
- Verify credentials are correct
- Look at server logs for error messages

### **"Permission denied" error**
- Verify service account has access
- Check that you granted permissions in GA/GSC
- Ensure credentials JSON is complete

### **Still showing estimated data**
- Check `enabled: true` in config file
- Restart server after config changes
- Verify API is properly enabled in Google Cloud

---

## 📞 **Need Help?**

If you're stuck setting up any API:
1. Check server logs for specific error messages
2. Verify all setup steps were completed
3. Make sure credentials file has no JSON syntax errors

---

**Ready to get real data? Start with Google Analytics - it's free and provides the most valuable insights!** 🚀








