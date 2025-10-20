# WhatsApp ENS Event Monitor for Salesforce Marketing Cloud

A production-ready Node.js application that receives Event Notification Service (ENS) events from Salesforce Marketing Cloud, validates them using HMAC-SHA256 signature verification, and creates records in Salesforce via the REST API. Includes a real-time web dashboard for monitoring incoming events.

## 🎯 What This App Does

- **Receives** Marketing Cloud ENS webhook events (WhatsApp messages: Inbound, Sent, Delivered, Read, Failed)
- **Validates** request signatures using HMAC-SHA256 for security
- **Processes** events asynchronously to prevent timeouts
- **Creates** Salesforce records for inbound WhatsApp messages *(optional - see Monitoring-Only Mode)*
- **Monitors** all events in real-time via a beautiful web dashboard
- **Stores** last 100 events in memory for live monitoring

## 🔀 Two Deployment Modes

### Full Mode (Salesforce Integration)
- Visualizes **all** ENS events in the dashboard
- **Automatically creates Salesforce records** for inbound messages
- Requires Salesforce Connected App and credentials setup

### Monitoring-Only Mode
- Visualizes **all** ENS events in the dashboard
- **Does not** send any data to Salesforce
- Skips Salesforce setup entirely (Steps 1-2)
- Perfect for testing, demos, or simple event monitoring

**To enable Monitoring-Only Mode:** Simply skip Steps 1-2 and don't set the Salesforce environment variables in Step 4.

## 📋 Prerequisites

