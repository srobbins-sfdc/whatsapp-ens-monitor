require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const jsforce = require('jsforce');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
const {
    SF_INSTANCE_URL,
    SF_CONSUMER_KEY,
    SF_USERNAME,
    PRIVATE_KEY,
    ENS_SIGNATURE_KEY
} = process.env;

// Check if Salesforce integration is enabled
const SALESFORCE_ENABLED = SF_INSTANCE_URL && SF_CONSUMER_KEY && SF_USERNAME && PRIVATE_KEY;

if (SALESFORCE_ENABLED) {
    console.log('✅ Salesforce integration enabled');
} else {
    console.log('⚠️  Salesforce integration disabled - running in monitoring-only mode');
    console.log('   Events will be logged and displayed in the dashboard but not sent to Salesforce');
}

// --- In-Memory Event Storage ---
const recentEvents = [];
const MAX_EVENTS = 100;

function storeEvent(event, status) {
    // Convert Unix timestamp (seconds or milliseconds) to ISO string
    let timestamp;
    if (event.timestampUTC) {
        // If timestamp is in seconds (< year 3000 in milliseconds), convert to milliseconds
        const ts = event.timestampUTC < 10000000000 ? event.timestampUTC * 1000 : event.timestampUTC;
        timestamp = new Date(ts).toISOString();
    } else {
        timestamp = new Date().toISOString();
    }
    
    const storedEvent = {
        id: event.messageId || event.messageKey || `event-${Date.now()}`,
        timestamp: timestamp,
        eventType: event.eventCategoryType || 'Unknown',
        mobileNumber: event.mobileNumber || 'N/A',
        contactKey: event.contactKey || 'N/A',
        sendMethod: event.sendMethod || 'N/A',
        journeyName: event.journeyName || null,
        activityName: event.activityName || null,
        messageType: event.messageType || 'N/A',
        failureReason: event.reason || null,
        status: status,
        payload: event
    };
    
    recentEvents.unshift(storedEvent);
    
    // Keep only last MAX_EVENTS
    if (recentEvents.length > MAX_EVENTS) {
        recentEvents.pop();
    }
    
    console.log(`✅ Event stored in memory. Total events: ${recentEvents.length}`);
    
    return storedEvent;
}

// --- Salesforce Connection Cache ---
const sfConnectionCache = {
    conn: null,
    expires: 0,
    async getConnection() {
        if (this.conn && Date.now() < this.expires) {
            return this.conn;
        }

        console.log('Authenticating with Salesforce...');
        
        try {
            // Step 1: Create JWT claims
            // Note: aud must be https://login.salesforce.com or https://test.salesforce.com
            const isProduction = !SF_INSTANCE_URL.includes('sandbox') && !SF_INSTANCE_URL.includes('test');
            const audience = isProduction ? 'https://login.salesforce.com' : 'https://test.salesforce.com';
            
            const jwtPayload = {
                iss: SF_CONSUMER_KEY,           // Issuer (Consumer Key)
                sub: SF_USERNAME,                // Subject (Username)
                aud: audience,                   // Audience (login.salesforce.com or test.salesforce.com)
                exp: Math.floor(Date.now() / 1000) + (5 * 60) // Expires in 5 minutes
            };

            // Step 2: Sign the JWT with the private key
            const privateKey = PRIVATE_KEY.replace(/\\n/g, '\n');
            const token = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });

            // Step 3: Exchange JWT for access token
            const tokenEndpoint = `${audience}/services/oauth2/token`;
            
            // Create form-urlencoded body
            const formData = new URLSearchParams();
            formData.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
            formData.append('assertion', token);
            
            const response = await axios.post(tokenEndpoint, formData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const { access_token, instance_url } = response.data;

            // Step 4: Initialize jsforce connection with access token
            const newConn = new jsforce.Connection({
                instanceUrl: instance_url,
                accessToken: access_token,
                version: '59.0'
            });

            this.conn = newConn;
            // Re-authenticate 50 minutes from now (tokens typically last 2 hours)
            this.expires = Date.now() + (50 * 60 * 1000);
            console.log('Salesforce authentication successful.');
            return this.conn;

        } catch (error) {
            console.error('Salesforce authentication failed:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
            throw error;
        }
    }
};

