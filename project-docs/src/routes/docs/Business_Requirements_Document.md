# BUSINESS REQUIREMENTS DOCUMENT (BRD)

**Project:** Service Marketplace Platform — Web Portal, iOS App, Android App
**Source:** `Scope_Of_Development_MASTER.md` (merged from Scope Of Development + Scope Of Development Phase-1)

---

## DOCUMENT CONTROL

| Field          | Value                             |
| -------------- | --------------------------------- |
| Document title | Business Requirements Document    |
| Version        | 0.1 — Draft                       |
| Date           | 09 August 2026                    |
| Author         | _[TO BE CONFIRMED]_               |
| Business owner | _[TO BE CONFIRMED]_               |
| Status         | Draft — pending business sign-off |

### Revision history

| Version | Date        | Author | Change                          |
| ------- | ----------- | ------ | ------------------------------- |
| 0.1     | 09 Aug 2026 | —      | Initial draft from master scope |

### Approvals

| Role                     | Name | Signature | Date |
| ------------------------ | ---- | --------- | ---- |
| Business Owner / Sponsor |      |           |      |
| Product Owner            |      |           |      |
| Technical Lead / Vendor  |      |           |      |
| Legal & Compliance       |      |           |      |

> **Note on placeholders:** Items marked _[TO BE CONFIRMED]_ are business inputs that do not exist in the source scope documents. They have been left blank deliberately rather than assumed. Section 12 lists them all in one place.

---

## 1. EXECUTIVE SUMMARY

The business intends to launch a two-sided service marketplace connecting **Clients** (individuals and businesses needing work done) with **Professionals** (tradespeople, freelancers, and service providers). The platform is location-aware: jobs and professionals are matched partly by geography, using Google Maps for job location, service radius, and distance.

The platform will be delivered across three surfaces — responsive **web portal**, **iOS app**, and **Android app** — with feature parity across all three for both user types.

Delivery is split into two phases. **Phase 1** establishes the marketplace core: registration, verified professional profiles, job posting, discovery, hiring, work tracking, and reviews. **Phase 2** adds on-platform payments, in-app messaging, and the full notification set.

Revenue is generated through a commission deducted from professional earnings. _[Commission model TO BE CONFIRMED — see section 12.]_

---

## 2. BUSINESS OBJECTIVES

| ID    | Objective                                                                                    | Success measure                                                                  |
| ----- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| BO-01 | Establish a trusted marketplace where clients can find and hire verified local professionals | _[TO BE CONFIRMED — e.g. verified professionals onboarded in first 6 months]_    |
| BO-02 | Give professionals a channel to find work near them and manage jobs end to end               | _[TO BE CONFIRMED — e.g. active professionals, jobs per professional per month]_ |
| BO-03 | Build trust through document verification and a public review system                         | Ratio of Fully Verified professionals; average rating; dispute rate              |
| BO-04 | Generate revenue via commission on completed jobs                                            | Take rate; gross merchandise value                                               |
| BO-05 | Reach market quickly with a functional Phase 1, deferring payment complexity                 | Phase 1 live by _[TO BE CONFIRMED]_                                              |

---

## 3. BUSINESS NEED AND PROBLEM STATEMENT

Clients seeking skilled trade and professional services currently rely on word of mouth, classified listings, and unverified directories. They have no reliable way to confirm that a provider holds a valid licence, carries insurance, or has passed a background check, and no structured way to compare quotes or track work.

Professionals face the mirror problem: no low-cost channel to reach clients near them, no way to signal credentials credibly, and no structured tool to manage quotes, job progress, and payment.

The platform addresses both by combining **verified credentials**, **location-based matching**, and a **structured hiring and delivery workflow** in one product.

---

## 4. PROJECT SCOPE

### 4.1 In scope — Phase 1

- Public marketing website (11 pages, pre-login)
- Client registration, profile, and job posting
- Professional registration, profile, and credential verification
- Location-based discovery for both sides (Google Maps)
- Quoting / proposal submission by professionals
- Hiring, project tracking, and milestone completion
- Ratings and reviews for both sides
- Professional notifications
- Administrative back office for verification review and dispute handling _(see Assumption A-06)_

### 4.2 In scope — Phase 2

- On-platform payments, invoicing, escrow release, and refunds
- Client wallet and payment methods; professional payouts and withdrawals
- In-app messaging between client and professional
- Full client notification set
- Profile comparison

### 4.3 Out of scope

| Item                                       | Note                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| Multi-language / localisation              | Not referenced in source scope                        |
| Analytics and BI reporting                 | Beyond basic admin counts                             |
| CMS for marketing pages                    | Assumed static unless confirmed                       |
| Third-party accounting or ERP integration  | Not referenced                                        |
| Background-check execution                 | Platform stores documents; it does not perform checks |
| Insurance underwriting or licence issuance | Documents are collected, not issued                   |

