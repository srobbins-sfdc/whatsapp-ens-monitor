# Quick Start Guide

Get up and running in 30 minutes! ⚡

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Salesforce org access (with System Administrator or equivalent)
- [ ] Marketing Cloud account with WhatsApp enabled
- [ ] Heroku account
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Heroku CLI installed
- [ ] OpenSSL installed (usually pre-installed on Mac/Linux)

## 10-Minute Setup

### 1️⃣ Generate Certificates (2 min)

```bash
mkdir salesforce-creds && cd salesforce-creds
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr
openssl x509 -req -sha256 -days 365 -in server.csr -signkey server.key -out server.crt
cd ..
```

### 2️⃣ Salesforce Setup (10 min)

**Create Connected App:**
- Setup → App Manager → New Connected App
- Name: `WhatsApp ENS Handler`
- Enable OAuth: ✅
- Upload `server.crt` for digital signatures
- OAuth Scopes: `full`, `refresh_token`, `offline_access`
- **Enable Client Credentials Flow**: ✅ (Critical!)
- Save → Copy Consumer Key

**Create Integration User:**
- Setup → Users → New User
- Username: `integration.ens@yourcompany.com.prod`
- Profile: System Administrator

**Create Permission Set:**
- Setup → Permission Sets → New
- Name: `ENS Integration Permissions`
- Object Settings → WhatsApp_Interaction__c → Edit
- Enable: Read ✅, Create ✅
- Manage Assignments → Add your integration user

**Configure Connected App:**
- App Manager → WhatsApp ENS Handler → Manage
- Edit Policies → Permitted Users: "Admin approved users"
- Manage Permission Sets → Select "ENS Integration Permissions"
- Edit → Client Credentials Flow → Run As: [Select integration user]
- Edit Policies → Check "Issue JWT for named users" ✅

### 3️⃣ Deploy to Heroku (5 min)

```bash
# Clone and setup
git clone <your-repo>
cd WhatsApp-ENS-Github
npm install

# Create Heroku app
heroku login
heroku create your-app-name
heroku buildpacks:set heroku/nodejs

# Set environment variables
heroku config:set SF_INSTANCE_URL=https://YOURDOMAIN.my.salesforce.com
heroku config:set SF_CONSUMER_KEY=YOUR_CONSUMER_KEY
heroku config:set SF_USERNAME=integration.ens@yourcompany.com.prod
heroku config:set PRIVATE_KEY="$(cat salesforce-creds/server.key)"
heroku config:set ENS_SIGNATURE_KEY=""

# Deploy
git init
git add .
git commit -m "Initial deployment"
git push heroku main
```

### 4️⃣ Register ENS Callback (10 min)

**Get MC Access Token (Postman):**
```
POST https://YOUR_TENANT.auth.marketingcloudapis.com/v2/token
Body:
{
  "grant_type": "client_credentials",
  "client_id": "YOUR_MC_CLIENT_ID",
  "client_secret": "YOUR_MC_CLIENT_SECRET"
}
```

**Register Callback:**
```
POST https://YOUR_TENANT.auth.marketingcloudapis.com/platform/v1/ens-callbacks
Headers: Authorization: Bearer YOUR_ACCESS_TOKEN
Body:
{
  "name": "WhatsApp ENS Handler",
  "url": "https://your-app-name.herokuapp.com/ens/callback",
  "type": "webhook"
}
```

**Update signature key:**
```bash
heroku config:set ENS_SIGNATURE_KEY="THE_SIGNATURE_KEY_FROM_RESPONSE"
heroku restart
```

**Verify callback:**
```bash
# Get verification key from logs
heroku logs --tail
# Look for: "Received verification key: xyz123"

# Verify (Postman)
POST https://YOUR_TENANT.auth.marketingcloudapis.com/platform/v1/ens-callbacks/YOUR_CALLBACK_ID/verify
Body: { "verificationKey": "xyz123" }
```

**Create subscription:**
```
POST https://YOUR_TENANT.auth.marketingcloudapis.com/platform/v1/ens-subscriptions
Body:
{
  "name": "WhatsApp All Events",
  "callbackId": "YOUR_CALLBACK_ID",
  "eventCategoryTypes": [
    "EngagementEvents.OttMobileOriginated",
    "EngagementEvents.OttSent",
    "EngagementEvents.OttDelivered",
    "EngagementEvents.OttRead",
    "EngagementEvents.OttFailed"
  ]
}
```

### 5️⃣ Test (3 min)

1. Open dashboard: `https://your-app-name.herokuapp.com/dashboard`
2. Send WhatsApp test message via Marketing Cloud
3. Watch event appear in dashboard ✨
4. Check Salesforce for new `WhatsApp_Interaction__c` record

## Common Issues & Quick Fixes

| Problem | Fix |
|---------|-----|
| "Invalid signature" | Verify `ENS_SIGNATURE_KEY` matches callback registration |
| "Authentication failed" | Check all 5 Connected App setup steps completed |
| No Salesforce record | Verify permission set assigned and object permissions |
| Dashboard blank | Hard refresh browser (Cmd+Shift+R) |
| App crashes | Check `heroku logs --tail` for specific error |

## Quick Commands Reference

```bash
# View logs
heroku logs --tail

# Restart app
heroku restart

# View config
heroku config

# Update config
heroku config:set VARIABLE=value

# Check app status
heroku ps

# Open dashboard
heroku open /dashboard
```

## What's Next?

- ✅ Review full [README.md](README.md) for detailed documentation
- ✅ Customize event processing in [CONTRIBUTING.md](CONTRIBUTING.md)
- ✅ Set up monitoring and alerts
- ✅ Test with production traffic

## Support

- 📖 [Full Documentation](README.md)
- 🐛 [Troubleshooting](README.md#-monitoring--troubleshooting)
- 🤝 [Contributing](CONTRIBUTING.md)

---

**Total Setup Time:** ~30 minutes

**You'll have:** A fully functional, secure, production-ready ENS event handler with real-time monitoring dashboard! 🎉

