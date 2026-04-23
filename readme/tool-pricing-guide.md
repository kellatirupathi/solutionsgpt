# tool-pricing-guide.md
# Real Tool Pricing, Free Tier Limits & Cost Estimation Guide
# Last Updated: April 2026 — Always verify on official websites before quoting

---

## HOW TO USE THIS FILE
When recommending a tech stack, ALWAYS:
1. Check free tier limits vs client's expected usage (members, messages, automations)
2. Calculate total monthly tool cost before recommending
3. Add tool costs into your setup + retainer pricing
4. Warn client when they will outgrow free tier

---

## 📊 DATABASE / BACKEND TOOLS

### Airtable — airtable.com/pricing
| Plan | Price | Records | Automations | Storage |
|---|---|---|---|---|
| Free | ₹0 | 1,000/base | 100 runs/month | 1 GB |
| Team | ~₹1,700/user/month | 50,000/base | 25,000 runs/month | 20 GB |
| Business | ~₹4,200/user/month | 125,000/base | 100,000 runs/month | 100 GB |

**Free Tier Reality Check:**
- 1,000 records = suitable for gyms with <500 members (member + attendance = 2 records/member)
- 100 automations/month = NOT enough for daily reminders at scale
- Upgrade needed at: >400 members OR >100 automated actions/month

**Cost Estimate for Gym (200 members):** Free tier works. ₹0/month
**Cost Estimate for Gym (500+ members):** Team plan = ~₹3,400/month (2 users)

---

### Supabase — supabase.com/pricing
| Plan | Price | Rows | Storage | Bandwidth | Auth Users |
|---|---|---|---|---|---|
| Free | ₹0 | 500MB DB | 1 GB | 5 GB/month | 50,000 |
| Pro | ~₹2,075/month | 8 GB DB | 100 GB | 250 GB/month | 100,000 |
| Team | ~₹33,200/month | Unlimited | Unlimited | Unlimited | Unlimited |

**Free Tier Reality Check:**
- 500MB = ~1 million rows — plenty for small-medium gyms
- Pauses after 1 week of inactivity (free tier) — NOT suitable for production
- Pro plan needed for any real business use

**Cost Estimate:** Pro = ~₹2,075/month flat (not per user)

---

### Google Sheets — workspace.google.com/pricing
| Plan | Price | Storage |
|---|---|---|
| Personal (Gmail) | ₹0 | 15 GB shared |
| Workspace Starter | ~₹125/user/month | 30 GB/user |

**Free Tier Reality Check:**
- Completely free for basic use
- No row limits for practical purposes
- Breaks down with complex automations or >5,000 rows
- Not recommended for production — use Airtable or Supabase instead

**Cost Estimate:** ₹0 for small use. Not scalable beyond basic tracking.

---

### Firebase (Firestore) — firebase.google.com/pricing
| Plan | Price | Reads | Writes | Storage |
|---|---|---|---|---|
| Spark (Free) | ₹0 | 50,000/day | 20,000/day | 1 GB |
| Blaze (Pay as you go) | ~₹6.60/100K reads | Unlimited | Unlimited | ~₹2.07/GB |

**Free Tier Reality Check:**
- 50,000 reads/day = fine for apps with <200 daily active users
- Blaze plan required for production (but pay-as-you-go is very affordable at small scale)
- Estimated cost for gym app: ~₹500–₹1,500/month on Blaze

---

## ⚙️ AUTOMATION / WORKFLOW TOOLS

### Make.com — make.com/en/pricing
| Plan | Price | Operations/month | Active Scenarios |
|---|---|---|---|
| Free | ₹0 | 1,000 | 2 |
| Core | ~₹830/month | 10,000 | Active scenarios unlimited |
| Pro | ~₹1,660/month | 10,000 | Unlimited + priority |
| Teams | ~₹2,900/month | 10,000 | Unlimited + team features |

**Free Tier Reality Check:**
- 1,000 operations = ~33 automated messages/day
- 2 active scenarios = NOT enough for real business (need at least 4–5 flows)
- Core plan needed for any real client deployment

**Operations Estimate for Gym (200 members):**
- Daily attendance log: 200 ops/day = 6,000/month
- Weekly reminders: ~200 ops/week = 800/month
- Total: ~7,000 ops/month → Core plan sufficient

**Cost Estimate:** Core = ~₹830/month

---