---

## 5. STAKEHOLDERS

| Stakeholder                    | Interest                                          | Involvement                                |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------ |
| Business Owner / Sponsor       | Commercial outcome, funding, phase gating         | Approves BRD, commission model, go-live    |
| Product Owner                  | Requirement detail, backlog priority              | Day-to-day decisions, accepts deliverables |
| Development Vendor             | Build and deliver all three surfaces              | Estimates, technical design, delivery      |
| Verification / Operations Team | Reviews professional documents, resolves disputes | Primary admin panel user                   |
| Clients (end users)            | Find and hire trusted professionals               | UAT participants                           |
| Professionals (end users)      | Find work, manage jobs, get paid                  | UAT participants                           |
| Legal & Compliance             | Privacy policy, T&Cs, ID data handling            | Approves data handling and policy pages    |

---

## 6. USER ROLES

| Role              | Description                                        | Access                   |
| ----------------- | -------------------------------------------------- | ------------------------ |
| **Visitor**       | Unauthenticated user browsing public pages         | Public website only      |
| **Client**        | Individual or business posting jobs                | Web portal, iOS, Android |
| **Professional**  | Worker, freelancer, or service provider            | Web portal, iOS, Android |
| **Administrator** | Internal staff reviewing verification and disputes | Admin back office        |

---

## 7. BUSINESS REQUIREMENTS

High-level statements of what the business needs. Detailed functional requirements in section 8 trace back to these.

| ID    | Business requirement                                                                                                      | Objective    |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ------------ |
| BR-01 | The platform must present a credible public presence explaining the service, categories, and fees before a user registers | BO-01        |
| BR-02 | Both user types must be able to register and authenticate securely across all three platforms                             | BO-01, BO-02 |
| BR-03 | Clients must be able to describe a job in enough detail for a professional to quote it accurately                         | BO-01        |
| BR-04 | Both parties must be able to discover each other by location, category, and quality signals                               | BO-01, BO-02 |
| BR-05 | Professional credentials must be collected, reviewed, and displayed as trust badges                                       | BO-03        |
| BR-06 | Professionals must be able to submit a priced, timed quote against a job                                                  | BO-02        |
| BR-07 | Clients must be able to evaluate quotes and appoint one professional                                                      | BO-01        |
| BR-08 | Both parties must be able to track work progress against milestones with evidence                                         | BO-01, BO-02 |
| BR-09 | Both parties must be able to rate and review each other after completion                                                  | BO-03        |
| BR-10 | The platform must collect payment from clients and remit earnings to professionals, net of commission                     | BO-04        |
| BR-11 | Users must be kept informed of events relevant to them                                                                    | BO-01, BO-02 |
| BR-12 | Personal residential addresses must never be exposed publicly                                                             | BO-03        |
| BR-13 | Internal staff must be able to approve credentials and resolve disputes                                                   | BO-03        |

---

## 8. FUNCTIONAL REQUIREMENTS

**Priority:** M = Must have · S = Should have · C = Could have
**Phase:** P1 = Phase 1 · P2 = Phase 2 · F = Future

### 8.1 Public Website (Pre-Login) — WEB

| ID     | Requirement                                                                                | Phase | Pri |
| ------ | ------------------------------------------------------------------------------------------ | ----- | --- |
| WEB-01 | The system shall provide a Home page introducing the platform                              | P1    | M   |
| WEB-02 | The system shall provide an About Us page                                                  | P1    | M   |
| WEB-03 | The system shall provide a How It Works page explaining the flow for both user types       | P1    | M   |
| WEB-04 | The system shall provide a Services / Categories page listing supported service categories | P1    | M   |
| WEB-05 | The system shall provide a For Clients page                                                | P1    | M   |
| WEB-06 | The system shall provide a For Professionals page                                          | P1    | M   |
| WEB-07 | The system shall provide a Pricing / Fees / Commission page stating the commission model   | P1    | M   |
| WEB-08 | The system shall provide an FAQ page                                                       | P1    | M   |
| WEB-09 | The system shall provide a Contact Us page with an enquiry form                            | P1    | M   |
| WEB-10 | The system shall provide a Privacy Policy page                                             | P1    | M   |
| WEB-11 | The system shall provide a Terms & Conditions page                                         | P1    | M   |
| WEB-12 | All public pages shall be responsive across desktop, tablet, and mobile browsers           | P1    | M   |

### 8.2 Client Registration and Authentication — CRA

