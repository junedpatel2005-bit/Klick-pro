# SCOPE OF DEVELOPMENT — MASTER DOCUMENT

**Merged from:** `Scope Of Development.docx` (full scope) + `Scope Of Development-Phase-1.docx`

Every feature from both documents appears below. Nothing has been dropped. Each line carries a phase tag so one document can serve as the single source of truth.

## Legend

| Tag          | Meaning                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| **[P1]**     | In Phase 1 — present in both source documents                                 |
| **[P2]**     | Phase 2 — in the full scope, removed from Phase 1                             |
| **[FUTURE]** | Explicitly marked "Future Scope" in the source document                       |
| **⚠**        | Conflict or dependency gap — see _Open Decisions_ at the end of this document |

**Platforms:** All client-side and professional-side features apply to the **Website Portal**, **iOS App**, and **Android App** unless stated otherwise.

---

# 1) WEBSITE (Before Login)

For visitors landing on the platform for the first time.

## Main Pages

- Home page **[P1]**
- About Us **[P1]**
- How It Works **[P1]**
- Services / Categories **[P1]**
- For Clients **[P1]**
- For Professionals **[P1]**
- Pricing / Fees / Commission **[P1]**
- FAQ **[P1]**
- Contact Us **[P1]**
- Privacy Policy **[P1]**
- Terms & Conditions **[P1]**

---

# 2) 👤 CLIENT SIDE FEATURES

_Client = person or business posting a job._

Available in: **Website Portal**, **iOS App**, **Android App**

## A. Client Registration / Login

- Email signup **[P1]**
- Phone signup **[P1]**
- Google login (optional) **[P1]**
- Forgot password **[P1]**
- OTP verification **[P1]**
- Profile setup **[P1]**

## B. Client Profile

Client should be able to:

- Add name **[P1]**
- Company name (optional) **[P1]**
- Address **[P1]**
- Profile photo **[P1]**
- Saved locations **[P1]**
- Billing details **[FUTURE]**
- Payment method **[FUTURE]**

## C. Job / Project Posting

_Core feature._ Client should be able to:

- Post new job / project **[P1]**
- Select category **[P1]** — _category list to be shared at a later stage_
- Add title **[P1]**
- Add description **[P1]**
- Upload photos / documents **[P1]**
- Add budget **[P1]**
- Add urgency **[P1]**
- Add job date **[P1]**
- Add deadline **[P1]**
- Select job type: On-site / Remote / Both **[P1]**
- Select job location on Google Map **[P1]**
- Save job **[P1]**

## D. Professional Discovery

Client should be able to:

- Search professionals **[P1]**
- Filter by:
  - Category **[P1]** — _category list to be shared at a later stage_
  - City **[P1]**
  - Distance **[P1]**
  - Rating **[P1]**
  - Verified status **[P1]**
  - Availability **[P1]**
- View professionals on map **[P1]**
- Compare profiles **[P2]**

## E. Hiring Flow

Client should be able to:

- Receive proposals **[P2]** ⚠ _Recommend moving to P1 — see Decision 2_
- View professional profile **[P1]**
- View pricing **[P1]**
- Chat before hiring **[P2]**
- Shortlist professional **[P1]**
- Accept / reject proposal **[P2]** ⚠ _Recommend moving to P1 — see Decision 2_
- Hire professional **[P1]**

## F. Payment Features

Client should be able to:

- Pay securely **[P2]**
- See invoice **[P2]**
- See payment breakdown **[P2]**
- Release payment after completion **[P2]**
- Request refund / dispute **[P2]** ⚠ _See Decision 4_

## G. Project Tracking

Client should be able to:

- Track project status **[P1]**
- View timeline **[P1]**
- View uploaded work proof **[P1]**
- Request revision **[P1]**
- Mark milestone complete **[P1]**

## H. Review / Rating

Client should be able to:

- Rate professional **[P1]**
- Leave review **[P1]**
- Report issue **[P1]**
- Raise dispute **[P1]** ⚠ _See Decision 4_

## I. Notifications

Client should receive:

- Proposal received **[P2]** ⚠ _Recommend P1 — see Decision 5_
- Message received **[P2]**
- Professional hired **[P2]** ⚠ _Recommend P1 — see Decision 5_
- Payment successful **[P2]**
- Job completed **[P2]** ⚠ _Recommend P1 — see Decision 5_
- Review request **[P2]** ⚠ _Recommend P1 — see Decision 5_

---

# 3) 🛠️ PROFESSIONAL SIDE FEATURES

_Professional = worker / freelancer / service provider._

Available in: **Website Portal**, **iOS App**, **Android App**

## A. Professional Registration / Login

- Signup / login **[P1]**
- Phone verification **[P1]**
- Email verification **[P1]**
- Forgot password **[P1]**
- Profile creation **[P1]**

## B. Professional Profile Setup

Professional should be able to add:

- Full name **[P1]**
- Profile picture **[P1]**
- Skills / services **[P1]**
- Experience **[P1]**
- Hourly rate / fixed rate **[P1]**
- Portfolio **[P1]**
- Work photos **[P1]**
- Certifications **[P1]**
- Trade license **[P1]**
- Availability **[P1]**
- Service area **[P1]**
- Remote / on-site / both **[P1]**

## C. Verification Module (Optional for Professional)

Professional should be able to upload:

- Government ID **[P1]**
- Selfie (optional) **[P1]**
- Trade certificate **[P1]**
- Work license **[P1]**
- Background check document **[P1]**
- Safety certificates **[P1]**
- Insurance proof (optional) **[P1]**

**Status values:** Pending → Reviewing → Approved / Rejected **[P1]**