### n8n — n8n.io/pricing
| Plan | Price | Executions/month | Active Workflows |
|---|---|---|---|
| Free (Self-host) | ₹0 | Unlimited | Unlimited |
| Starter (Cloud) | ~₹1,660/month | 2,500 | 5 |
| Pro (Cloud) | ~₹4,150/month | 10,000 | 15 |

**Free Tier Reality Check:**
- Self-hosted = FREE and unlimited — best for cost-conscious builds
- Cloud starter = limited executions, not great value vs Make.com
- Recommend: Self-host on Railway (~₹415/month) or Render (free tier)

**Cost Estimate (Self-hosted on Railway):** ~₹415/month total

---

### Zapier — zapier.com/pricing
| Plan | Price | Tasks/month | Zaps |
|---|---|---|---|
| Free | ₹0 | 100 | 5 (single-step) |
| Starter | ~₹1,660/month | 750 | 20 |
| Professional | ~₹4,150/month | 2,000 | Unlimited |

**Free Tier Reality Check:**
- 100 tasks/month = NOT viable for any real business automation
- More expensive than Make.com for same functionality
- Recommendation: Use Make.com instead of Zapier unless client is already on Zapier

---

## 📱 WHATSAPP API TOOLS

### AiSensy — aisensy.com/pricing
| Plan | Price | Monthly Active Users | Agents |
|---|---|---|---|
| Free Trial | ₹0 | 100 MAU (30 days) | 1 |
| Basic | ₹999/month | 1,000 MAU | 2 |
| Pro | ₹2,399/month | 5,000 MAU | 5 |
| Enterprise | Custom | Unlimited | Unlimited |

**+ WhatsApp Conversation Charges (Meta pricing):**
- Business-initiated (India): ~₹0.58–₹0.79/conversation
- User-initiated: ~₹0.29/conversation
- Free: 1,000 conversations/month (user-initiated)

**Cost Estimate for Gym (200 members, 500 msgs/month):**
- AiSensy Basic: ₹999/month
- Meta conversation charges: ~₹150–₹300/month
- Total WhatsApp cost: ~₹1,150–₹1,300/month

---

### Interakt — interakt.shop/pricing
| Plan | Price | MAU | Agents |
|---|---|---|---|
| Growth | ₹2,756/month | 2,000 | 2 |
| Advanced | ₹4,299/month | 5,000 | 5 |
| Enterprise | Custom | Unlimited | Unlimited |

**+ Meta conversation charges apply separately**

**Cost Estimate for Gym:** Growth plan = ~₹2,756 + ~₹300 Meta = ~₹3,056/month
**Verdict:** More expensive than AiSensy — use AiSensy for small gyms

---

### Wati — wati.io/pricing
| Plan | Price | MAU | Notes |
|---|---|---|---|
| Growth | ~₹3,700/month | 1,000 | |
| Pro | ~₹6,200/month | 5,000 | |

**Cost Estimate:** Expensive for small businesses — use AiSensy instead

---

### 360dialog — 360dialog.com/pricing
| Plan | Price | Notes |
|---|---|---|
| Self-service | €49/month (~₹4,500) | Direct API access |
| Partner | Custom | White-label option |

**Best for:** Developers building custom WhatsApp integrations
**+ Meta conversation charges apply**

---

## 💳 PAYMENT GATEWAYS

### Razorpay — razorpay.com/pricing
| Feature | Cost |
|---|---|
| Setup Fee | ₹0 |
| Monthly Fee | ₹0 |
| Transaction Fee | 2% per transaction |
| UPI | 0% (currently) |
| International Cards | 3% per transaction |
| Payment Links | Free to create |

**Cost Estimate for Gym (₹2,000 avg fee, 100 members paying):**
- 100 × ₹2,000 = ₹2,00,000/month collected
- 2% fee = ₹4,000/month to Razorpay
- Inform client: factor this into membership pricing

---

### Stripe — stripe.com/en-in/pricing
| Feature | Cost |
|---|---|
| Setup Fee | ₹0 |
| Monthly Fee | ₹0 |
| Transaction Fee | 2.9% + ₹25 per transaction |
| International | 3.9% + ₹25 |

**Verdict:** More expensive than Razorpay for Indian businesses. Use Stripe only for international payments.

---

### Cashfree — cashfree.com/pricing
| Feature | Cost |
|---|---|
| Transaction Fee | 1.75% per transaction |
| UPI | 0% |
| Monthly Fee | ₹0 |

**Verdict:** Cheapest transaction fee in India. Good alternative to Razorpay for cost-sensitive clients.

---

## 🖥️ FRONTEND / CLIENT PORTAL TOOLS