| ID     | Requirement                                                                   | Phase | Pri |
| ------ | ----------------------------------------------------------------------------- | ----- | --- |
| CRA-01 | A client shall be able to register using an email address                     | P1    | M   |
| CRA-02 | A client shall be able to register using a phone number                       | P1    | M   |
| CRA-03 | A client shall be able to register and log in using a Google account          | P1    | S   |
| CRA-04 | The system shall verify email and phone via OTP before activating the account | P1    | M   |
| CRA-05 | A client shall be able to reset a forgotten password via a verified channel   | P1    | M   |
| CRA-06 | The system shall guide a newly registered client through profile setup        | P1    | M   |

### 8.3 Client Profile — CPR

| ID     | Requirement                                                                   | Phase | Pri |
| ------ | ----------------------------------------------------------------------------- | ----- | --- |
| CPR-01 | A client shall be able to record their name                                   | P1    | M   |
| CPR-02 | A client shall be able to record a company name (optional)                    | P1    | S   |
| CPR-03 | A client shall be able to record an address                                   | P1    | M   |
| CPR-04 | A client shall be able to upload a profile photo                              | P1    | S   |
| CPR-05 | A client shall be able to save multiple locations for reuse when posting jobs | P1    | S   |
| CPR-06 | A client shall be able to store billing details                               | F     | C   |
| CPR-07 | A client shall be able to store a payment method                              | F     | C   |

### 8.4 Job Posting — JOB

| ID     | Requirement                                                                                          | Phase | Pri |
| ------ | ---------------------------------------------------------------------------------------------------- | ----- | --- |
| JOB-01 | A client shall be able to create a new job posting                                                   | P1    | M   |
| JOB-02 | A client shall be able to assign the job to a service category _(category list pending — see OI-01)_ | P1    | M   |
| JOB-03 | A client shall be able to enter a job title                                                          | P1    | M   |
| JOB-04 | A client shall be able to enter a job description                                                    | P1    | M   |
| JOB-05 | A client shall be able to upload supporting photos and documents                                     | P1    | M   |
| JOB-06 | A client shall be able to state a budget                                                             | P1    | M   |
| JOB-07 | A client shall be able to state an urgency level                                                     | P1    | M   |
| JOB-08 | A client shall be able to state a job start date                                                     | P1    | M   |
| JOB-09 | A client shall be able to state a deadline                                                           | P1    | M   |
| JOB-10 | A client shall be able to classify the job as on-site, remote, or both                               | P1    | M   |
| JOB-11 | A client shall be able to set the job location by map pin                                            | P1    | M   |
| JOB-12 | A client shall be able to save a job as draft and publish it later                                   | P1    | S   |

### 8.5 Professional Discovery (Client-facing) — CDS

| ID     | Requirement                                                                    | Phase | Pri |
| ------ | ------------------------------------------------------------------------------ | ----- | --- |
| CDS-01 | A client shall be able to search for professionals by keyword                  | P1    | M   |
| CDS-02 | A client shall be able to filter professionals by category                     | P1    | M   |
| CDS-03 | A client shall be able to filter professionals by city                         | P1    | M   |
| CDS-04 | A client shall be able to filter professionals by distance from a chosen point | P1    | M   |
| CDS-05 | A client shall be able to filter professionals by rating                       | P1    | M   |
| CDS-06 | A client shall be able to filter professionals by verification status          | P1    | M   |
| CDS-07 | A client shall be able to filter professionals by availability                 | P1    | M   |
| CDS-08 | A client shall be able to view matching professionals plotted on a map         | P1    | M   |
| CDS-09 | A client shall be able to compare selected professional profiles side by side  | P2    | C   |

### 8.6 Hiring Flow — HIR

| ID     | Requirement                                                                                   | Phase | Pri |
| ------ | --------------------------------------------------------------------------------------------- | ----- | --- |
| HIR-01 | A client shall be able to view all quotes received against a job                              | P1    | M   |
| HIR-02 | A client shall be able to view a professional's full profile including credentials and badges | P1    | M   |
| HIR-03 | A client shall be able to view a professional's stated rates                                  | P1    | M   |
| HIR-04 | A client shall be able to shortlist professionals for a job                                   | P1    | S   |
| HIR-05 | A client shall be able to accept or reject an individual quote                                | P1    | M   |
| HIR-06 | A client shall be able to appoint one professional to a job, closing it to further quotes     | P1    | M   |
| HIR-07 | A client shall be able to message a professional before hiring                                | P2    | S   |

> **Note:** HIR-01 and HIR-05 were Phase 2 in the source scope. They are raised to Phase 1 here because hiring cannot function without them — per Decision 2 of the master scope. **Confirm at sign-off.**

