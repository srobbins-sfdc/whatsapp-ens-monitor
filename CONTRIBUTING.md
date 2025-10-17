# Contributing to WhatsApp ENS Event Monitor

Thank you for your interest in improving this project! This guide will help you customize and enhance the application for your team's needs.

## 🎯 Common Customizations

### 1. Custom Salesforce Fields

To add additional fields to your Salesforce records:

**Step 1: Add fields to your Salesforce object**
- Navigate to Setup → Object Manager → WhatsApp_Interaction__c
- Add your custom fields (e.g., `Contact_Name__c`, `Journey_Name__c`)

**Step 2: Update the code**

Edit `index.js` around line 190:

```javascript
const record = {
    Message_ID__c: messageId,
    Raw_Payload__c: JSON.stringify(event, null, 2).substring(0, 131000),
    
    // Add your custom fields:
    Contact_Key__c: event.contactKey,
    Mobile_Number__c: event.mobileNumber,
    Message_Type__c: event.messageType,
    Journey_Name__c: event.journeyName,
    Journey_ID__c: event.journeyId,
    Activity_Name__c: event.activityName,
    Send_Method__c: event.sendMethod,
    Timestamp__c: new Date(event.timestampUTC).toISOString()
};
```

### 2. Process Multiple Event Types

By default, only inbound messages create Salesforce records. To store all event types:

**Option A: Store all events in the same object**

Edit around line 187:

```javascript
// Process ALL event types
if (eventType) {
    const conn = await sfConnectionCache.getConnection();
    
    const record = {
        Message_ID__c: messageId,
        Event_Type__c: eventType,
        Raw_Payload__c: JSON.stringify(event, null, 2).substring(0, 131000)
    };
    
    const result = await conn.sobject('WhatsApp_Interaction__c').create(record);
    // ... rest of code
}
```

**Option B: Create different Salesforce objects per event type**

```javascript
let objectName = 'WhatsApp_Interaction__c'; // Default for inbound

// Determine which object to use
if (eventType === 'EngagementEvents.OttSent') {
    objectName = 'WhatsApp_Sent__c';
} else if (eventType === 'EngagementEvents.OttDelivered') {
    objectName = 'WhatsApp_Delivered__c';
}

const result = await conn.sobject(objectName).create(record);
```

### 3. Add Database Storage

To persist events beyond 100 in-memory records, add PostgreSQL:

```bash
# Add Heroku Postgres
heroku addons:create heroku-postgresql:mini

# Install pg client
npm install pg
```

Update `index.js`:

```javascript
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Store events in database
async function storeEventInDB(event, status) {
    await pool.query(
        `INSERT INTO events (event_id, event_type, mobile_number, payload, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [event.messageId || event.messageKey, event.eventCategoryType, 
         event.mobileNumber, JSON.stringify(event), status]
    );
}
```

### 4. Customize Dashboard Appearance

**Change colors:**

Edit `index.js` around line 190 (Tailwind config):

```javascript
colors: {
  primary: "#38e07b",  // Change to your brand color
  "background-light": "#f6f8f7",
  "background-dark": "#122017",
}
```

**Add custom branding:**

Update logos around line 220:

```javascript
<img alt="Your Company Logo" src="YOUR_LOGO_URL"/>
```

### 5. Add Notification System

**Send Slack notifications for failed events:**

```bash
npm install @slack/webhook
```

```javascript
const { IncomingWebhook } = require('@slack/webhook');
const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);

// In error handling
catch (error) {
    console.error('Error processing event:', error.message);
    
    // Send Slack notification
    await webhook.send({
        text: `⚠️ ENS Event Processing Failed`,
        attachments: [{
            color: 'danger',
            fields: [
                { title: 'Error', value: error.message },
                { title: 'Event ID', value: event.messageId }
            ]
        }]
    });
}
```

### 6. Add Event Filtering Logic

**Filter by phone number or contact:**

```javascript
// Only process events from specific numbers
const allowedNumbers = ['1234567890', '0987654321'];

if (!allowedNumbers.includes(event.mobileNumber)) {
    console.log(`Skipping event from ${event.mobileNumber}`);
    storeEvent(event, 'filtered');
    return;
}
```

### 7. Add Retry Logic for Failed API Calls

```javascript
async function createSalesforceRecordWithRetry(record, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const conn = await sfConnectionCache.getConnection();
            const result = await conn.sobject('WhatsApp_Interaction__c').create(record);
            return result;
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.message);
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
    }
}
```

## 🧪 Testing

### Local Development

```bash
# Install dependencies
npm install

# Create .env file with your test credentials
cp .env.example .env
# Edit .env with your values

# Run locally
npm start

# Test webhook endpoint
curl -X POST http://localhost:3000/ens/callback \
  -H "Content-Type: application/json" \
  -d '{"messageId":"test-123","eventCategoryType":"EngagementEvents.OttMobileOriginated"}'
```

### Testing on Heroku

```bash
# View logs
heroku logs --tail

# Test health endpoint
curl https://your-app.herokuapp.com/health

# Restart app
heroku restart

# Check environment variables
heroku config
```

## 📝 Code Style

- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and single-purpose
- Handle errors gracefully with try/catch
- Log important events and errors

## 🐛 Reporting Issues

When reporting issues, include:
1. Error message from Heroku logs
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment details (Salesforce org type, MC account type)

## 🚀 Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request with description of changes

## 📚 Helpful Resources

- [Salesforce JWT Bearer Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_jwt_flow.htm)
- [Marketing Cloud ENS Documentation](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/event-notification-service.html)
- [jsforce Documentation](https://jsforce.github.io/)
- [Heroku Node.js Deployment](https://devcenter.heroku.com/articles/deploying-nodejs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)

## 💡 Ideas for Enhancement

- [ ] Add GraphQL API for event queries
- [ ] Create admin panel for configuration
- [ ] Add export functionality (CSV, Excel)
- [ ] Implement event replay for failed processes
- [ ] Add multi-language support for dashboard
- [ ] Create Docker container for local deployment
- [ ] Add automated testing suite
- [ ] Implement rate limiting
- [ ] Add webhook health monitoring
- [ ] Create analytics/metrics dashboard

Happy coding! 🎉