### Softr — softr.io/pricing
| Plan | Price | App Users | Apps |
|---|---|---|---|
| Free | ₹0 | 5 users | 1 app |
| Basic | ~₹1,660/month | 20 users | 1 app |
| Professional | ~₹4,150/month | 50 users | 3 apps |
| Business | ~₹8,300/month | 200 users | 10 apps |

**Free Tier Reality Check:**
- 5 users = demo only, not production-ready
- Basic plan for small gym portal: ~₹1,660/month

---

### Glide — glideapps.com/pricing
| Plan | Price | Users | Rows |
|---|---|---|---|
| Free | ₹0 | 10 | 500 |
| Maker | ~₹4,150/month | 10 | 25,000 |
| Team | ~₹8,300/month | 25 | 25,000 |
| Business | ~₹20,700/month | 250 | 25,000 |

**Free Tier Reality Check:**
- 10 users + 500 rows = demo only
- Glide is expensive for what it offers — Softr is better value for portals

---

### Bubble — bubble.io/pricing
| Plan | Price | Notes |
|---|---|---|
| Free | ₹0 | bubble.io subdomain, limited capacity |
| Starter | ~₹1,900/month | Custom domain, 2 app editors |
| Growth | ~₹8,300/month | More capacity, logs |
| Team | ~₹20,700/month | Full features |

---

## 📊 REPORTING / DASHBOARD TOOLS

### Google Looker Studio
| Plan | Price | Notes |
|---|---|---|
| Free | ₹0 | Unlimited reports, unlimited |

**Verdict:** Completely free. Always recommend as first choice for reporting.

---

### Metabase — metabase.com/pricing
| Plan | Price | Notes |
|---|---|---|
| Open Source (Self-host) | ₹0 | Full features, self-hosted |
| Cloud Starter | ~₹4,150/month | 5 users |
| Pro Cloud | ~₹20,700/month | 10 users |

**Verdict:** Self-host on Railway (~₹415/month) for free Metabase

---

### Retool — retool.com/pricing
| Plan | Price | Notes |
|---|---|---|
| Free | ₹0 | 5 users, Retool subdomain |
| Team | ~₹830/user/month | Custom domain |
| Business | ~₹2,490/user/month | SSO, audit logs |

---

## 🏗️ HOSTING / INFRASTRUCTURE

### Railway — railway.app/pricing
| Plan | Price | Notes |
|---|---|---|
| Hobby | $5/month (~₹415) | $5 credit included |
| Pro | $20/month (~₹1,660) | Team features |

**Best for:** Hosting n8n, Metabase, Node.js backends

---

### Render — render.com/pricing
| Service | Free Tier | Paid |
|---|---|---|
| Web Service | Free (spins down after inactivity) | $7/month (~₹580) |
| PostgreSQL | 90-day free trial | $7/month (~₹580) |

---

## 🧮 COST ESTIMATION CALCULATOR — EXAMPLE: GYM (200 MEMBERS)

| Tool | Plan | Monthly Cost |
|---|---|---|
| Airtable | Free (under 1000 records) | ₹0 |
| Make.com | Core (10,000 ops) | ₹830 |
| AiSensy | Basic (1,000 MAU) | ₹999 |
| Meta WhatsApp charges | ~500 conversations | ₹300 |
| Razorpay | 2% of ₹4,00,000 collected | ₹8,000* |
| Softr Portal | Basic (20 users) | ₹1,660 |
| Google Looker Studio | Free | ₹0 |
| **Total Tool Cost** | | **~₹3,789/month** |

*Razorpay fee is paid by gym from collections — not your cost. Inform client separately.

**Your cost to run this system:** ~₹3,789/month in tools
**Your retainer to client:** ₹5,000–₹6,000/month
**Your margin:** ₹1,211–₹2,211/month after tool costs

---

## 🧮 COST ESTIMATION CALCULATOR — GYM (500 MEMBERS)

| Tool | Plan | Monthly Cost |
|---|---|---|
| Airtable | Team (50,000 records, 2 users) | ₹3,400 |
| Make.com | Pro (10,000 ops) | ₹1,660 |
| AiSensy | Pro (5,000 MAU) | ₹2,399 |
| Meta WhatsApp charges | ~1,500 conversations | ₹900 |
| Softr Portal | Professional (50 users) | ₹4,150 |
| Google Looker Studio | Free | ₹0 |
| **Total Tool Cost** | | **~₹12,509/month** |