### 8.7 Payments (Client-facing) — PAY

| ID     | Requirement                                                                       | Phase | Pri |
| ------ | --------------------------------------------------------------------------------- | ----- | --- |
| PAY-01 | A client shall be able to pay for a job through the platform via a secure gateway | P2    | M   |
| PAY-02 | A client shall be able to view an invoice for each transaction                    | P2    | M   |
| PAY-03 | A client shall be able to view a breakdown of any payment                         | P2    | M   |
| PAY-04 | A client shall be able to release payment upon accepting completed work           | P2    | M   |
| PAY-05 | A client shall be able to request a refund and raise a payment dispute            | P2    | M   |

### 8.8 Project Tracking — TRK

| ID     | Requirement                                                                             | Phase | Pri |
| ------ | --------------------------------------------------------------------------------------- | ----- | --- |
| TRK-01 | A client shall be able to view the current status of an active job                      | P1    | M   |
| TRK-02 | A client shall be able to view a chronological timeline of job events                   | P1    | M   |
| TRK-03 | A client shall be able to view work-proof photos and files uploaded by the professional | P1    | M   |
| TRK-04 | A client shall be able to request a revision against submitted work                     | P1    | M   |
| TRK-05 | A client shall be able to mark a milestone as complete                                  | P1    | M   |

### 8.9 Reviews and Disputes (Client-facing) — REV

| ID     | Requirement                                                                         | Phase | Pri |
| ------ | ----------------------------------------------------------------------------------- | ----- | --- |
| REV-01 | A client shall be able to give a star rating to a professional after job completion | P1    | M   |
| REV-02 | A client shall be able to leave a written review                                    | P1    | M   |
| REV-03 | A client shall be able to report an issue on a job                                  | P1    | M   |
| REV-04 | A client shall be able to raise a dispute, creating a case for administrator review | P1    | M   |

### 8.10 Client Notifications — CNT

| ID     | Requirement                                                              | Phase | Pri |
| ------ | ------------------------------------------------------------------------ | ----- | --- |
| CNT-01 | A client shall be notified when a quote is received                      | P2    | M   |
| CNT-02 | A client shall be notified when a message is received                    | P2    | M   |
| CNT-03 | A client shall be notified when a professional is successfully appointed | P2    | M   |
| CNT-04 | A client shall be notified when a payment is successful                  | P2    | M   |
| CNT-05 | A client shall be notified when a job is marked complete                 | P2    | M   |
| CNT-06 | A client shall be prompted to review a professional after completion     | P2    | S   |

> **Note:** Client notifications were removed wholesale from Phase 1 in the source scope while professional notifications were retained. Per Decision 5, CNT-01, CNT-03, CNT-05, and CNT-06 are recommended for Phase 1. **Confirm at sign-off.**

### 8.11 Professional Registration and Authentication — PRA

| ID     | Requirement                                                                     | Phase | Pri |
| ------ | ------------------------------------------------------------------------------- | ----- | --- |
| PRA-01 | A professional shall be able to register and log in                             | P1    | M   |
| PRA-02 | The system shall verify a professional's phone number                           | P1    | M   |
| PRA-03 | The system shall verify a professional's email address                          | P1    | M   |
| PRA-04 | A professional shall be able to reset a forgotten password                      | P1    | M   |
| PRA-05 | The system shall guide a newly registered professional through profile creation | P1    | M   |

### 8.12 Professional Profile — PPR

| ID     | Requirement                                                                        | Phase | Pri |
| ------ | ---------------------------------------------------------------------------------- | ----- | --- |
| PPR-01 | A professional shall be able to record their full name                             | P1    | M   |
| PPR-02 | A professional shall be able to upload a profile picture                           | P1    | M   |
| PPR-03 | A professional shall be able to list skills and services offered                   | P1    | M   |
| PPR-04 | A professional shall be able to record years and detail of experience              | P1    | M   |
| PPR-05 | A professional shall be able to set an hourly rate, a fixed rate, or both          | P1    | M   |
| PPR-06 | A professional shall be able to build a portfolio of past work                     | P1    | M   |
| PPR-07 | A professional shall be able to upload work photos                                 | P1    | M   |
| PPR-08 | A professional shall be able to list certifications                                | P1    | M   |
| PPR-09 | A professional shall be able to record trade licence details                       | P1    | M   |
| PPR-10 | A professional shall be able to publish their availability                         | P1    | M   |
| PPR-11 | A professional shall be able to define a service area                              | P1    | M   |
| PPR-12 | A professional shall be able to declare whether they work remote, on-site, or both | P1    | M   |

### 8.13 Verification Module — VER