### Required for All Modes
- ✅ Salesforce Marketing Cloud account with WhatsApp messaging enabled
- ✅ Marketing Cloud API credentials (Client ID and Secret)
- ✅ Heroku account (free tier works for testing)
- ✅ Node.js 18+ and npm
- ✅ Git
- ✅ [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

### Required Only for Full Mode (Salesforce Integration)
- ✅ Salesforce org with API access
- ✅ OpenSSL (for certificate generation)
- ✅ Custom object: `WhatsApp_Interaction__c` with fields:
  - `Message_ID__c` (Text, 255)
  - `Raw_Payload__c` (Long Text Area, 131,072)

## 🚀 Deployment Guide

> **💡 For Monitoring-Only Mode:** Skip Steps 1-2 and go directly to Step 3. In Step 4, only set `ENS_SIGNATURE_KEY` (leave Salesforce variables unset).

### Step 1: Generate SSL Certificates (Full Mode Only)

Generate certificates for Salesforce JWT authentication:

```bash
# Create credentials directory
mkdir salesforce-creds && cd salesforce-creds

# Generate private key
openssl genrsa -out server.key 2048

# Create certificate signing request (press Enter for all prompts)
openssl req -new -key server.key -out server.csr

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -sha256 -days 365 -in server.csr -signkey server.key -out server.crt

cd ..
```

**Save these files securely:**
- `server.key` - Private key (keep secret, add to Heroku config)
- `server.crt` - Certificate (upload to Salesforce Connected App)

---

### Step 2: Salesforce Connected App Configuration (Full Mode Only)

**🔵 IN SALESFORCE UI:**

#### 2.1 Create Connected App

1. Navigate to: **Setup → App Manager → New Connected App**
2. Fill in:
   - **Connected App Name**: `WhatsApp ENS Handler`
   - **API Name**: `WhatsApp_ENS_Handler`
   - **Contact Email**: your-email@company.com
   - **Enable OAuth Settings**: ✅ Check
   - **Callback URL**: `https://login.salesforce.com`
   - **Use digital signatures**: ✅ Check → Upload `server.crt`
   - **Selected OAuth Scopes**:
     - Full access (full)
     - Perform requests at any time (refresh_token, offline_access)
   - **Enable Client Credentials Flow**: ✅ Check (CRITICAL!)
   - **Require Secret for Web Server Flow**: ❌ Uncheck
   - **Require Secret for Refresh Token Flow**: ❌ Uncheck
   - **Require Proof Key for Code Exchange (PKCE)**: ❌ Uncheck
3. Click **Save** → **Continue**
4. **📝 SAVE THE CONSUMER KEY** (you'll need this later)

#### 2.2 Create Integration User

1. Navigate to: **Setup → Users → New User**
2. Fill in:
   - **First Name**: Integration
   - **Last Name**: ENS Handler
   - **Email**: your-email@company.com
   - **Username**: `integration.ens@yourcompany.com.INSTANCENAME`
   - **User License**: Salesforce
   - **Profile**: System Administrator (will be restricted by permission set)
3. Click **Save**
4. **📝 SAVE THE USERNAME**

#### 2.3 Create Permission Set

1. Navigate to: **Setup → Permission Sets → New**
2. Fill in:
   - **Label**: `ENS Integration Permissions`
   - **API Name**: `ENS_Integration_Permissions`
3. Click **Save**
4. Click **Object Settings** → `WhatsApp_Interaction__c` → **Edit**
5. Enable:
   - ✅ Read
   - ✅ Create
6. Click **Save**
7. Go back to permission set → **Manage Assignments** → **Add Assignments**
8. Select your integration user → **Assign**

#### 2.4 Pre-authorize Connected App

1. Navigate to: **Setup → App Manager → WhatsApp ENS Handler → Manage**
2. Click **Edit Policies**
3. Set:
   - **Permitted Users**: "Admin approved users are pre-authorized"
   - **IP Relaxation**: "Relax IP restrictions"
4. Click **Save**
5. Scroll down → **Manage Permission Sets**
6. Select **ENS Integration Permissions** → **Save**

#### 2.5 Configure Client Credentials Flow

1. Still in **App Manager → WhatsApp ENS Handler → Manage**
2. Click **Edit**
3. Under **Client Credentials Flow**:
   - **Run As**: Select your integration user
4. Click **Save**

#### 2.6 Enable JWT for Named Users

1. In **App Manager → WhatsApp ENS Handler → Manage**
2. Click **Edit Policies**
3. Scroll down and **CHECK**: "Issue JSON Web Token (JWT)-based access tokens for named users"
4. Click **Save**

---

### Step 3: Clone and Configure the App

```bash
# Clone this repository
git clone <your-github-repo-url>
cd WhatsApp-ENS-Github

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

**Edit `.env` file with your values:**

**For Full Mode (Salesforce Integration):**
```bash
# Update these with your actual values:
SF_INSTANCE_URL=https://YOUR-DOMAIN.my.salesforce.com
SF_CONSUMER_KEY=YOUR_CONSUMER_KEY_FROM_STEP_2.1
SF_USERNAME=integration.ens@yourcompany.com.INSTANCE

# Copy entire content of server.key and replace \n with \\n
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\nYOUR_KEY_CONTENT\\n-----END RSA PRIVATE KEY-----"

# Leave empty for now (will get from Marketing Cloud)
ENS_SIGNATURE_KEY=
```

**For Monitoring-Only Mode:**
```bash
# Only this variable is required:
ENS_SIGNATURE_KEY=

# Leave Salesforce variables commented out or unset
```

**To format PRIVATE_KEY correctly:**
```bash
# Option 1: Use awk to format
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' salesforce-creds/server.key

# Option 2: Manual - replace actual newlines with \\n
```

---

### Step 4: Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create new Heroku app
heroku create your-unique-app-name

# Set Node.js buildpack
heroku buildpacks:set heroku/nodejs
```

**Set environment variables based on your deployment mode:**

**For Full Mode (Salesforce Integration):**
```bash
heroku config:set SF_INSTANCE_URL=https://YOUR-DOMAIN.my.salesforce.com
heroku config:set SF_CONSUMER_KEY=YOUR_CONSUMER_KEY
heroku config:set SF_USERNAME=integration.ens@yourcompany.com.INSTANCE
heroku config:set PRIVATE_KEY="$(cat salesforce-creds/server.key)"
heroku config:set ENS_SIGNATURE_KEY=""
```

**For Monitoring-Only Mode:**
```bash
# Only set the ENS signature key (will be updated later)
heroku config:set ENS_SIGNATURE_KEY=""
```

**Deploy the app:**
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial deployment"

# Deploy to Heroku
git push heroku main

# View logs
heroku logs --tail
```

**Your app is now live at:** `https://your-unique-app-name.herokuapp.com`

> **Check the logs** - you should see either "✅ Salesforce integration enabled" or "⚠️ Salesforce integration disabled - running in monitoring-only mode"

---

### Step 5: Register ENS Callback with Marketing Cloud

**🔵 USE POSTMAN OR API TOOL:**

#### 5.1 Get Marketing Cloud Access Token

**Request:**
- Method: `POST`
- URL: `https://YOUR_TENANT.auth.marketingcloudapis.com/v2/token`
- Headers:
  - `Content-Type: application/json`
- Body:
```json
{
  "grant_type": "client_credentials",
  "client_id": "YOUR_MC_CLIENT_ID",
  "client_secret": "YOUR_MC_CLIENT_SECRET"
}
```

**📝 Save the `access_token` from response**

#### 5.2 Register ENS Callback

**Request:**
- Method: `POST`
- URL: `https://YOUR_TENANT.auth.marketingcloudapis.com/platform/v1/ens-callbacks`
- Headers:
  - `Authorization: Bearer YOUR_ACCESS_TOKEN`
  - `Content-Type: application/json`
- Body:
```json
{
  "name": "WhatsApp ENS Handler",
  "url": "https://your-unique-app-name.herokuapp.com/ens/callback",
  "type": "webhook"
}
```

**Response will include:**
```json
{
  "callbackId": "abc-123...",
  "signatureKey": "xyz789...",
  "status": "unverified"
}
```

**📝 Save `callbackId` and `signatureKey`**

#### 5.3 Update Heroku with Signature Key

```bash
heroku config:set ENS_SIGNATURE_KEY="THE_SIGNATURE_KEY_FROM_5.2"
heroku restart
```

#### 5.4 Find Verification Key

Marketing Cloud sends a verification request automatically. Check logs:

```bash
heroku logs --tail
```

Look for: `Received verification key: abc-123-def-456`

**📝 Copy this verification key**

#### 5.5 Verify the Callback

**Request:**
- Method: `POST`
- URL: `https://YOUR_TENANT.auth.marketingcloudapis.com/platform/v1/ens-callbacks/YOUR_CALLBACK_ID/verify`
- Headers:
  - `Authorization: Bearer YOUR_ACCESS_TOKEN`
  - `Content-Type: application/json`
- Body:
```json
{
  "verificationKey": "THE_KEY_FROM_LOGS"
}
```

**Response:** `{ "status": "verified" }`

#### 5.6 Create Subscription

**Request:**
- Method: `POST`
- URL: `https://YOUR_TENANT.auth.marketingcloudapis.com/platform/v1/ens-subscriptions`
- Headers:
  - `Authorization: Bearer YOUR_ACCESS_TOKEN`
  - `Content-Type: application/json`
- Body:
```json
{
  "name": "WhatsApp All Events Subscription",
  "callbackId": "YOUR_CALLBACK_ID_FROM_5.2",
  "eventCategoryTypes": [
    "EngagementEvents.OttMobileOriginated",
    "EngagementEvents.OttSent",
    "EngagementEvents.OttDelivered",
    "EngagementEvents.OttRead",
    "EngagementEvents.OttFailed"
  ]
}
```

---

### Step 6: Test Your Deployment

#### Access the Dashboard
Open: `https://your-unique-app-name.herokuapp.com/dashboard`

#### Send Test Message
Send a WhatsApp message to your Marketing Cloud WhatsApp number

#### Verify Success

**For All Modes:**
1. **Check Dashboard** - Event should appear within 2-3 seconds
2. **Check Heroku Logs** - Should see event processed

**For Full Mode Only:**
3. **Check Heroku Logs** - Should see "Successfully created Salesforce record: [ID]"
4. **Check Salesforce** - New `WhatsApp_Interaction__c` record created

**For Monitoring-Only Mode:**
3. **Check Heroku Logs** - Should see "Event type... logged (Salesforce integration disabled)"

---

## 📊 Dashboard Features

### Real-Time Event Monitoring
- 🔄 Auto-refreshes every 3 seconds
- 🔘 Manual refresh button
- 🎯 Filter by event type (All, Inbound, Sent, Delivered, Read, Failed)
- 📱 Event tiles with key details
- 🔍 Expandable full JSON payload view
- ✅ Status indicators (Webhook Received → Processed → Sent to Salesforce*)

\* *Status indicator only shows "Sent to Salesforce" in Full Mode*

### Event Types

**In Full Mode (Salesforce Integration Enabled):**
- **Inbound Messages** (green) → Creates Salesforce record
- **Sent** (blue) → Logged only
- **Delivered** (green) → Logged only
- **Read** (filled green) → Logged only
- **Failed** (red) → Logged only with reason

**In Monitoring-Only Mode:**
- **All event types** → Logged and displayed in dashboard only (no Salesforce records created)

---

## 🛠️ Configuration Reference

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ENS_SIGNATURE_KEY` | **Yes** | From ENS callback registration | `abc123...` |
| `SF_INSTANCE_URL` | Optional* | Your Salesforce instance URL | `https://yourcompany.my.salesforce.com` |
| `SF_CONSUMER_KEY` | Optional* | Connected App Consumer Key | `3MVG9...` |
| `SF_USERNAME` | Optional* | Integration user username | `integration@company.com` |
| `PRIVATE_KEY` | Optional* | Private key with `\\n` for newlines | `-----BEGIN RSA...` |
| `PORT` | No | Server port (Heroku sets automatically) | `3000` |

\* *Required only for Full Mode (Salesforce Integration). All four Salesforce variables must be set to enable the integration.*

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Redirects to dashboard |
| `/dashboard` | GET | Real-time event monitoring UI |
| `/api/events` | GET | JSON API for events (supports `?type=` filter) |
| `/health` | GET | Health check with event count |
| `/ens/callback` | POST | ENS webhook endpoint (for Marketing Cloud) |

---

## 🔧 Customization

### Storing Different Fields in Salesforce

Edit `index.js` around line 190 to customize which fields are stored:

```javascript
const record = {
    Message_ID__c: messageId,
    Raw_Payload__c: JSON.stringify(event, null, 2).substring(0, 131000),
    // Add your custom fields:
    Mobile_Number__c: event.mobileNumber,
    Message_Type__c: event.messageType,
    Timestamp__c: new Date(event.timestampUTC).toISOString()
};
```

### Processing Other Event Types

By default, only `EngagementEvents.OttMobileOriginated` creates Salesforce records.

To process other event types, edit around line 187:

```javascript
if (eventType === 'EngagementEvents.OttMobileOriginated' || 
    eventType === 'EngagementEvents.OttSent') {
    // Create Salesforce record for both inbound and sent
}
```

### Changing In-Memory Event Limit

Edit line 22 to store more/fewer events:

```javascript
const MAX_EVENTS = 100; // Change to your desired limit
```

### Adjusting Auto-Refresh Interval

Edit around line 447 to change refresh frequency:

```javascript
setInterval(fetchEvents, 3000); // Change 3000 (3 seconds) to your desired milliseconds
```

---

## 🔒 Security Features

✅ **JWT Bearer Flow** - Certificate-based authentication (no password storage)  
✅ **HMAC-SHA256 Signature Verification** - Validates all incoming requests  
✅ **Environment Variables** - All secrets stored securely in Heroku Config Vars  
✅ **Pre-authorized Connected App** - No interactive login required  
✅ **Permission Set Isolation** - Integration user has minimal required permissions  

---

## 📈 Monitoring & Troubleshooting

### View Real-Time Logs
```bash
heroku logs --tail
```

### Check Application Status
```bash
heroku ps
```

### View Environment Variables
```bash
heroku config
```

### Restart Application
```bash
heroku restart
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Invalid signature errors | Verify `ENS_SIGNATURE_KEY` is correct |
| Authentication fails | Check all Salesforce credentials, verify Connected App setup |
| No records created | Verify integration user has Create permission on object |
| Events not appearing in dashboard | Hard refresh browser (`Cmd+Shift+R` or `Ctrl+Shift+R`) |
| App crashes on startup | Check Heroku logs for detailed error messages |

---

## 🔄 Updating the App

### Pull Latest Changes
```bash
git pull origin main
npm install
git add .
git commit -m "Update to latest version"
git push heroku main
```

### Update Environment Variables
```bash
heroku config:set VARIABLE_NAME=NEW_VALUE
heroku restart
```

---

## 📦 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Salesforce API**: jsforce
- **Authentication**: JWT (RS256)
- **Security**: HMAC-SHA256 signature verification
- **Hosting**: Heroku
- **Frontend**: Vanilla JavaScript with Tailwind CSS

---

## 🤝 Contributing

Feel free to fork this repository and customize it for your needs. Common enhancements:

- Add database storage (PostgreSQL) for persistent event history
- Create additional Salesforce objects for different event types
- Add Slack/email notifications for failed events
- Build analytics/reporting dashboards
- Add retry logic for failed Salesforce API calls

---

## 📄 License

MIT License - Feel free to use and modify for your organization.

---

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Heroku logs: `heroku logs --tail`
3. Verify all environment variables are set correctly
4. Ensure Salesforce Connected App and permissions are configured properly

---

## ✅ Deployment Checklist

Before going to production:

- [ ] SSL certificates generated
- [ ] Salesforce Connected App created and configured
- [ ] Integration user created with permission set
- [ ] Connected App pre-authorized
- [ ] Client Credentials Flow configured
- [ ] Heroku app deployed
- [ ] All environment variables set
- [ ] ENS callback registered and verified
- [ ] ENS subscription created
- [ ] Test message sent and received successfully
- [ ] Salesforce record created successfully
- [ ] Dashboard accessible and showing events

---

**Built with ❤️ for Salesforce Marketing Cloud + Salesforce Core integration**