**Your retainer to client:** ₹18,000–₹22,000/month
**Your margin:** ₹5,500–₹9,500/month

---

---

## 🧮 COST ESTIMATION CALCULATORS — ALL INDUSTRIES

---

### 💇 SALON (50–100 clients/month)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Free | ₹0 | <1,000 records fine |
| Make.com | Core | ₹830 | Booking + reminder flows |
| AiSensy | Basic | ₹999 | WhatsApp reminders + follow-up |
| Meta WhatsApp charges | ~200 conversations | ₹120 | |
| Softr Portal | Free → Basic | ₹0–₹1,660 | Optional client portal |
| Google Looker Studio | Free | ₹0 | Reports |
| **Total Tool Cost** | | **₹1,949–₹3,609/month** | |

**Your retainer to client:** ₹4,500–₹6,000/month | **Your margin:** ₹891–₹4,051/month
**Free Tier Warning:** Airtable free works up to ~400 client records. AiSensy free trial = 30 days only.

---

### 🏥 CLINIC (50–150 appointments/month)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Free | ₹0 | Patient records + appointments |
| Make.com | Core | ₹830 | Appointment reminder flows |
| AiSensy | Basic | ₹999 | Appointment + follow-up WhatsApp |
| Meta WhatsApp charges | ~300 conversations | ₹180 | |
| Cal.com | Free | ₹0 | Online booking (open-source) |
| Google Looker Studio | Free | ₹0 | |
| **Total Tool Cost** | | **₹2,009/month** | |

**Your retainer to client:** ₹4,000–₹6,000/month | **Your margin:** ₹1,991–₹3,991/month
**Free Tier Warning:** Cal.com is fully free and open-source — use instead of paid Calendly for budget clinics.

---

### 🏫 COACHING / TUITION CENTER (100–300 students)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Free → Team | ₹0–₹3,400 | Student + fee records |
| Make.com | Core | ₹830 | Fee reminder automation |
| AiSensy | Basic → Pro | ₹999–₹2,399 | Parent + student WhatsApp |
| Meta WhatsApp charges | ~600 conversations | ₹360 | |
| Google Looker Studio | Free | ₹0 | Fee collection dashboard |
| **Total Tool Cost (100 students)** | | **₹2,189/month** | |
| **Total Tool Cost (300 students)** | | **₹6,989/month** | |

**Retainer (100 students):** ₹4,500/month → margin ₹2,311 | **Retainer (300 students):** ₹10,000/month → margin ₹3,011
**Free Tier Warning:** Airtable free breaks at ~300 student+attendance records. Upgrade to Team at ~250 students.

---

### 🏠 REAL ESTATE AGENCY (5–15 agents, 50–200 leads/month)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Team (2 users) | ₹3,400 | Lead + deal pipeline |
| Make.com | Core | ₹830 | Lead routing + follow-up |
| AiSensy | Pro | ₹2,399 | Agent notifications + lead msgs |
| Meta WhatsApp charges | ~800 conversations | ₹480 | |
| Softr Portal | Professional | ₹4,150 | Agent + admin portal |
| Google Looker Studio | Free | ₹0 | Pipeline + conversion reports |
| **Total Tool Cost** | | **~₹11,259/month** | |

**Your retainer to client:** ₹18,000–₹25,000/month | **Your margin:** ₹6,741–₹13,741/month
**Free Tier Warning:** Real estate needs multi-user access — Airtable free (1 user) won't work. Start on Team plan from day one.

---

### 🍽️ RESTAURANT (WhatsApp ordering + loyalty, 200–500 orders/month)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Free | ₹0 | Menu + customer database |
| Make.com | Core | ₹830 | Order flow + loyalty trigger |
| AiSensy | Basic → Pro | ₹999–₹2,399 | Order bot + promo broadcasts |
| Meta WhatsApp charges | ~500 conversations | ₹300 | |
| Razorpay | 2% per txn | % only | Online order payment |
| Google Looker Studio | Free | ₹0 | Sales + order reports |
| **Total Tool Cost** | | **₹2,129–₹3,529/month** | |

**Your retainer to client:** ₹5,000–₹8,000/month | **Your margin:** ₹2,471–₹5,871/month
**Free Tier Warning:** Upgrade AiSensy to Pro if >500 unique WhatsApp customers/month.

---