| ID     | Requirement                                                                                                                   | Phase | Pri |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | ----- | --- |
| VER-01 | A professional shall be able to upload a government-issued ID                                                                 | P1    | M   |
| VER-02 | A professional shall be able to upload a selfie for identity matching (optional)                                              | P1    | S   |
| VER-03 | A professional shall be able to upload a trade certificate                                                                    | P1    | M   |
| VER-04 | A professional shall be able to upload a work licence                                                                         | P1    | M   |
| VER-05 | A professional shall be able to upload a background-check document                                                            | P1    | M   |
| VER-06 | A professional shall be able to upload safety certificates                                                                    | P1    | M   |
| VER-07 | A professional shall be able to upload proof of insurance (optional)                                                          | P1    | S   |
| VER-08 | Each submitted document shall carry a status of Pending, Reviewing, Approved, or Rejected                                     | P1    | M   |
| VER-09 | An administrator shall be able to move a document between statuses and record a rejection reason                              | P1    | M   |
| VER-10 | The system shall award badges — ID Verified, Skill Verified, Background Checked, Fully Verified — based on approved documents | P1    | M   |
| VER-11 | Badges shall be visible to clients on the professional's public profile and in search results                                 | P1    | M   |
| VER-12 | Verification shall remain optional; an unverified professional may still operate on the platform                              | P1    | M   |

### 8.14 Job Discovery (Professional-facing) — PJD

| ID     | Requirement                                                          | Phase | Pri |
| ------ | -------------------------------------------------------------------- | ----- | --- |
| PJD-01 | A professional shall be able to search available jobs by keyword     | P1    | M   |
| PJD-02 | A professional shall be able to filter jobs by distance              | P1    | M   |
| PJD-03 | A professional shall be able to filter jobs by city                  | P1    | M   |
| PJD-04 | A professional shall be able to filter jobs by category              | P1    | M   |
| PJD-05 | A professional shall be able to filter jobs by budget                | P1    | M   |
| PJD-06 | A professional shall be able to filter jobs by urgency               | P1    | M   |
| PJD-07 | A professional shall be able to filter jobs by on-site or remote     | P1    | M   |
| PJD-08 | A professional shall be able to view available jobs plotted on a map | P1    | M   |
| PJD-09 | A professional shall be able to save jobs to a favourites list       | P1    | S   |

### 8.15 Quoting and Proposals — PRO

| ID     | Requirement                                                                  | Phase | Pri |
| ------ | ---------------------------------------------------------------------------- | ----- | --- |
| PRO-01 | A professional shall be able to submit a quote against an open job           | P1    | M   |
| PRO-02 | A quote shall include a price                                                | P1    | M   |
| PRO-03 | A quote shall include a proposed timeline                                    | P1    | M   |
| PRO-04 | A quote shall include a cover message                                        | P1    | M   |
| PRO-05 | A professional shall be able to submit a revised quote after client feedback | P1    | S   |
| PRO-06 | A professional shall be able to negotiate terms with a client via messaging  | P2    | S   |

> **Note:** The source scope listed "Apply to jobs" and "Send proposal" as separate items. They are consolidated into PRO-01. Per Decision 3, negotiation without messaging is not possible in Phase 1; PRO-05 (revised quote) is offered as the Phase 1 substitute. **Confirm at sign-off.**

### 8.16 Work Management — WRK

| ID     | Requirement                                                                   | Phase | Pri |
| ------ | ----------------------------------------------------------------------------- | ----- | --- |
| WRK-01 | A professional shall be able to accept or reject an appointment               | P1    | M   |
| WRK-02 | A professional shall be able to view all active jobs in one place             | P1    | M   |
| WRK-03 | A professional shall be able to update job progress                           | P1    | M   |
| WRK-04 | A professional shall be able to upload work-proof photos and files            | P1    | M   |
| WRK-05 | A professional shall be able to mark a job complete                           | P1    | M   |
| WRK-06 | A professional shall be able to request payment against a completed milestone | P2    | M   |

### 8.17 Earnings and Wallet — ERN

| ID     | Requirement                                                                   | Phase | Pri |
| ------ | ----------------------------------------------------------------------------- | ----- | --- |
| ERN-01 | A professional shall be able to view total and period earnings                | P2    | M   |
| ERN-02 | A professional shall be able to view a history of completed jobs              | P1    | M   |
| ERN-03 | A professional shall be able to view pending payouts                          | P2    | M   |
| ERN-04 | A professional shall be able to withdraw available balance to a bank account  | P2    | M   |
| ERN-05 | A professional shall be able to view and download invoices                    | P2    | M   |
| ERN-06 | A professional shall be able to view the platform commission deducted per job | P2    | M   |

