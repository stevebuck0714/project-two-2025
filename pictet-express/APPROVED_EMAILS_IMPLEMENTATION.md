# Approved Emails Implementation

## Overview
Added "Approved Emails" feature for advisors to access and send 11 pre-approved email templates related to buyer/seller interactions, fund administration, and internal operations.

## Features Implemented

### 1. Email Template System
- **11 pre-approved templates** stored in `server.js`
- Each template includes:
  - Template ID and number (1-11)
  - Title and subject line
  - Recipient type (Buyer, Seller, GP/Admin, Internal Ops, etc.)
  - Email body with placeholder fields
  - List of required fields

### 2. New API Endpoints (server.js)

#### `GET /api/get-email-templates` (Advisors only)
- Returns list of all 11 email templates
- Access restricted to users with `type: 'banker'`

#### `POST /api/send-approved-email` (Advisors only)  
- Sends a filled-out approved email
- Saves to Sent Messages
- Parameters:
  - `templateId`: Template identifier
  - `recipientName`: Recipient name
  - `subject`: Filled subject line
  - `body`: Filled email body
  - `fieldValues`: Object with all field values

### 3. UI Components (views/messages.ejs)

#### New "Approved Emails" Tab
- Third tab on Messages page (after Inbox and Sent)
- **Only visible to advisors** (`user.type === 'banker'`)
- Displays 11 email templates as interactive cards

#### Email Template Cards
- Grid layout (responsive, 3-4 columns on desktop)
- Shows:
  - Template number badge
  - Template title
  - Recipient type
  - Subject preview
  - "Use Template" button
- Hover effects and visual feedback

#### Email Composer Modal
- Opens when template card is clicked
- Features:
  - Form with input fields for all required placeholders
  - **Live preview** of subject and body as user types
  - Validation (all fields must be filled)
  - Send and Cancel buttons
  - Scrollable for templates with many fields

## Email Templates Included

1. **Buyer → Advisor**: Interest in Listing
2. **Advisor → Buyer**: Eligibility Confirmation  
3. **Advisor → Seller**: Potential Buyer Inquiry
4. **Advisor → Both**: Introduction Email
5. **Advisor → Buyer**: Non-Binding EOI Template
6. **Advisor → GP/Admin**: Consent Request
7. **Advisor → GP/Admin**: ROFR Notice
8. **Advisor → Internal Ops**: Transfer Processing
9. **Advisor → Both**: Closing Confirmation
10. **Advisor → Client**: Unable to Proceed
11. **Advisor → Buyer**: Advisory Recommendation

## Placeholder Fields System

### Common Fields:
- `{Advisor_Name}` - Advisor's name
- `{ListingID}` - Listing identifier
- `{SPV}` - SPV name
- `{GP Fund}` or `{GP_Fund}` - GP fund name
- `{Buyer_Name}` - Buyer's name
- `{Seller_Name}` - Seller's name
- `{Client_Name}` - Generic client name

### Transaction Fields:
- `{Commitment}` - Total commitment amount
- `{Pct_Called}` - Percentage called
- `{Unfunded}` - Unfunded amount
- `{NAV_Date}` - NAV date
- `{NAV_Amount}` - NAV amount
- `{PricePctNAV}` - Price as % of NAV

### Contact Fields:
- `{Title}`, `{Desk}`, `{Phone}`, `{Email}` - Advisor contact info
- `{Booking_Center}`, `{Client_ID}` - Client identifiers

## User Flow

### For Advisors:
1. Click on **Messages** in navigation
2. Click **"Approved Emails"** tab
3. Browse 11 templates displayed as cards
4. Click on a template card
5. **Fill in all required fields** in the modal
6. **Preview updates live** as you type
7. Click **"Send Email"** 
8. Email appears in **Sent Messages** tab

### For Clients:
- "Approved Emails" tab **not visible**
- Clients only see Inbox and Sent Messages tabs (unchanged behavior)

## Technical Details

### Data Structure (server.js)
```javascript
const approvedEmailTemplates = [
    {
        id: 'template-id',
        number: 1,
        title: 'Template Title',
        recipientType: 'Recipient Type',
        subject: 'Subject with {Placeholders}',
        body: 'Body with {Placeholders}',
        requiredFields: ['Field1', 'Field2', ...]
    },
    // ... 10 more templates
];
```

### Live Preview Feature
- JavaScript listens to input field changes
- Automatically replaces `{Placeholder}` with typed value
- Updates both subject and body previews in real-time
- Uses regex for accurate placeholder replacement

### Validation
- All required fields must be filled before sending
- Alert shown if any field is empty
- No partial emails can be sent

## Files Modified

1. **server.js** (3 additions):
   - `approvedEmailTemplates` array (lines 198-404)
   - `GET /api/get-email-templates` endpoint (lines 1043-1065)
   - `POST /api/send-approved-email` endpoint (lines 1067-1122)

2. **views/messages.ejs** (major additions):
   - New "Approved Emails" tab button (conditional rendering)
   - Approved emails section HTML
   - Email composer modal structure
   - JavaScript functions (8 functions added):
     - `loadEmailTemplates()`
     - `displayEmailTemplates()`
     - `openEmailComposer()`
     - `updateEmailPreview()`
     - `sendApprovedEmail()`
     - `closeEmailComposer()`
     - Updated `showMessageTab()`
   - CSS styles for template cards and composer modal (~230 lines)

## Security Features

- **Access Control**: Only advisors can access templates and send approved emails
- **Server-side validation**: API endpoints check `user.type === 'banker'`
- **No direct client access**: Templates not exposed to clients

## Testing Instructions

### Test as Advisor (e.g., Alexandra Steinberg):
1. Login: `alexandra.steinberg` / `venturis0801`
2. Navigate to Messages
3. Click "Approved Emails" tab
4. Should see 11 template cards in a grid
5. Click on Template #2 ("Advisor → Buyer: Eligibility Confirmation")
6. Fill in all fields:
   - Buyer_Name: John Smith
   - ListingID: LST-001
   - SPV: Test SPV
   - GP Fund: Test Fund
   - Advisor_Name: Alexandra Steinberg
   - Title: Senior Private Banker
   - Desk: London Desk
   - Phone: +44 20 1234 5678
   - Email: alexandra.steinberg@ubs.com
7. Watch preview update as you type
8. Click "Send Email"
9. Verify email appears in "Sent Messages" tab

### Test as Client:
1. Login as any client (e.g., `john.smith` / `venturis0801`)
2. Navigate to Messages
3. "Approved Emails" tab should **NOT be visible**
4. Only Inbox and Sent Messages tabs should appear

## Future Enhancements (Optional)

- **Save draft emails** for completion later
- **Template favorites** for frequently used templates
- **Auto-fill fields** from context (e.g., from Investment Opportunities page)
- **Email history tracking** per listing/transaction
- **Template customization** by advisor
- **Attachment support** for legal documents

## No Breaking Changes
- Existing Messages functionality unchanged
- Inbox and Sent tabs work as before
- Client experience unchanged
- Only adds new feature for advisors