// --- Middleware ---
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// --- Health Check Endpoint ---
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        service: 'ENS Handler',
        timestamp: new Date().toISOString(),
        eventsInMemory: recentEvents.length
    });
});

// --- API Endpoint for Events ---
app.get('/api/events', (req, res) => {
    const eventType = req.query.type;
    
    console.log(`📊 API call to /api/events - Total events in memory: ${recentEvents.length}, Filter: ${eventType || 'all'}`);
    
    let filteredEvents = recentEvents;
    
    // Filter by event type if specified
    if (eventType && eventType !== 'all') {
        filteredEvents = recentEvents.filter(e => e.eventType === eventType);
    }
    
    res.json({
        total: filteredEvents.length,
        events: filteredEvents
    });
});

// --- Dashboard UI ---
app.get('/dashboard', (req, res) => {
    // Disable caching to ensure latest version
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.send(`<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>WhatsApp ENS Monitor</title>
<link rel="icon" type="image/png" href="https://image.s4.sfmc-content.com/lib/fe30117276640675771677/m/1/4ffb300c-c8c6-4d8b-b98c-016b76e31636.png"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          primary: "#38e07b",
          "background-light": "#f6f8f7",
          "background-dark": "#122017",
        },
        fontFamily: {
          display: ["Inter"],
        },
        borderRadius: {
          DEFAULT: "0.25rem",
          lg: "0.5rem",
          xl: "0.75rem",
          full: "9999px",
        },
      },
    },
  };
</script>
<style>
  .material-symbols-outlined {
    font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
  }
</style>
</head>
<body class="font-display bg-background-light dark:bg-background-dark text-black dark:text-white">
<div class="flex h-screen overflow-hidden">
<aside class="w-1/3 p-6 border-r-2 border-primary/20 dark:border-primary/30 flex flex-col overflow-y-auto">
<div class="flex items-center gap-3 mb-8">
<img alt="Salesforce Logo" class="h-10 w-auto" src="https://image.s4.sfmc-content.com/lib/fe30117276640675771677/m/1/04b1f675-89eb-49f5-bc2f-1209f3fd0a83.png"/>
<img alt="WhatsApp Logo" class="h-10 w-10" src="https://image.s4.sfmc-content.com/lib/fe30117276640675771677/m/1/775e4baa-db77-4c2b-b586-8e1fd98d72f8.png"/>
</div>
<h1 class="text-3xl font-bold mb-1">WhatsApp ENS Monitor</h1>
<p class="text-black/60 dark:text-white/60 mb-2">Real-time events from Marketing Cloud</p>
<p class="text-sm text-black/60 dark:text-white/60 mb-10">Monitoring all event types</p>
<div class="mt-auto space-y-4">
<h2 class="text-lg font-bold text-black/90 dark:text-white/90">App Status</h2>
<div class="flex items-center gap-4 p-4 rounded-lg bg-primary/10 dark:bg-primary/20">
<div class="relative flex items-center justify-center">
<span class="absolute inline-flex h-full w-full rounded-full bg-primary/50 animate-ping"></span>
<span class="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
</div>
<div>
<p class="font-semibold text-black/90 dark:text-white/90">Online</p>
<p class="text-sm text-black/60 dark:text-white/60">Active and listening for events</p>
</div>
</div>
<div class="p-4 rounded-lg bg-black/5 dark:bg-black/20">
<p class="text-sm text-black/70 dark:text-white/70 mb-2">Events in Memory:</p>
<p id="eventCount" class="text-2xl font-bold text-primary">0</p>
</div>
<div class="flex items-center justify-center gap-2 mt-4">
<p class="text-xs text-black/50 dark:text-white/50">Powered by</p>
<img alt="Heroku" class="h-4 w-auto" src="https://image.s4.sfmc-content.com/lib/fe30117276640675771677/m/1/395e3e25-8f57-43d4-8f70-d1ad230c93ad.png"/>
</div>
</div>
</aside>
<main class="w-2/3 p-6 flex flex-col">
<div class="flex justify-between items-center mb-6 flex-shrink-0">
<h2 class="text-2xl font-bold text-black/90 dark:text-white/90">Recent Events</h2>
<div class="flex items-center gap-3">
<button id="refreshBtn" class="px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded-lg flex items-center gap-2 text-black/90 dark:text-white/90 transition-colors">
<span class="material-symbols-outlined">refresh</span>
<span>Refresh</span>
</button>
<div class="relative">
<select id="eventFilter" class="form-select appearance-none block w-full pl-3 pr-10 py-2 text-base border-primary/20 dark:border-primary/30 bg-background-light dark:bg-background-dark rounded-lg focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-black/90 dark:text-white/90">
<option value="all">All Event Types</option>
<option value="EngagementEvents.OttMobileOriginated">Inbound Messages</option>
<option value="EngagementEvents.OttSent">Sent</option>
<option value="EngagementEvents.OttDelivered">Delivered</option>
<option value="EngagementEvents.OttRead">Read</option>
<option value="EngagementEvents.OttFailed">Failed</option>
</select>
<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black/60 dark:text-white/60">
<span class="material-symbols-outlined"> expand_more </span>
</div>
</div>
</div>
</div>
<div id="errorMessage" class="hidden p-4 mb-4 bg-red-500/20 border-2 border-red-500/50 rounded-lg flex-shrink-0">
<p class="text-red-400 text-sm"></p>
</div>
<div id="eventsContainer" class="flex-1 overflow-y-auto pr-2" style="min-height: 0;">
<div class="grid grid-cols-1 gap-4" id="eventsGrid">
<div class="p-8 text-center text-black/40 dark:text-white/40">
<p>No events yet. Send a WhatsApp message to start seeing events.</p>
</div>
</div>
</main>
</div>

<script>
let currentFilter = 'all';
let expandedEvents = new Set(); // Track which events are expanded

function getEventIcon(eventType) {
  const icons = {
    'EngagementEvents.OttMobileOriginated': '<span class="material-symbols-outlined text-primary"> call_received </span>',
    'EngagementEvents.OttSent': '<span class="material-symbols-outlined text-blue-400"> send </span>',
    'EngagementEvents.OttDelivered': '<span class="material-symbols-outlined text-green-400"> done_all </span>',
    'EngagementEvents.OttRead': '<span class="material-symbols-outlined text-primary" style="font-variation-settings: ' + "'FILL' 1, 'wght' 700" + ';"> done_all </span>',
    'EngagementEvents.OttFailed': '<span class="material-symbols-outlined text-red-400"> error </span>'
  };
  return icons[eventType] || '<span class="material-symbols-outlined text-gray-400"> notification_important </span>';
}

function getEventLabel(eventType) {
  const labels = {
    'EngagementEvents.OttMobileOriginated': 'Inbound Message',
    'EngagementEvents.OttSent': 'Message Sent',
    'EngagementEvents.OttDelivered': 'Message Delivered',
    'EngagementEvents.OttRead': 'Message Read',
    'EngagementEvents.OttFailed': 'Message Failed'
  };
  return labels[eventType] || 'Unknown Event';
}

function getStatusCheckboxes(event) {
  const isSentToSalesforce = event.status === 'sent_to_salesforce';
  const isError = event.status === 'error' || event.status === 'failed';
  const isLogged = event.status === 'logged_only';
  
  let html = '';
  html += '<div class="flex items-center gap-2">';
  html += '<input checked class="form-checkbox h-4 w-4 rounded text-primary bg-primary/20 border-primary/50" disabled type="checkbox"/>';
  html += '<label class="text-sm text-black/80 dark:text-white/80">Webhook Received</label>';
  html += '</div>';
  html += '<div class="flex items-center gap-2">';
  html += '<input checked class="form-checkbox h-4 w-4 rounded text-primary bg-primary/20 border-primary/50" disabled type="checkbox"/>';
  html += '<label class="text-sm text-black/80 dark:text-white/80">Event Processed</label>';
  html += '</div>';
  
  if (isSentToSalesforce) {
    html += '<div class="flex items-center gap-2">';
    html += '<input checked class="form-checkbox h-4 w-4 rounded text-primary bg-primary/20 border-primary/50" disabled type="checkbox"/>';
    html += '<label class="text-sm text-black/80 dark:text-white/80">Sent to Salesforce</label>';
    html += '</div>';
  } else if (isLogged) {
    html += '<div class="flex items-center gap-2">';
    html += '<input class="form-checkbox h-4 w-4 rounded text-gray-400 bg-gray-100 border-gray-300" disabled type="checkbox"/>';
    html += '<label class="text-sm text-black/60 dark:text-white/60">Not Sent to Salesforce (logged only)</label>';
    html += '</div>';
  } else if (isError) {
    html += '<div class="flex items-center gap-2 text-red-400">';
    html += '<span class="material-symbols-outlined text-red-400">error</span>';
    html += '<label class="text-sm">Error - Check Logs</label>';
    html += '</div>';
  }
  
  return html;
}

function renderEvents(events) {
  const grid = document.getElementById('eventsGrid');
  
  if (events.length === 0) {
    grid.innerHTML = '<div class="p-8 text-center text-black/40 dark:text-white/40"><p>No events match the current filter.</p></div>';
    return;
  }
  
  let html = '';
  events.forEach(event => {
    const isExpanded = expandedEvents.has(event.id);
    html += '<details class="group bg-background-light dark:bg-background-dark border-2 border-primary/20 dark:border-primary/30 rounded-lg overflow-hidden hover:bg-primary/10 dark:hover:bg-primary/20" data-event-id="' + event.id + '"' + (isExpanded ? ' open' : '') + '>';
    html += '<summary class="flex items-center justify-between p-4 cursor-pointer">';
    html += '<div class="flex-1 space-y-2">';
    html += '<p class="text-sm text-black/60 dark:text-white/60">ID: ' + event.id + '</p>';
    html += '<div class="flex items-center gap-2">';
    html += getEventIcon(event.eventType);
    html += '<p class="font-bold text-lg text-black/90 dark:text-white/90">' + getEventLabel(event.eventType) + '</p>';
    html += '</div>';
    html += '<p class="text-sm text-black/60 dark:text-white/60">Timestamp: ' + new Date(event.timestamp).toLocaleString() + '</p>';
    html += '<p class="text-sm text-black/60 dark:text-white/60">Mobile: ' + event.mobileNumber + '</p>';
    if (event.journeyName) {
      html += '<p class="text-sm text-black/60 dark:text-white/60">Journey: ' + event.journeyName + '</p>';
    }
    if (event.failureReason) {
      html += '<p class="text-sm text-red-400">Failure: ' + event.failureReason + '</p>';
    }
    html += '<div class="mt-4 space-y-2">';
    html += getStatusCheckboxes(event);
    html += '</div>';
    html += '</div>';
    html += '<span class="material-symbols-outlined transition-transform duration-300 group-open:rotate-180 text-black/60 dark:text-white/60"> expand_more </span>';
    html += '</summary>';
    html += '<div class="p-4 border-t-2 border-primary/20 dark:border-primary/30 bg-background-light dark:bg-black/20">';
    html += '<h3 class="font-semibold mb-2 text-black/90 dark:text-white/90">Full Event Payload</h3>';
    html += '<pre class="text-xs p-3 bg-black/5 dark:bg-black/30 rounded text-black/70 dark:text-white/70 overflow-auto"><code>' + JSON.stringify(event.payload, null, 2) + '</code></pre>';
    html += '</div>';
    html += '</details>';
  });
  grid.innerHTML = html;
  
  // Attach toggle event listeners to track user interactions
  const details = grid.querySelectorAll('details');
  details.forEach(detail => {
    detail.addEventListener('toggle', function() {
      const eventId = this.getAttribute('data-event-id');
      if (this.open) {
        expandedEvents.add(eventId);
        console.log('Expanded:', eventId);
      } else {
        expandedEvents.delete(eventId);
        console.log('Collapsed:', eventId);
      }
    });
  });
}

async function fetchEvents() {
  try {
    console.log('Fetching events from /api/events...');
    const response = await fetch('/api/events?type=' + currentFilter, {
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      throw new Error('HTTP error! status: ' + response.status);
    }
    
    const data = await response.json();
    console.log('Received data:', data);
    
    document.getElementById('eventCount').textContent = data.total;
    renderEvents(data.events);
    
    // Hide error message if successful
    document.getElementById('errorMessage').classList.add('hidden');
  } catch (error) {
    console.error('Error fetching events:', error);
    const errorMsg = document.getElementById('errorMessage');
    errorMsg.querySelector('p').textContent = 'Error loading events: ' + error.message;
    errorMsg.classList.remove('hidden');
  }
}

function manualRefresh() {
  console.log('Manual refresh triggered');
  const btn = document.getElementById('refreshBtn');
  const icon = btn.querySelector('.material-symbols-outlined');
  
  // Animate the refresh icon
  icon.style.animation = 'spin 0.5s linear';
  setTimeout(() => {
    icon.style.animation = '';
  }, 500);
  
  fetchEvents();
}

// Add spin animation
const style = document.createElement('style');
style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
document.head.appendChild(style);

// Manual refresh button
document.getElementById('refreshBtn').addEventListener('click', manualRefresh);

// Event filter
document.getElementById('eventFilter').addEventListener('change', (e) => {
  currentFilter = e.target.value;
  fetchEvents();
});

// Auto-refresh every 3 seconds
setInterval(fetchEvents, 3000);

// Initial load
console.log('Dashboard loaded, fetching initial events...');
fetchEvents();
</script>
</body></html>`);
});