> **Note:** The source scope placed the entire wallet in Phase 1 while removing all client payment features — the platform would pay out money it never collected. Per Decision 1, all money-movement requirements are moved to Phase 2, except ERN-02 (job history), which needs no payment data. **Confirm at sign-off.**

### 8.18 Professional Reviews — PRV

| ID     | Requirement                                                    | Phase | Pri |
| ------ | -------------------------------------------------------------- | ----- | --- |
| PRV-01 | A professional shall be able to view their aggregate rating    | P1    | M   |
| PRV-02 | A professional shall be able to read client reviews            | P1    | M   |
| PRV-03 | A professional shall be able to publish a response to a review | P1    | C   |

### 8.19 Professional Notifications — PNT

| ID     | Requirement                                                                           | Phase | Pri |
| ------ | ------------------------------------------------------------------------------------- | ----- | --- |
| PNT-01 | A professional shall be notified of a new job posted within their service radius      | P1    | M   |
| PNT-02 | A professional shall be notified when their quote is accepted                         | P1    | M   |
| PNT-03 | A professional shall be notified when a message is received                           | P2    | M   |
| PNT-04 | A professional shall be notified when a verification document is approved or rejected | P1    | M   |
| PNT-05 | A professional shall be notified when a payment is released                           | P2    | M   |
| PNT-06 | A professional shall be notified when a review is received                            | P1    | M   |

### 8.20 Maps and Location — MAP

| ID     | Requirement                                                                   | Phase | Pri |
| ------ | ----------------------------------------------------------------------------- | ----- | --- |
| MAP-01 | A client shall be able to set an exact job location by placing a map pin      | P1    | M   |
| MAP-02 | A client shall be able to find a location by address search with autocomplete | P1    | M   |
| MAP-03 | A client shall be able to view nearby professionals on a map                  | P1    | M   |
| MAP-04 | A client shall be able to see the distance to each professional               | P1    | M   |
| MAP-05 | A professional shall be able to save a base location                          | P1    | M   |
| MAP-06 | A professional shall be able to set a service radius                          | P1    | M   |
| MAP-07 | A professional shall be able to see the distance to a job                     | P1    | M   |
| MAP-08 | A professional shall be able to see estimated travel time to a job            | P1    | M   |
| MAP-09 | A professional shall be able to view nearby jobs on a map                     | P1    | M   |
| MAP-10 | Map functionality shall be available on web, iOS, and Android                 | P1    | M   |

### 8.21 Privacy of Location — PRI

| ID     | Requirement                                                                                                                  | Phase | Pri |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | ----- | --- |
| PRI-01 | The system shall never display a professional's exact residential address publicly                                           | P1    | M   |
| PRI-02 | Public profiles shall display approximate area, city, service radius, and distance only — e.g. "Based in Surat – 12 km away" | P1    | M   |
| PRI-03 | The system shall not display a professional's house address, company name, or phone number publicly                          | P1    | M   |
| PRI-04 | Exact contact details shall be released only after an appointment is confirmed                                               | P1    | M   |

> **Note:** PRI-04 is not in the source scope but is required to make PRI-01–03 operable — a hired professional must be reachable at some point. **Confirm at sign-off.**

### 8.22 Administration — ADM

Not present in the source scope. Derived from workflows that cannot complete without an internal actor. See Assumption A-06.

| ID     | Requirement                                                                      | Phase | Pri |
| ------ | -------------------------------------------------------------------------------- | ----- | --- |
| ADM-01 | An administrator shall be able to view a queue of pending verification documents | P1    | M   |
| ADM-02 | An administrator shall be able to approve or reject a document with a reason     | P1    | M   |
| ADM-03 | An administrator shall be able to view and manage user accounts                  | P1    | M   |
| ADM-04 | An administrator shall be able to view and resolve disputes and reported issues  | P1    | M   |
| ADM-05 | An administrator shall be able to suspend or remove a user or a job posting      | P1    | M   |
| ADM-06 | An administrator shall be able to maintain the service category list             | P1    | M   |
| ADM-07 | An administrator shall be able to configure the commission rate                  | P2    | M   |

---

## 9. BUSINESS RULES