### 🚗 AUTO WORKSHOP / GARAGE (30–80 jobs/month)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Free | ₹0 | Job cards + vehicle records |
| Make.com | Core | ₹830 | Service reminder automation |
| AiSensy | Basic | ₹999 | Job status + service reminders |
| Meta WhatsApp charges | ~200 conversations | ₹120 | |
| Google Looker Studio | Free | ₹0 | |
| **Total Tool Cost** | | **₹1,949/month** | |

**Your retainer to client:** ₹4,000–₹5,500/month | **Your margin:** ₹2,051–₹3,551/month

---

### 💻 FREELANCER / DIGITAL AGENCY (10–30 active clients)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Free → Team | ₹0–₹3,400 | Client + project database |
| Make.com | Core | ₹830 | Invoice reminder automation |
| Zoho Invoice | Free → Paid | ₹0–₹830 | Invoice generation (free = 5 clients) |
| AiSensy | Basic | ₹999 | Client follow-up WhatsApp |
| Meta WhatsApp charges | ~150 conversations | ₹90 | |
| Softr | Basic | ₹1,660 | Client portal |
| **Total Tool Cost (10 clients)** | | **₹1,919/month** | |
| **Total Tool Cost (30 clients)** | | **₹7,809/month** | |

**Free Tier Warning:** Zoho Invoice free = 5 clients only. At 6+ clients upgrade to paid (~₹830/month).

---

### 🏗️ CONTRACTOR / CONSTRUCTION (3–10 active projects)

| Tool | Plan | Monthly Cost | Notes |
|---|---|---|---|
| Airtable | Free | ₹0 | Project + milestone tracking |
| Make.com | Core | ₹830 | Milestone payment reminders |
| AiSensy | Basic | ₹999 | Client updates via WhatsApp |
| Meta WhatsApp charges | ~150 conversations | ₹90 | |
| Zoho Invoice | Free | ₹0 | Milestone invoices |
| Google Looker Studio | Free | ₹0 | Project cost dashboard |
| **Total Tool Cost** | | **₹1,919/month** | |

**Your retainer to client:** ₹4,000–₹6,000/month | **Your margin:** ₹2,081–₹4,081/month

---

## 📊 QUICK MARGIN REFERENCE TABLE — ALL INDUSTRIES

| Industry | Est. Tool Cost/month | Recommended Retainer | Your Margin |
|---|---|---|---|
| Gym (200 members) | ₹3,789 | ₹6,000 | ₹2,211 |
| Gym (500 members) | ₹12,509 | ₹20,000 | ₹7,491 |
| Salon (50–100 clients) | ₹1,949 | ₹5,000 | ₹3,051 |
| Clinic (50–150 appts) | ₹2,009 | ₹5,000 | ₹2,991 |
| Coaching (100 students) | ₹2,189 | ₹4,500 | ₹2,311 |
| Coaching (300 students) | ₹6,989 | ₹10,000 | ₹3,011 |
| Real Estate (5–15 agents) | ₹11,259 | ₹22,000 | ₹10,741 |
| Restaurant (200–500 orders) | ₹2,129 | ₹6,000 | ₹3,871 |
| Auto Workshop | ₹1,949 | ₹4,500 | ₹2,551 |
| Freelancer/Agency (10 clients) | ₹1,919 | ₹4,500 | ₹2,581 |
| Contractor (3–10 projects) | ₹1,919 | ₹5,000 | ₹3,081 |

**Rule: Never quote a retainer below (Tool Cost × 1.4). That is your floor.**

## ⚠️ FREE TIER UPGRADE TRIGGER POINTS

| Tool | Upgrade When... |
|---|---|
| Airtable Free | >800 records OR >80 automations/month |
| Make.com Free | >2 automation flows needed |
| AiSensy Free | Trial ends (30 days) — always move to Basic |
| Supabase Free | Going live (pauses after inactivity) |
| Softr Free | >5 users need portal access |
| Glide Free | >10 users OR >500 rows |
| n8n Cloud Free | Any serious automation — self-host instead |

---

## 📌 PRICING RULES WHEN QUOTING CLIENTS

1. **Calculate actual tool cost first** — then add your margin on top
2. **Never quote below tool cost + 40% margin** — that's your minimum
3. **Always show client their tool cost separately** — builds trust and transparency
4. **Razorpay/payment fees** — always separate from your retainer, client pays directly
5. **Meta WhatsApp charges** — client pays directly to Meta via AiSensy/Interakt dashboard
6. **Annual plans** — most tools offer 20–30% discount on annual billing — mention to client

---

*Prices are in INR where shown. USD prices converted at ~₹83/USD. Always verify current pricing at official tool websites before quoting clients.*
