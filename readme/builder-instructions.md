# builder-instructions.md
# Builder Instructions — Tech Stack, Tools, and Build Guidance

## PURPOSE
When recommending HOW to build a solution, always reference this file for:
- Preferred tools per use case
- Build complexity ratings
- Integration patterns
- What to avoid

---

## 🔧 TOOL REFERENCE BY CATEGORY

### DATABASE / BACKEND
| Tool | Best For | Free Tier | Difficulty |
|---|---|---|---|
| Airtable | Small-medium data, visual, no-code | Yes (1000 rows) | Low |
| Google Sheets | Very simple, familiar to clients | Yes | Low |
| Notion | Knowledge + lightweight DB | Yes | Low |
| Supabase | Scalable, real-time, SQL | Yes | Medium |
| Firebase | Real-time apps, mobile | Yes | Medium |
| PostgreSQL + Railway | Production-grade, free hosting | Yes | High |
| MongoDB Atlas | Flexible schema, cloud | Yes | High |

**Rule:** Use Airtable or Google Sheets for small businesses. Use Supabase/Firebase for medium businesses. Use PostgreSQL/MongoDB for large or scaling solutions.

---

### AUTOMATION / WORKFLOW
| Tool | Best For | Free Tier | Difficulty |
|---|---|---|---|
| Make.com (formerly Integromat) | Complex multi-step flows | Yes (1000 ops) | Low-Medium |
| Zapier | Simple 2-step automations | Yes (100 tasks) | Low |
| n8n | Self-hosted, complex flows, free | Yes (self-host) | Medium |
| Zoho Flow | Zoho ecosystem automation | Yes | Low |
| Power Automate | Microsoft/Office 365 users | Yes | Medium |

**Rule:** Default to Make.com for most automation needs. Use n8n when client wants self-hosted or free tier at scale.

---

### WHATSAPP / MESSAGING
| Tool | Best For | Pricing |
|---|---|---|
| Wati | Small-medium business, easy UI | ₹2,500/month |
| Interakt | Indian market, good support | ₹2,000/month |
| AiSensy | Broadcasts + bot + CRM combo | ₹999/month |
| 360dialog | Developer-friendly, direct API | €49/month |
| Twilio | Custom builds, global | Pay-per-message |
| MSG91 | Indian market, bulk SMS + WhatsApp | ₹1,500/month |

**Rule:** For small local businesses — AiSensy or Interakt. For custom builds — 360dialog + Make.com. For enterprise — Twilio.

---

### FRONTEND / CLIENT-FACING PORTALS
| Tool | Best For | Free Tier | Difficulty |
|---|---|---|---|
| Softr | Airtable-connected portals, no-code | Yes | Low |
| Glide | Mobile-first apps from Google Sheets | Yes | Low |
| Webflow | Marketing sites + CMS | Yes | Medium |
| Bubble | Full web app, no-code | Yes | Medium |
| React + Next.js | Custom, scalable, full-control | Open source | High |
| Flutter | Mobile apps (Android + iOS) | Open source | High |

**Rule:** Use Softr/Glide for client portals. Use Bubble for complex web apps. Use React/Next.js for production-grade custom solutions.

---

### PAYMENT PROCESSING
| Tool | Best For | Fees |
|---|---|---|
| Razorpay | India-first, easy integration | 2% per transaction |
| Stripe | International, developer-friendly | 2.9% + $0.30 |
| PayU | Indian market, UPI support | 2% per transaction |
| Cashfree | Payouts + collections, India | 1.75% per transaction |
| Instamojo | Small businesses, simple | 2% + ₹3 |

**Rule:** Default to Razorpay for Indian businesses. Use Stripe for international or SaaS products.

---

### CRM PLATFORMS
| Tool | Best For | Free Tier | Difficulty |
|---|---|---|---|
| Zoho CRM | Full-featured, Indian market friendly | Yes (3 users) | Medium |
| HubSpot | Marketing + CRM combo | Yes (unlimited users) | Medium |
| Freshsales | Sales-focused CRM | Yes (unlimited users) | Low-Medium |
| Pipedrive | Pipeline visualization | No (14-day trial) | Low |
| Airtable CRM template | Simple, customizable | Yes | Low |
| Custom Airtable + Softr | Tailored client-specific CRM | Yes | Low-Medium |

**Rule:** For small businesses — Zoho CRM free or custom Airtable. For sales-heavy businesses — Freshsales or Pipedrive. For marketing + CRM — HubSpot.

---

### REPORTING / DASHBOARDS
| Tool | Best For | Free Tier | Difficulty |
|---|---|---|---|
| Google Looker Studio | Free, connects to Sheets/DB | Yes | Low |
| Metabase | Self-hosted, SQL queries | Yes | Medium |
| Power BI | Microsoft ecosystem | Free desktop | Medium |
| Retool | Internal admin dashboards | Yes | Medium |
| Grafana | Technical/operational dashboards | Yes | High |
| Custom React + Chart.js | Full custom UI | Open source | High |

**Rule:** Use Looker Studio for free reporting. Use Retool for internal tools. Use custom React for branded dashboards sold to clients.

---

## 📐 BUILD COMPLEXITY GUIDE

### 🟢 LOW COMPLEXITY (Build in 1–3 days)
- Single automation flow (e.g., payment reminder via WhatsApp)
- Simple lead capture form → notification
- Basic spreadsheet with auto-email
- Tech: Google Sheets + Make.com + WhatsApp API

### 🟡 MEDIUM COMPLEXITY (Build in 1–2 weeks)
- CRM with pipeline stages and follow-up triggers
- Member management with renewal reminders
- Booking system with calendar + reminders
- Tech: Airtable + Softr + Make.com + WhatsApp

### 🔴 HIGH COMPLEXITY (Build in 3–8 weeks)
- Full custom dashboard with role-based access
- Multi-location business management system
- AI-powered chatbot with custom training
- Tech: React + Node.js + Supabase + WhatsApp API + Stripe

---

## 🔌 COMMON INTEGRATION PATTERNS

### Pattern 1: WhatsApp Reminder System
```
Airtable (data) → Make.com (trigger on date) → WhatsApp API → Customer
```

### Pattern 2: Lead CRM with Follow-up
```
Form/Ad → Airtable (lead created) → Make.com → WhatsApp notification to sales team → CRM stage updated manually or auto
```

### Pattern 3: Member Management + Payment
```
Member data in Airtable → Make.com checks expiry daily → If expiring in 7 days → Send WhatsApp → If paid → Update status → If not paid in 3 days → Send escalation
```

### Pattern 4: Full Client Portal
```
Softr (client login) → Airtable (data source) → Make.com (automation) → WhatsApp/email notifications → Razorpay (payment)
```

### Pattern 5: AI Chatbot
```
WhatsApp message → Wati/360dialog webhook → Make.com → OpenAI API → Response back to WhatsApp
```

---

## ⚠️ WHAT TO AVOID

- Don't recommend Salesforce or SAP for any small business
- Don't recommend building a mobile app when a responsive web app works
- Don't use Zapier for complex multi-step automations (too expensive at scale)
- Don't host databases on client's local machine — always cloud
- Don't skip WhatsApp API approval — build the application FIRST, get approved before promising delivery
- Don't build everything custom if no-code solves it within 80% of requirements

---

*Reference this file for all technical recommendations in every response.*
