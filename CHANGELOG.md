# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-17

### Added
- Initial release of WhatsApp ENS Event Monitor
- ENS webhook endpoint with HMAC-SHA256 signature verification
- Salesforce JWT Bearer Flow authentication (RS256)
- Support for multiple ENS event types:
  - OttMobileOriginated (Inbound messages)
  - OttSent (Sent messages)
  - OttDelivered (Delivered messages)
  - OttRead (Read receipts)
  - OttFailed (Failed messages)
- Real-time web dashboard for event monitoring
- In-memory event storage (last 100 events)
- Auto-refresh dashboard (3-second intervals)
- Manual refresh button with loading animation
- Event type filtering (All, Inbound, Sent, Delivered, Read, Failed)
- Expandable event tiles with full JSON payload view
- Status indicators for event processing stages
- Responsive design with dark mode support
- Health check endpoint
- JSON API endpoint for events (`/api/events`)
- Comprehensive error handling and logging
- Automatic Salesforce record creation for inbound messages

### Security
- Certificate-based JWT authentication
- HMAC-SHA256 webhook signature verification
- Environment variable-based configuration
- Pre-authorized Connected App with minimal permissions
- No password storage

### Documentation
- Complete README.md with step-by-step deployment guide
- QUICKSTART.md for rapid deployment
- CONTRIBUTING.md for customization guidance
- Detailed Salesforce Connected App setup instructions
- Environment variable reference
- Troubleshooting guide
- API endpoint documentation

### Infrastructure
- Heroku-ready with Procfile
- Node.js 18+ support
- Express.js server
- jsforce for Salesforce API
- axios and jsonwebtoken for JWT flow
- Tailwind CSS for UI styling

## [Unreleased]

### Planned Features
- PostgreSQL database integration for persistent storage
- Event replay functionality for failed processes
- Slack/email notifications for errors
- Analytics and reporting dashboard
- Bulk event processing
- Rate limiting
- Automated testing suite
- Docker containerization
- GraphQL API
- Multi-language support
- Admin configuration panel

---

## Version History

### Version 1.0.0 (Current)
**Release Date:** January 17, 2025

**Key Features:**
- Production-ready ENS event handler
- Real-time monitoring dashboard
- Automatic Salesforce record creation
- Multi-event type support

**System Requirements:**
- Node.js 18+
- Heroku (free tier compatible)
- Salesforce org with API access
- Marketing Cloud with WhatsApp enabled

**Known Limitations:**
- 100 event in-memory limit (no persistent storage)
- Manual ENS callback registration required
- Single Salesforce object support per event type
- No event replay for failures

---

## Upgrade Guide

### From 0.x to 1.0.0
Not applicable - initial release

### Future Upgrades
Check this section for breaking changes and migration guides when upgrading between versions.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