| ID     | Rule                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| BRL-01 | A user account is not active until email or phone is OTP-verified                                              |
| BRL-02 | A job may be assigned to exactly one professional                                                              |
| BRL-03 | Once a professional is appointed, the job closes to further quotes                                             |
| BRL-04 | A review may be submitted only against a job marked complete                                                   |
| BRL-05 | Verification is optional; unverified professionals may quote but display no badges                             |
| BRL-06 | "Fully Verified" is awarded only when all mandatory document types are approved _[definition TO BE CONFIRMED]_ |
| BRL-07 | Residential addresses are never public; only approximate area, city, radius, and distance are shown            |
| BRL-08 | Commission is deducted from the professional's earnings, not added to the client's price _[TO BE CONFIRMED]_   |
| BRL-09 | A job appears in a professional's nearby feed only if it falls within their service radius                     |
| BRL-10 | A rejected verification document may be re-uploaded _[retry limit TO BE CONFIRMED]_                            |

---

## 10. NON-FUNCTIONAL REQUIREMENTS

None were stated in the source scope. The following are proposed as a baseline and require confirmation.

| ID     | Category       | Requirement                                                                                                               |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Performance    | Search and map results shall return within 3 seconds under normal load                                                    |
| NFR-02 | Capacity       | The system shall support _[TO BE CONFIRMED]_ concurrent users at launch                                                   |
| NFR-03 | Availability   | Target uptime of 99.5% excluding scheduled maintenance                                                                    |
| NFR-04 | Security       | All traffic over HTTPS; passwords hashed; ID documents encrypted at rest                                                  |
| NFR-05 | Security       | Verification documents accessible only to authorised administrators, with access logged                                   |
| NFR-06 | Privacy        | Data handling to comply with _[applicable jurisdiction TO BE CONFIRMED]_                                                  |
| NFR-07 | Compatibility  | iOS _[version TO BE CONFIRMED]_+, Android _[version TO BE CONFIRMED]_+, current versions of Chrome, Safari, Edge, Firefox |
| NFR-08 | Usability      | All client and professional features available on web, iOS, and Android with feature parity                               |
| NFR-09 | Scalability    | Architecture shall accommodate Phase 2 payment and messaging modules without redesign                                     |
| NFR-10 | Data retention | Verification documents retained for _[period TO BE CONFIRMED]_ after account closure                                      |
| NFR-11 | Backup         | Daily automated backup with defined recovery point and recovery time objectives                                           |
| NFR-12 | Accessibility  | _[Target standard TO BE CONFIRMED — e.g. WCAG 2.1 AA]_                                                                    |

---

## 11. ASSUMPTIONS, DEPENDENCIES, CONSTRAINTS

### Assumptions

| ID   | Assumption                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Feature parity is required across web, iOS, and Android — no platform-specific reductions                                           |
| A-02 | Marketing website content is static; no CMS is required                                                                             |
| A-03 | The platform stores background-check documents but does not perform checks                                                          |
| A-04 | Phase 1 payment happens off-platform, directly between client and professional                                                      |
| A-05 | English is the only launch language                                                                                                 |
| A-06 | An administrative back office is required in Phase 1 — verification statuses and disputes cannot progress without an internal actor |
| A-07 | Notifications are delivered by push and email; SMS is not assumed                                                                   |

### Dependencies

| ID   | Dependency                                          | Impact if unmet                             |
| ---- | --------------------------------------------------- | ------------------------------------------- |
| D-01 | Google Maps Platform account, API keys, and billing | All location features blocked               |
| D-02 | Service category taxonomy from the business         | Data model, filters, and posting UI blocked |
| D-03 | Commission and fee structure from the business      | Pricing page and Phase 2 payments blocked   |
| D-04 | Payment gateway selection _(Phase 2)_               | Phase 2 payments blocked                    |
| D-05 | Apple Developer and Google Play accounts            | App release blocked                         |
| D-06 | Legally reviewed Privacy Policy and T&C copy        | Launch blocked                              |
| D-07 | SMS/OTP provider account                            | Registration blocked                        |

### Constraints

| ID   | Constraint                                                       |
| ---- | ---------------------------------------------------------------- |
| C-01 | Delivery is phased; Phase 1 must be independently launchable     |
| C-02 | Public exposure of residential addresses is prohibited by BRL-07 |
| C-03 | Budget and timeline _[TO BE CONFIRMED]_                          |

---

## 12. OPEN ITEMS REQUIRING BUSINESS DECISION

These must be closed before development begins. Items OI-01 to OI-05 carry forward from the master scope; OI-06 onward are gaps identified while drafting this BRD.