**Badges:** ID Verified · Skill Verified · Background Checked · Fully Verified **[P1]**

## D. Job Discovery

Professional should be able to:

- Search available jobs **[P1]**
- Filter by:
  - Distance **[P1]**
  - City **[P1]**
  - Category **[P1]** — _category list to be shared at a later stage_
  - Budget **[P1]**
  - Urgency **[P1]**
  - On-site / remote **[P1]**
- View jobs on map **[P1]**
- Save favorite jobs **[P1]**

## E. Proposal / Bidding System

Professional should be able to:

- Apply to jobs **[P1]**
- Send proposal **[P2]** ⚠ _Same action as "Apply to jobs" — see Decision 2_
- Add quote **[P1]**
- Add timeline **[P1]**
- Add cover message **[P1]**
- Negotiate if needed **[P1]** ⚠ _Requires a channel — see Decision 3_

## F. Work Management

Professional should be able to:

- Accept / reject job **[P1]**
- Track active jobs **[P1]**
- Update progress **[P1]**
- Upload work proof / photos **[P1]**
- Mark job complete **[P1]**
- Request milestone payment **[P1]** ⚠ _Depends on payments — see Decision 1_

## G. Earnings & Wallet

Professional should be able to:

- View earnings **[P1]** ⚠ _Depends on payments — see Decision 1_
- View completed jobs **[P1]**
- See pending payouts **[P1]** ⚠ _Depends on payments_
- Withdraw money **[P1]** ⚠ _Depends on payments_
- View invoices **[P1]** ⚠ _Depends on payments_
- View platform commission deduction **[P1]** ⚠ _Depends on payments_

## H. Reviews & Ratings

Professional should be able to:

- See rating **[P1]**
- See client reviews **[P1]**
- Respond to reviews (optional) **[P1]**

## I. Notifications

Professional should receive:

- New job nearby **[P1]**
- Proposal accepted **[P1]**
- Message received **[P2]**
- Verification approved **[P1]**
- Payment released **[P1]** ⚠ _Depends on payments — see Decision 1_
- Review received **[P1]**

---

# 4) GOOGLE MAP / LOCATION FEATURES

Applies to **app + portal**.

## For Clients

Client should be able to:

- Select exact job location on map **[P1]**
- Search by address **[P1]**
- Drop pin **[P1]**
- View nearby professionals **[P1]**
- See distance of professionals **[P1]**

## For Professionals

Professional should be able to:

- Save base location **[P1]**
- Set service radius **[P1]**
- View job distance **[P1]**
- View travel time **[P1]**
- See nearby jobs on map **[P1]**

## Important Privacy Rule **[P1]**

**Public must NOT see the exact home address.**

Show instead:

- Approximate area
- City
- Service radius
- Distance

✔ Correct: _"Based in Surat – 12 km away"_
❌ Wrong: showing house address, company name, or phone number publicly

---

# 5) OPEN DECISIONS — RESOLVE BEFORE DEVELOPMENT STARTS

The Phase-1 cuts were not applied consistently. These five points must be settled or the developer will make the call for you.

### Decision 1 — Money in vs. money out

All client payment features were cut from Phase 1, but the professional's **Earnings & Wallet** (withdraw money, pending payouts, invoices, commission deduction) and **Request milestone payment** were kept, along with the **Payment released** notification.

**Options:** (a) bring client payments into Phase 1, or (b) move the whole wallet to Phase 2 and let Phase 1 handle payment off-platform.
**Decision:** ______________________

### Decision 2 — How a proposal becomes a hire

Professionals can still _Apply to jobs_ and _Add quote_ in Phase 1, but the client's _Receive proposals_ and _Accept / reject proposal_ were cut — while _Hire professional_ stayed. There is no path from a proposal to a hire. Also note _Apply to jobs_ and _Send proposal_ are the same action written twice; keep one label.

**Recommendation:** Move _Receive proposals_ and _Accept / reject proposal_ into Phase 1.
**Decision:** ______________________

### Decision 3 — Negotiation without chat

_Chat before hiring_ and both _Message received_ notifications were cut from Phase 1, but the professional's _Negotiate if needed_ remains. Negotiation needs a channel.

**Options:** (a) add basic in-app chat to Phase 1, (b) allow revised quotes only, (c) drop negotiation from Phase 1.
**Decision:** ______________________

### Decision 4 — Disputes with no remedy

Client _Report issue_ and _Raise dispute_ stayed in Phase 1, but _Request refund / dispute_ left with the payment section. Define what a Phase-1 dispute actually does — most likely an admin ticket with no financial action.
**Decision:** ______________________

### Decision 5 — One-sided notifications

Professional notifications were kept almost in full; client notifications were removed entirely. This looks like an oversight. At minimum the client needs _Professional hired_, _Job completed_, and _Review request_.
**Decision:** ______________________

---

# 6) ITEMS PENDING FROM CLIENT

- **Service / job category list** — referenced in three places (job posting, client discovery filter, professional discovery filter) and marked "will share at a later stage." Blocks database schema and filter UI.
- **Commission / fee structure** — the public _Pricing / Fees / Commission_ page and the professional's _platform commission deduction_ both need the actual numbers.

---

# 7) NOT COVERED IN EITHER DOCUMENT

Neither source document mentions the following. Flagging so they are priced deliberately rather than assumed:

- **Admin panel / back office** — yet verification requires someone to approve or reject documents, and disputes require someone to resolve them. Phase 1 cannot function without at least a basic admin.
- Multi-language support
- Analytics / reporting
- Content management for the public website pages
- Non-functional requirements: expected user load, browser and OS version support, data residency
