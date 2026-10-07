# Servio Phase 1 product decision record

**Status:** Proposed for product-owner sign-off  
**Date:** 10 August 2026  
**Purpose:** Establish the Phase 1 scope that implementation follows when the reviewed planning documents conflict.

## Confirmed Phase 1 platform decisions

| Decision      | Phase 1 outcome                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web platform  | Responsive Next.js web application only. It must support mobile browsers, with 375px as a primary target.                                        |
| Native mobile | Flutter iOS and Android applications are deferred to Phase 2.                                                                                    |
| Payments      | No on-platform payments, wallet, escrow, payouts, invoices, refunds, or Stripe Connect in Phase 1. Parties arrange payment off-platform.         |
| Messaging     | In-app chat and message notifications are deferred to Phase 2.                                                                                   |
| API readiness | New client and professional capabilities must still be designed behind stable, documented API boundaries so Flutter can consume them in Phase 2. |

## Proposed launch-market decisions

The existing documents consistently propose Canada and CAD, but an older privacy example refers to Surat. Canada and CAD are therefore the proposed baseline; the Surat example must be removed from future documentation.

| Decision         | Proposed Phase 1 baseline                                                                                      | Status                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Launch country   | Canada                                                                                                         | Requires product-owner confirmation           |
| Currency         | CAD                                                                                                            | Requires product-owner confirmation           |
| Launch cities    | Toronto, Vancouver, Calgary, Montreal, and Ottawa                                                              | Requires product-owner confirmation           |
| Initial category | IT services only                                                                                               | Requires product-owner confirmation           |
| Initial taxonomy | Development: Frontend, Backend, Mobile. Data: Analytics, ML, Engineering.                                      | Requires product-owner confirmation           |
| Commission model | 10% of the professional's agreed earnings; displayed publicly but not collected by the platform until Phase 2. | Requires product-owner and legal confirmation |

## Phase 1 marketplace decisions

| Area            | Decision                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Proposals       | Professionals can submit one priced, timed proposal per open job. Clients can receive, compare, accept, or reject proposals in Phase 1.                                                                      |
| Hiring          | Accepting one proposal appoints exactly one professional, closes the job to new proposals, and marks remaining active proposals as not selected.                                                             |
| Negotiation     | No in-app chat in Phase 1. A professional may revise a proposal while the job is open; the client can accept, reject, or request a revision through the proposal flow.                                       |
| Milestones      | Parties may define milestones at appointment. If none are agreed, the job has one implicit milestone for work tracking only; it does not trigger platform payment.                                           |
| Work completion | Professionals submit work proof and mark work complete. Clients confirm completion or request a revision.                                                                                                    |
| Disputes        | A Phase 1 dispute is an admin-managed service issue. It can pause the job, record evidence and a resolution, but cannot release, refund, or reverse platform funds because Phase 1 has no platform payments. |
| Reviews         | Clients can review professionals after confirmed completion. Professional-to-client reviews, if added, are double-blind and publish when both parties submit or the review window closes.                    |

## Privacy and contact-release policy

| Rule                     | Phase 1 decision                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public professional data | Show display name, city/approximate area, skills, rate, availability, rating, badges, and approximate distance only.                                                                              |
| Never public             | Exact address, exact map coordinates, phone number, email address, verification documents, and private client address.                                                                            |
| Map markers              | Use a privacy-safe approximate or obfuscated professional location. Do not display a true residential point.                                                                                      |
| Job location             | Exact job address is visible only to the client and appointed professional. Other viewers receive an approximate area and distance.                                                               |
| Contact release          | Direct contact details are released only after appointment, to the appointed professional and the job owner. They are withdrawn if the appointment is cancelled and the job returns to published. |
| Company information      | A professional's company name is private by default unless the professional explicitly chooses to publish it.                                                                                     |

## Phase 1 notification decisions

In-app chat and payment notifications are deferred with their underlying features. Phase 1 notifications are limited to:

- Professional: nearby job, proposal accepted/rejected, verification approved/rejected, review received.
- Client: proposal received, professional appointed, work marked complete, revision requested, review request, dispute status changed.
- Admin: verification submission and dispute raised.

Notifications must not delay the primary action. Delivery failures are retried asynchronously.

## Explicitly deferred to Phase 2

- Flutter iOS and Android applications
- In-app messaging and attachments
- Platform payments, Stripe Connect, escrow, wallet, payouts, refunds, tax invoices, and payment disputes
- Payment and message notifications
- Professional-profile comparison, unless it is separately approved for Phase 1

## Required sign-off

Before implementation proceeds beyond foundation work, the product owner must confirm:

1. Canada, CAD, launch cities, and IT-only taxonomy.
2. The 10% commission policy and how it is disclosed while payments remain off-platform.
3. The proposed privacy and contact-release policy.
4. The Phase 1 dispute definition and review direction.
5. The final Phase 1 notification list.

When approved, update the status to **Approved**, add the approver name and date, and align the BRD, SRS, architecture document, tickets, and delivery plan to this record.
