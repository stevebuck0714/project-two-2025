# 📊 Google Analytics Setup - Interactive Guide

Follow these steps to connect real Google Analytics data to your Digital Presence tool.

---

## ✅ **Step 1: Create Google Cloud Project** (5 min)

### **Actions:**
1. Open: https://console.cloud.google.com/
2. Click **"Select a project"** dropdown (top nav)
3. Click **"NEW PROJECT"**
4. Project name: `Digital-Presence-Analytics`
5. Click **"CREATE"**
6. Wait for creation (30 seconds)
7. Select the new project from dropdown

**✓ Checkpoint:** You should see "Digital-Presence-Analytics" at the top of the page

---

## ✅ **Step 2: Enable Google Analytics Data API** (2 min)

### **Actions:**
1. In Google Cloud Console, click **≡ menu** (top left)
2. Go to: **APIs & Services** → **Library**
3. Search: `Google Analytics Data API`
4. Click on **"Google Analytics Data API"**
5. Click **"ENABLE"** button
6. Wait for activation (30 seconds)

**✓ Checkpoint:** You should see "API enabled" message

---

## ✅ **Step 3: Create Service Account** (5 min)

### **Actions:**
1. Click **≡ menu** → **IAM & Admin** → **Service Accounts**
2. Click **"+ CREATE SERVICE ACCOUNT"** (top)
3. **Service account name:** `digital-presence-reader`
4. **Service account ID:** (auto-filled)
5. Click **"CREATE AND CONTINUE"**
6. **Select a role:** Choose **"Viewer"**
7. Click **"CONTINUE"**
8. Click **"DONE"** (skip granting access to other users)

**✓ Checkpoint:** You should see `digital-presence-reader@...` in the list

---

## ✅ **Step 4: Generate Credentials JSON** (3 min)

### **Actions:**
1. Click on the service account you just created
2. Go to **"KEYS"** tab (top)
3. Click **"ADD KEY"** → **"Create new key"**
4. Select **JSON** format
5. Click **"CREATE"**
6. **Save the downloaded JSON file** (keep it safe!)

**✓ Checkpoint:** A JSON file should be downloaded to your computer

**⚠️ IMPORTANT:** This file contains credentials - never share it or commit it to Git!

---

## ✅ **Step 5: Copy Service Account Email** (1 min)

### **Actions:**
1. In the service account page, you'll see an email like:
   ```
   digital-presence-reader@your-project.iam.gserviceaccount.com
   ```
2. **COPY THIS EMAIL** - you'll need it in the next step

**✓ Checkpoint:** Email copied to clipboard

---

## ✅ **Step 6: Grant Access in Google Analytics** (5 min)

### **Actions:**
1. Open: https://analytics.google.com/
2. Click **"Admin"** (gear icon, bottom left)
3. In **"Property"** column (middle), click **"Property Access Management"**
4. Click **"+"** button (top right) → **"Add users"**
5. **Email address:** Paste the service account email
6. **Role:** Select **"Viewer"**
7. Uncheck **"Notify new users by email"**
8. Click **"Add"**

**✓ Checkpoint:** Service account should appear in the user list

---

## ✅ **Step 7: Get Your Property ID** (2 min)

### **Actions:**
1. Still in Google Analytics Admin
2. In **"Property"** column, click **"Property Settings"**
3. At the top, you'll see **"PROPERTY ID"**:
   ```
   properties/123456789
   ```
4. **COPY THIS ID** - you'll need it

**✓ Checkpoint:** Property ID copied (format: `properties/123456789`)

---

## ✅ **Step 8: Configure Digital Presence** (5 min)

### **Actions:**

1. **Navigate to your project:**
   ```bash
   cd "C:\Users\steve\cursor project\digital-presence"
   ```

2. **Copy the credentials template:**
   ```bash
   copy config\api-credentials.example.json config\api-credentials.json
   ```

3. **Open the JSON file you downloaded in Step 4** (the service account key)

4. **Edit `config\api-credentials.json`:**
   
   Open in a text editor and update the `googleAnalytics` section:
   
   ```json
   {
     "googleAnalytics": {
       "enabled": true,
       "propertyId": "properties/YOUR_PROPERTY_ID_FROM_STEP_7",
       "credentials": {
         PASTE_ENTIRE_CONTENTS_OF_DOWNLOADED_JSON_HERE
       }
     }
   }
   ```

5. **Save the file**

**✓ Checkpoint:** File saved with your credentials

---

## ✅ **Step 9: Test the Connection** (2 min)

### **Actions:**

1. **Restart the Digital Presence server:**
   ```bash
   cd "C:\Users\steve\cursor project\digital-presence"
   npm run dev
   ```

2. **Run a new analysis:**
   - Go to: http://localhost:3001/analyze
   - Enter any company name and website
   - Submit

3. **Check the server logs** - you should see:
   ```
   📊 Fetching REAL data from Google Analytics...
   ✅ Real Google Analytics data loaded successfully
   ```

**✓ Checkpoint:** Real data is being fetched!

---

## 🎉 **SUCCESS!**

You're now getting **REAL traffic data** from Google Analytics!

### **What Changed:**
- ❌ **Before:** Random growth like +21%
- ✅ **After:** Actual growth from your Google Analytics data
- ❌ **Before:** Generic placeholder pages
- ✅ **After:** Your real top landing pages with actual visitor counts
- ❌ **Before:** Random session duration
- ✅ **After:** Actual average session time from your visitors

---

## 🔍 **Troubleshooting**

### **Problem: "Permission denied" error**
**Solution:** 
- Verify you added the service account email to Google Analytics (Step 6)
- Make sure you granted "Viewer" role
- Wait 5 minutes for permissions to propagate

### **Problem: "Property not found" error**
**Solution:**
- Double-check the Property ID format: `properties/123456789`
- Verify you have access to that property
- Make sure it's a GA4 property (not Universal Analytics)

### **Problem: Still seeing estimated data**
**Solution:**
- Check that `"enabled": true` in config file
- Verify the JSON credentials are properly formatted
- Restart the server
- Check server logs for error messages

---

## 📞 **Need Help?**

If you get stuck at any step, check the server console logs - they'll show specific error messages that can help diagnose the issue.

---

**Ready for the next step? Set up Google Search Console to get real SEO data too!**