// --- Main Webhook Endpoint ---
app.post('/ens/callback', (req, res) => {
    // 1. Handle ENS Callback Verification
    if (req.body.verificationKey) {
        console.log(`Received verification key: ${req.body.verificationKey}`);
        return res.status(200).send('Verification key received.');
    }

    // 2. Verify the Signature
    const signature = req.header('x-sfmc-ens-signature');
    if (!ENS_SIGNATURE_KEY || !signature) {
        console.warn('Signature key not configured or signature missing from request.');
        return res.status(200).send('Request received, but signature could not be validated.');
    }

    // Decode the base64-encoded signature key from Marketing Cloud
    const decodedKey = Buffer.from(ENS_SIGNATURE_KEY.trim(), 'base64');
    const hash = crypto.createHmac('sha256', decodedKey)
                       .update(req.rawBody)
                       .digest('base64');

    if (hash !== signature) {
        console.error('Invalid signature. Request will be discarded.');
        return res.status(200).send('Invalid signature.');
    }

    // 3. Respond Immediately to ENS
    res.status(200).send('Event received. Processing asynchronously.');

    // 4. Process the Payload Asynchronously
    processPayload(req.body);
});

// --- Asynchronous Processing Logic ---
async function processPayload(payload) {
    console.log(`Processing payload with ${Array.isArray(payload) ? payload.length : 1} event(s).`);
    const events = Array.isArray(payload) ? payload : [payload];

    for (const event of events) {
        const eventType = event.eventCategoryType || 'Unknown';
        const messageId = event.messageId || event.messageKey || 'N/A';
        
        console.log(`Processing event: ${eventType} | Message ID: ${messageId}`);
        
        try {
            // Check if this is an inbound message that should be sent to Salesforce
            if (eventType === 'EngagementEvents.OttMobileOriginated' && SALESFORCE_ENABLED) {
                // Inbound message - create Salesforce record
                const conn = await sfConnectionCache.getConnection();
                
                const record = {
                    Message_ID__c: messageId,
                    Raw_Payload__c: JSON.stringify(event, null, 2).substring(0, 131000)
                };

                const result = await conn.sobject('WhatsApp_Interaction__c').create(record);
                
                if (!result.success) {
                    console.error('Salesforce record creation failed:', result.errors);
                    storeEvent(event, 'failed');
                } else {
                    console.log(`Successfully created Salesforce record: ${result.id}`);
                    storeEvent(event, 'sent_to_salesforce');
                }
            } else {
                // Other event types - log only, don't send to Salesforce
                const reason = !SALESFORCE_ENABLED ? '(Salesforce integration disabled)' : '(not sent to Salesforce)';
                console.log(`Event type ${eventType} logged ${reason}`);
                storeEvent(event, 'logged_only');
            }

        } catch (error) {
            console.error('Error processing event:', error.message);
            console.error('Failed Event Payload:', JSON.stringify(event));
            storeEvent(event, 'error');
        }
    }
}

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`ENS Handler listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Salesforce Instance: ${SF_INSTANCE_URL}`);
});

