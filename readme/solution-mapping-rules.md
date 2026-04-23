# solution-mapping-rules.md
# Solution Mapping Rules — Decision Logic for Picking the Right Solution

## PURPOSE
This file defines the DECISION RULES used to select the right solution for any business problem.
It is the brain of the matching engine. Follow these rules precisely.

---

## RULE 1: ALWAYS IDENTIFY THE PRIMARY PAIN FIRST

Before selecting any solution, answer this question:
> "If this business could fix ONE thing today that would have the biggest positive impact — what would it be?"

That answer drives the primary solution. Everything else is secondary.

---

## RULE 2: PAIN-TO-SOLUTION MAPPING TABLE

| Primary Pain Point | Primary Solution | Secondary Solution |
|---|---|---|
| Payments are late / customers owe money | Automated Payment Reminder System | Billing/Invoicing System |
| Members renewing manually / expiry not tracked | Member/Subscription Management | Automated Payment Reminders |
| Leads not followed up / pipeline unclear | Lead Management System + CRM | Customer Follow-up Automation |
| Customers visit once and don't return | Loyalty & Rewards System | CRM + WhatsApp Follow-up |
| Appointments missed / no-shows | Booking + Reminder System | WhatsApp Automation |
| Staff attendance manual / unreliable | Attendance Tracking System | Dashboard |
| No visibility into revenue / business data | Dashboard / Reporting System | CRM |
| Inventory running out unnoticed | Inventory Management System | Dashboard |
| Customer enquiries not answered quickly | AI Assistant / WhatsApp Bot | Lead Management |
| Billing is manual and delayed | Billing/Invoicing Automation | Payment Reminders |
| Business has no online presence for leads | Website / Landing Page | Lead Management System |
| Customer follow-up is missed consistently | Customer Follow-up Automation | CRM |
| Too many WhatsApp messages to manage | WhatsApp Automation | AI Assistant |

---

## RULE 3: MULTI-PAIN BUSINESSES — WHAT TO DO

If the business has 3 or more pain points across different categories:

**Step 1:** Rank pain points by revenue impact (which one is causing the most money loss?)
**Step 2:** Select primary solution for the highest-impact pain
**Step 3:** Design the solution to ALSO address the 2nd and 3rd pain points where possible
**Step 4:** List others as "Phase 2 additions" in the recommendation

**Example:**
- Gym with: late payments + no attendance tracking + no follow-up for inactive members
- Rank: Late payments = highest revenue loss
- Primary: Automated Payment Reminder System
- Design it to also show attendance data and trigger follow-ups for inactive members
- Result: One integrated system solving all three

---

## RULE 4: WHEN TO RECOMMEND A WEBSITE

A website is the PRIMARY recommendation ONLY when:
- The business has zero online presence AND customers search for them online
- They are running Google/Meta ads and need a landing page
- They sell products/services that can be purchased online
- They are a new business needing to establish credibility

A website is SECONDARY when:
- The core problem is operational (payments, attendance, retention)
- They already get customers through referral or walk-in
- Their customers don't search Google for their service

A website is NOT NEEDED INITIALLY when:
- The problem is purely internal (tracking, billing, inventory)
- WhatsApp or social media is already their primary channel
- They need to fix retention before acquisition

---

## RULE 5: WHEN TO PROPOSE A CUSTOM / NEW SOLUTION

Propose a custom solution when:
1. The use case doesn't match any predefined solution above
2. The business has a UNIQUE workflow that no off-the-shelf tool covers
3. Combining 2+ predefined solutions still leaves a gap
4. The business is in a niche industry not covered in industry-usecases.md

**How to name a custom solution:**
- Be descriptive: "Client Project Portal for Wedding Photographers"
- Not generic: Not "Custom System" or "Special Tool"

**Custom solution must still include:**
- Clear description of what it does
- Tech stack recommendation
- Feature list
- Pricing / monetization

---

## RULE 6: COMBO SOLUTIONS (WHEN ONE IS NOT ENOUGH)

Some businesses need 2 solutions working together. Common combos:

| Business | Best Combo |
|---|---|
| Gym | Member Management + Payment Reminders + Attendance |
| Salon | Loyalty System + WhatsApp Automation + Booking |
| Coaching Center | Fee Reminders + Attendance + Lead CRM |
| Real Estate | CRM + Lead Pipeline + Follow-up Automation |
| Clinic | Appointment System + Reminder Bot + Patient CRM |
| Freelancer/Agency | Invoicing + Client CRM + Project Tracker |

When recommending a combo, always name the PRIMARY solution first and explain how the secondary solutions plug in.

---

## RULE 7: BUILD APPROACH SELECTION

| Complexity Level | Recommended Approach | Examples |
|---|---|---|
| Low (1-2 features, small business) | No-Code | Airtable + Softr, Google Sheets + Make.com |
| Medium (3-5 features, growing business) | Low-Code / No-Code hybrid | Zoho suite, Glide, Retool, Webflow |
| High (complex logic, scaling business) | Custom Dev | React + Node.js + MongoDB, Django, custom APIs |

**Key Rule:** Always recommend the SIMPLEST build approach that solves the problem.
Don't recommend custom code when no-code works. Don't recommend no-code when it will break at scale.

---

## RULE 8: PRICING LOGIC

| Solution Type | Setup Fee Range (₹) | Monthly Retainer Range (₹) |
|---|---|---|
| Simple automation (1-2 flows) | 5,000 – 15,000 | 1,500 – 3,000 |
| CRM / Lead System (no-code) | 15,000 – 35,000 | 3,000 – 6,000 |
| Member Management System | 20,000 – 50,000 | 4,000 – 8,000 |
| Full Dashboard + Reporting | 25,000 – 60,000 | 5,000 – 10,000 |
| WhatsApp Automation (basic) | 8,000 – 20,000 | 2,000 – 5,000 |
| Custom Full-Stack Solution | 50,000 – 2,00,000 | 8,000 – 20,000 |
| AI Chatbot / Assistant | 20,000 – 80,000 | 5,000 – 15,000 |

**These are INDIAN market rates.** Adjust for other markets as needed.

---

## RULE 9: NEVER DO THESE

- Never recommend enterprise tools (Salesforce, SAP) for small local businesses
- Never recommend an app when a WhatsApp bot solves the same problem
- Never suggest "build everything at once" — always phase the solution
- Never ignore the business's budget or technical capacity
- Never give a solution that requires the business owner to learn complex tools

---

*This file is the core decision engine. Every solution recommendation must pass through these rules.*