| ID    | Open item                                                               | Blocks                             | Owner             | Due |
| ----- | ----------------------------------------------------------------------- | ---------------------------------- | ----------------- | --- |
| OI-01 | Service category taxonomy                                               | JOB-02, CDS-02, PJD-04, data model | Business          |     |
| OI-02 | Commission model and rate                                               | WEB-07, ERN-06, ADM-07             | Business          |     |
| OI-03 | Confirm wallet moves to Phase 2 (Decision 1)                            | ERN-01 to ERN-06, WRK-06           | Business          |     |
| OI-04 | Confirm quote acceptance moves to Phase 1 (Decision 2)                  | HIR-01, HIR-05                     | Business          |     |
| OI-05 | Phase 1 negotiation approach (Decision 3)                               | PRO-05, PRO-06                     | Business          |     |
| OI-06 | Definition of a Phase 1 dispute with no payment to reverse (Decision 4) | REV-04, ADM-04                     | Business + Legal  |     |
| OI-07 | Which client notifications are Phase 1 (Decision 5)                     | CNT-01 to CNT-06                   | Business          |     |
| OI-08 | Which documents are mandatory for "Fully Verified"                      | BRL-06, VER-10                     | Business          |     |
| OI-09 | Target launch geography and legal jurisdiction                          | NFR-06, D-06                       | Business + Legal  |     |
| OI-10 | Expected user volumes at launch and at 12 months                        | NFR-02, infrastructure sizing      | Business          |     |
| OI-11 | Confirm admin panel is in Phase 1 scope and priced                      | Section 8.22                       | Business + Vendor |     |
| OI-12 | Point at which contact details are released (PRI-04)                    | PRI-04                             | Business          |     |
| OI-13 | Whether professionals also rate clients                                 | REV module                         | Business          |     |
| OI-14 | Target launch date and budget envelope                                  | Planning                           | Business          |     |

---

## 13. ACCEPTANCE CRITERIA — PHASE 1

Phase 1 is accepted when the following end-to-end scenarios pass on **all three platforms**:

| ID    | Scenario                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------- |
| AC-01 | A visitor can reach all 11 public pages on desktop and mobile                                        |
| AC-02 | A client can register, verify by OTP, and complete a profile                                         |
| AC-03 | A professional can register, complete a profile, and upload all verification document types          |
| AC-04 | An administrator can approve documents and the correct badges appear on the public profile           |
| AC-05 | A client can post a job with a map-pinned location and all required attributes                       |
| AC-06 | The job appears in the feed of a professional whose service radius covers it, and not otherwise      |
| AC-07 | A professional can submit a priced, timed quote                                                      |
| AC-08 | The client can view quotes, compare them, and appoint one professional                               |
| AC-09 | Remaining quotes are closed once an appointment is made                                              |
| AC-10 | The professional can update progress, upload work proof, and mark the job complete                   |
| AC-11 | The client can request a revision and mark milestones complete                                       |
| AC-12 | Both parties can leave a rating and review after completion                                          |
| AC-13 | A raised dispute appears in the administrator queue                                                  |
| AC-14 | No public screen exposes a residential address, phone number, or company name in breach of PRI-01–03 |
| AC-15 | Professional notifications PNT-01, 02, 04, 06 fire correctly                                         |

---

## 14. GLOSSARY

| Term             | Definition                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| Client           | A person or business posting a job on the platform                             |
| Professional     | A worker, freelancer, or service provider delivering work                      |
| Job / Project    | A unit of work posted by a client                                              |
| Quote / Proposal | A professional's priced, timed offer against a job                             |
| Milestone        | A defined checkpoint within a job, marked complete by the client               |
| Work proof       | Photo or file evidence of work performed                                       |
| Badge            | A trust marker awarded on approval of a verification document                  |
| Service radius   | The distance from a professional's base location within which they accept work |
| Commission       | The platform's fee, deducted from professional earnings                        |
| Verification     | Review of professional-submitted credential documents by an administrator      |

---

## 15. TRACEABILITY

| Business requirement | Functional requirements                              |
| -------------------- | ---------------------------------------------------- |
| BR-01                | WEB-01 to WEB-12                                     |
| BR-02                | CRA-01 to CRA-06, PRA-01 to PRA-05                   |
| BR-03                | JOB-01 to JOB-12, CPR-01 to CPR-05                   |
| BR-04                | CDS-01 to CDS-09, PJD-01 to PJD-09, MAP-01 to MAP-10 |
| BR-05                | VER-01 to VER-12, PPR-01 to PPR-12                   |
| BR-06                | PRO-01 to PRO-06                                     |
| BR-07                | HIR-01 to HIR-07                                     |
| BR-08                | TRK-01 to TRK-05, WRK-01 to WRK-06                   |
| BR-09                | REV-01 to REV-04, PRV-01 to PRV-03                   |
| BR-10                | PAY-01 to PAY-05, ERN-01 to ERN-06                   |
| BR-11                | CNT-01 to CNT-06, PNT-01 to PNT-06                   |
| BR-12                | PRI-01 to PRI-04                                     |
| BR-13                | ADM-01 to ADM-07                                     |

_End of document._
