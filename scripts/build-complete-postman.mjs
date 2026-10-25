import fs from "fs";
import path from "path";

const collection = {
  info: {
    _postman_id: "e9f01234-abcd-4567-89ef-0123456789ab",
    name: "Klick-Pro Complete API Collection (Post Job to Review Lifecycle)",
    description: "Official 100% comprehensive Postman collection for Klick-Pro platform. Features full Job, Proposal, Negotiation, Escrow funding, Work submission, Milestone approval, Review lifecycle, KYC, Wallet, Admin Suite, and Webhooks.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000", type: "string" },
    { key: "token", value: "", type: "string" },
    { key: "clientToken", value: "", type: "string" },
    { key: "proToken", value: "", type: "string" },
    { key: "adminToken", value: "", type: "string" },
    { key: "jobId", value: "1", type: "string" },
    { key: "requestId", value: "1", type: "string" },
    { key: "projectId", value: "1", type: "string" },
    { key: "milestoneId", value: "1", type: "string" },
    { key: "professionalId", value: "1", type: "string" },
    { key: "paymentId", value: "1", type: "string" },
    { key: "cronSecret", value: "servio-cron-internal-secret-2026", type: "string" },
    { key: "razorpayOrderId", value: "", type: "string" },
    { key: "razorpayPaymentId", value: "", type: "string" },
    { key: "razorpaySignature", value: "", type: "string" }
  ],
  item: [
    {
      name: "01 - Authentication & Role Sessions",
      item: [
        {
          name: "1.1 Login as Client (Auto-set Client Token)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "const res = pm.response.json();",
                  "if (res.token) {",
                  "  pm.collectionVariables.set('clientToken', res.token);",
                  "  pm.collectionVariables.set('token', res.token);",
                  "  console.log('Client session active. Token saved.');",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "seed.client@servio.example",
                password: "ServioSeed#2026"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/login", host: ["{{baseUrl}}"], path: ["api", "auth", "login"] }
          }
        },
        {
          name: "1.2 Login as Professional (Auto-set Pro Token)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "const res = pm.response.json();",
                  "if (res.token) {",
                  "  pm.collectionVariables.set('proToken', res.token);",
                  "  pm.collectionVariables.set('token', res.token);",
                  "  console.log('Professional session active. Token saved.');",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "seed.pro@servio.example",
                password: "ServioSeed#2026"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/login", host: ["{{baseUrl}}"], path: ["api", "auth", "login"] }
          }
        },
        {
          name: "1.3 Login as Admin (Auto-set Admin Token)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "const res = pm.response.json();",
                  "if (res.token) {",
                  "  pm.collectionVariables.set('adminToken', res.token);",
                  "  pm.collectionVariables.set('token', res.token);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                username: "admin",
                password: "ServioAdmin#2026"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/admin/login", host: ["{{baseUrl}}"], path: ["api", "admin", "login"] }
          }
        },
        {
          name: "1.4 Register New Client",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "new.client@example.com",
                password: "Password123!",
                firstName: "Aarav",
                lastName: "Sharma",
                role: "CLIENT",
                terms: true
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/register", host: ["{{baseUrl}}"], path: ["api", "auth", "register"] }
          }
        },
        {
          name: "1.5 Register New Professional",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "new.pro@example.com",
                password: "Password123!",
                firstName: "Rohan",
                lastName: "Verma",
                role: "PROFESSIONAL",
                terms: true
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/register", host: ["{{baseUrl}}"], path: ["api", "auth", "register"] }
          }
        },
        {
          name: "1.6 Get Current User Profile (Me)",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/auth/me", host: ["{{baseUrl}}"], path: ["api", "auth", "me"] }
          }
        },
        {
          name: "1.7 Check Email Availability",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "test.check@example.com" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/check-availability", host: ["{{baseUrl}}"], path: ["api", "auth", "check-availability"] }
          }
        },
        {
          name: "1.8 Skip Setup Wizard (Dev/Demo)",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/auth/skip-setup", host: ["{{baseUrl}}"], path: ["api", "auth", "skip-setup"] }
          }
        },
        {
          name: "1.9 Logout",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/auth/logout", host: ["{{baseUrl}}"], path: ["api", "auth", "logout"] }
          }
        }
      ]
    },
    {
      name: "02 - Job & Proposal Full Lifecycle (Post Job to Hiring)",
      item: [
        {
          name: "2.1 Client: Post a New Job",
          event: [
            {
              listen: "prerequest",
              script: {
                exec: [
                  "const token = pm.collectionVariables.get('clientToken') || pm.collectionVariables.get('token');",
                  "pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + token });",
                  "pm.request.headers.upsert({ key: 'Cookie', value: 'servio_session=' + token });"
                ],
                type: "text/javascript"
              }
            },
            {
              listen: "test",
              script: {
                exec: [
                  "const res = pm.response.json();",
                  "if (res.job && res.job.id) {",
                  "  pm.collectionVariables.set('jobId', String(res.job.id));",
                  "  console.log('Created Job ID saved to {{jobId}}:', res.job.id);",
                  "} else if (res.id) {",
                  "  pm.collectionVariables.set('jobId', String(res.id));",
                  "  console.log('Created Job ID saved to {{jobId}}:', res.id);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Complete Office CCTV & Network Setup",
                description: "Need a qualified professional to install 8 IP surveillance cameras, route CAT6 cables, and configure network router.",
                category: "Commercial Services",
                timingType: "FIXED",
                budgetMin: 8000,
                budgetMax: 12000,
                deadline: "2026-12-31",
                locationAddress: "Athwa Gate, Surat, Gujarat",
                locationLat: 21.1702,
                locationLng: 72.8311,
                mode: "publish"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/jobs", host: ["{{baseUrl}}"], path: ["api", "client", "jobs"] }
          }
        },
        {
          name: "2.2 Client: List My Posted Jobs",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/client/jobs", host: ["{{baseUrl}}"], path: ["api", "client", "jobs"] }
          }
        },
        {
          name: "2.3 Browse Open Marketplace Jobs (All / Professional)",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/marketplace/jobs?category=Commercial%20Services&page=1", host: ["{{baseUrl}}"], path: ["api", "marketplace", "jobs"], query: [{ key: "category", value: "Commercial Services" }, { key: "page", value: "1" }] }
          }
        },
        {
          name: "2.4 Professional: SEND REQUEST / PROPOSAL on Job (Bid)",
          event: [
            {
              listen: "prerequest",
              script: {
                exec: [
                  "const proToken = pm.collectionVariables.get('proToken') || pm.collectionVariables.get('token');",
                  "pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + proToken });",
                  "pm.request.headers.upsert({ key: 'Cookie', value: 'servio_session=' + proToken });"
                ],
                type: "text/javascript"
              }
            },
            {
              listen: "test",
              script: {
                exec: [
                  "const res = pm.response.json();",
                  "if (res.proposal && res.proposal.id) {",
                  "  pm.collectionVariables.set('requestId', String(res.proposal.id));",
                  "  console.log('Saved Request / Proposal ID to {{requestId}}:', res.proposal.id);",
                  "} else if (res.id) {",
                  "  pm.collectionVariables.set('requestId', String(res.id));",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                jobId: "{{jobId}}",
                bidAmount: 9500,
                duration: "3-5 days",
                coverLetter: "I am a certified network & surveillance engineer with 6 years experience. I can supply high-grade connectors and complete cabling cleanly."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/professional/proposals", host: ["{{baseUrl}}"], path: ["api", "professional", "proposals"] }
          }
        },
        {
          name: "2.5 Professional: View Proposal Status for Job",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/professional/proposals?jobId={{jobId}}", host: ["{{baseUrl}}"], path: ["api", "professional", "proposals"], query: [{ key: "jobId", value: "{{jobId}}" }] }
          }
        },
        {
          name: "2.6 Client: View Received Proposals / Requests",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/client/project-requests", host: ["{{baseUrl}}"], path: ["api", "client", "project-requests"] }
          }
        },
        {
          name: "2.7 Client: ACCEPT Professional Request / Proposal (Hire)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "const res = pm.response.json();",
                  "if (res.projectId) {",
                  "  pm.collectionVariables.set('projectId', String(res.projectId));",
                  "  console.log('Project Tracking ID created & saved to {{projectId}}:', res.projectId);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "accept"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/project-requests/{{requestId}}", host: ["{{baseUrl}}"], path: ["api", "client", "project-requests", "{{requestId}}"] }
          }
        },
        {
          name: "2.8 Client: Counter-Offer on Proposal (Optional)",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "counter",
                bidAmount: 9000,
                duration: "3 days",
                message: "Can you do 9,000 INR if we supply the mounting brackets?"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/project-requests/{{requestId}}", host: ["{{baseUrl}}"], path: ["api", "client", "project-requests", "{{requestId}}"] }
          }
        },
        {
          name: "2.9 Professional: Accept Client Counter-Offer",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "accept"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/professional/project-requests/{{requestId}}", host: ["{{baseUrl}}"], path: ["api", "professional", "project-requests", "{{requestId}}"] }
          }
        },
        {
          name: "2.10 Client: Direct Hire Request to Professional",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                jobId: "{{jobId}}",
                professionalId: "{{professionalId}}",
                bidAmount: 10000,
                duration: "1 week",
                coverLetter: "We were impressed with your portfolio and would like to directly offer you this job."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/project-requests", host: ["{{baseUrl}}"], path: ["api", "client", "project-requests"] }
          }
        },
        {
          name: "2.11 Client: Update Job Details",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Complete Office CCTV & Network Setup (Updated)",
                budgetMax: 15000
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/jobs/{{jobId}}", host: ["{{baseUrl}}"], path: ["api", "client", "jobs", "{{jobId}}"] }
          }
        },
        {
          name: "2.12 Client: Reopen Completed Job",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                workDescription: "Additional network cables and testing required.",
                amount: 1500,
                reason: "ADDITIONAL_WORK",
                assignPreviousPro: true,
                duration: "1-2 days"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/jobs/{{jobId}}/reopen", host: ["{{baseUrl}}"], path: ["api", "client", "jobs", "{{jobId}}", "reopen"] }
          }
        },
        {
          name: "2.13 Professional: Bookmark / Favorite Job",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/professional/favorite-jobs/{{jobId}}", host: ["{{baseUrl}}"], path: ["api", "professional", "favorite-jobs", "{{jobId}}"] }
          }
        },
        {
          name: "2.14 Export Client Jobs Statement PDF / CSV",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ scope: "all", pageSize: "A4", orientation: "portrait" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/jobs/export", host: ["{{baseUrl}}"], path: ["api", "client", "jobs", "export"] }
          }
        }
      ]
    },
    {
      name: "03 - Projects, Milestones, Escrow & Work Delivery",
      item: [
        {
          name: "3.1 Get Project Tracking Overview",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/portal/project?id={{projectId}}", host: ["{{baseUrl}}"], path: ["api", "portal", "project"], query: [{ key: "id", value: "{{projectId}}" }] }
          }
        },
        {
          name: "3.2 Client: Fund Milestone Escrow via Wallet",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                projectId: "{{projectId}}",
                milestoneId: "{{milestoneId}}"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/milestone", host: ["{{baseUrl}}"], path: ["api", "wallet", "milestone"] }
          }
        },
        {
          name: "3.3 Professional: Start Work on Project",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "start-work",
                projectId: "{{projectId}}"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.4 Professional: Create Project Milestone",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "create-milestone",
                projectId: "{{projectId}}",
                title: "Camera Cabling & Router Configuration",
                amount: 5000,
                description: "Run 8 CAT6 lines and configure IP router."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.5 Professional: Update Progress Status",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "update-progress",
                projectId: "{{projectId}}",
                progress: 75,
                stage: "Wiring Complete",
                note: "Completed all 8 camera drops. Testing connectivity."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.6 Professional: Upload Work Proof File",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                projectId: "{{projectId}}",
                fileName: "installation_photo.jpg",
                fileType: "image/jpeg",
                fileSize: 204800,
                description: "Completed camera installation and patch panel labeling."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-files", host: ["{{baseUrl}}"], path: ["api", "portal", "project-files"] }
          }
        },
        {
          name: "3.7 Professional: Submit Milestone Work for Approval",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "submit-milestone",
                projectId: "{{projectId}}",
                milestoneId: "{{milestoneId}}",
                note: "Cabling and configuration complete. Ready for client inspection."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.8 Client: Request Revision on Milestone",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "request-revision",
                projectId: "{{projectId}}",
                milestoneId: "{{milestoneId}}",
                note: "Please adjust angle of camera 3 covering entrance."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.9 Client: APPROVE Milestone & Release Escrow Payment",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "approve-milestone",
                projectId: "{{projectId}}",
                milestoneId: "{{milestoneId}}"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.10 Professional: Submit Final Project Deliverable",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "submit-final-work",
                projectId: "{{projectId}}",
                note: "All tasks completed, cameras operational, network handover complete."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.11 Client: Confirm Project Completion",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "confirm-project-completion",
                projectId: "{{projectId}}"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.12 Client: Submit Review & Rating for Professional",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "submit-review",
                projectId: "{{projectId}}",
                rating: 5,
                comment: "Excellent work! Punctual, professional cabling, and clear handover."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.13 Professional: Respond to Review",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "respond-to-review",
                projectId: "{{projectId}}",
                response: "Thank you for the prompt communication and great collaboration!"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.14 Raise Dispute (Instant Escrow Freeze)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "submit-dispute",
                projectId: "{{projectId}}",
                milestoneId: "{{milestoneId}}",
                issueType: "QUALITY_OF_WORK",
                priority: "MEDIUM",
                message: "Work submitted requires rectification and does not match agreed plan."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "3.15 Get Milestone Tax Invoice / Payment Receipt",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/portal/payment-details/{{paymentId}}", host: ["{{baseUrl}}"], path: ["api", "portal", "payment-details", "{{paymentId}}"] }
          }
        }
      ]
    },
    {
      name: "04 - Wallet, Razorpay Deposits & Bank Payouts",
      item: [
        {
          name: "4.1 Get Wallet Balance & Transaction Ledger",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/wallet", host: ["{{baseUrl}}"], path: ["api", "wallet"] }
          }
        },
        {
          name: "4.2 Get Razorpay Public Config",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/payments/razorpay/config", host: ["{{baseUrl}}"], path: ["api", "payments", "razorpay", "config"] }
          }
        },
        {
          name: "4.3 Create Razorpay Deposit Order",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "const res = pm.response.json();",
                  "if (res.orderId) {",
                  "  pm.collectionVariables.set('razorpayOrderId', res.orderId);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ amount: 5000 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/deposit/order", host: ["{{baseUrl}}"], path: ["api", "wallet", "deposit", "order"] }
          }
        },
        {
          name: "4.4 Verify Razorpay Payment Signature",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                razorpayOrderId: "{{razorpayOrderId}}",
                razorpayPaymentId: "{{razorpayPaymentId}}",
                razorpaySignature: "{{razorpaySignature}}"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/deposit/verify", host: ["{{baseUrl}}"], path: ["api", "wallet", "deposit", "verify"] }
          }
        },
        {
          name: "4.5 Quick Wallet Deposit (Sandbox / Dev)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ amount: 10000 }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/deposit/quick", host: ["{{baseUrl}}"], path: ["api", "wallet", "deposit", "quick"] }
          }
        },
        {
          name: "4.6 Check Deposit Order Status",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/wallet/deposit/status?orderId={{razorpayOrderId}}", host: ["{{baseUrl}}"], path: ["api", "wallet", "deposit", "status"], query: [{ key: "orderId", value: "{{razorpayOrderId}}" }] }
          }
        },
        {
          name: "4.7 Verify Bank Account (IFSC & Penny Drop)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                accountNumber: "12345678901",
                ifscCode: "SBIN0001234",
                accountHolder: "Rohan Verma"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/verify-bank-account", host: ["{{baseUrl}}"], path: ["api", "wallet", "verify-bank-account"] }
          }
        },
        {
          name: "4.8 Verify UPI VPA Address",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ vpa: "rohanverma@okhdfcbank" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/verify-vpa", host: ["{{baseUrl}}"], path: ["api", "wallet", "verify-vpa"] }
          }
        },
        {
          name: "4.9 Request Wallet Withdrawal / Payout",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                amount: 2500,
                destinationType: "BANK",
                destinationLabel: "State Bank of India - 1234",
                accountNumber: "12345678901",
                ifscCode: "SBIN0001234",
                accountHolder: "Rohan Verma",
                bankName: "State Bank of India"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet", host: ["{{baseUrl}}"], path: ["api", "wallet"] }
          }
        }
      ]
    },
    {
      name: "05 - Professional Portal, KYC & Earnings",
      item: [
        {
          name: "5.1 Get Professional Profile",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/professional/profile", host: ["{{baseUrl}}"], path: ["api", "professional", "profile"] }
          }
        },
        {
          name: "5.2 Update Professional Profile",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Senior Electrical & Surveillance Engineer",
                bio: "Over 8 years experience in domestic and commercial electrical systems and CCTV surveillance.",
                hourlyRate: 650,
                skills: ["CCTV", "Network Cabling", "Electrical Wiring", "Patch Panels"]
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/professional/profile", host: ["{{baseUrl}}"], path: ["api", "professional", "profile"] }
          }
        },
        {
          name: "5.3 Export Earnings Statement CSV",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: { mode: "raw", raw: JSON.stringify({ range: "this_year" }, null, 2) },
            url: { raw: "{{baseUrl}}/api/professional/earnings/export", host: ["{{baseUrl}}"], path: ["api", "professional", "earnings", "export"] }
          }
        },
        {
          name: "5.4 Get Linked Razorpay Payout Account",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/professional/razorpay-account", host: ["{{baseUrl}}"], path: ["api", "professional", "razorpay-account"] }
          }
        },
        {
          name: "5.5 Connect / Update Razorpay Payout Account",
          request: {
            method: "PUT",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                accountNumber: "12345678901",
                ifsc: "SBIN0001234",
                accountHolderName: "Rohan Verma"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/professional/razorpay-account", host: ["{{baseUrl}}"], path: ["api", "professional", "razorpay-account"] }
          }
        },
        {
          name: "5.6 Get Professional KYC Verification Status",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/professional/verification", host: ["{{baseUrl}}"], path: ["api", "professional", "verification"] }
          }
        },
        {
          name: "5.7 Upload Professional KYC Document",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{proToken}}" },
              { key: "Cookie", value: "servio_session={{proToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                documentType: "AADHAAR",
                fileName: "aadhaar_front.pdf",
                fileSize: 450000
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/professional/verification/upload", host: ["{{baseUrl}}"], path: ["api", "professional", "verification", "upload"] }
          }
        }
      ]
    },
    {
      name: "06 - Client Workspace & Verification",
      item: [
        {
          name: "6.1 Get Client Account Profile",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/client/account", host: ["{{baseUrl}}"], path: ["api", "client", "account"] }
          }
        },
        {
          name: "6.2 List Saved Professionals",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/client/saved-professionals", host: ["{{baseUrl}}"], path: ["api", "client", "saved-professionals"] }
          }
        },
        {
          name: "6.3 Save Professional Bookmark",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/client/saved-professionals/{{professionalId}}", host: ["{{baseUrl}}"], path: ["api", "client", "saved-professionals", "{{professionalId}}"] }
          }
        },
        {
          name: "6.4 Remove Saved Professional Bookmark",
          request: {
            method: "DELETE",
            header: [
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/client/saved-professionals/{{professionalId}}", host: ["{{baseUrl}}"], path: ["api", "client", "saved-professionals", "{{professionalId}}"] }
          }
        },
        {
          name: "6.5 Get Client KYC Status",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            url: { raw: "{{baseUrl}}/api/client/verification", host: ["{{baseUrl}}"], path: ["api", "client", "verification"] }
          }
        },
        {
          name: "6.6 Export Payment History CSV",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{clientToken}}" },
              { key: "Cookie", value: "servio_session={{clientToken}}" }
            ],
            body: { mode: "raw", raw: JSON.stringify({ range: "all" }, null, 2) },
            url: { raw: "{{baseUrl}}/api/client/payments/export", host: ["{{baseUrl}}"], path: ["api", "client", "payments", "export"] }
          }
        }
      ]
    },
    {
      name: "07 - Identity & KYC Verification Suite",
      item: [
        {
          name: "7.1 Verify Indian PAN Card",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                panNumber: "ABCDE1234F",
                fullName: "Rohan Verma",
                dob: "1994-05-15"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/verification/indian/pan", host: ["{{baseUrl}}"], path: ["api", "verification", "indian", "pan"] }
          }
        },
        {
          name: "7.2 Verify Indian Aadhaar (DigiLocker / OTP)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                aadhaarNumber: "123456789012",
                otp: "123456"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/verification/indian/aadhaar", host: ["{{baseUrl}}"], path: ["api", "verification", "indian", "aadhaar"] }
          }
        },
        {
          name: "7.3 Start Persona KYC Session",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/verification/persona/start", host: ["{{baseUrl}}"], path: ["api", "verification", "persona", "start"] }
          }
        },
        {
          name: "7.4 Check Persona KYC Status",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/verification/persona/status", host: ["{{baseUrl}}"], path: ["api", "verification", "persona", "status"] }
          }
        },
        {
          name: "7.5 Start SpringVerify Background Check",
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/verification/springverify/start", host: ["{{baseUrl}}"], path: ["api", "verification", "springverify", "start"] }
          }
        }
      ]
    },
    {
      name: "08 - Real-Time Messages & Chat",
      item: [
        {
          name: "8.1 List Conversations",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/v1/messages", host: ["{{baseUrl}}"], path: ["api", "v1", "messages"] }
          }
        },
        {
          name: "8.2 Get Conversation Messages",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/v1/messages?conversationId=1", host: ["{{baseUrl}}"], path: ["api", "v1", "messages"], query: [{ key: "conversationId", value: "1" }] }
          }
        },
        {
          name: "8.3 Send Chat Message",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                recipientId: "{{professionalId}}",
                content: "Hello! When can you begin the cabling installation?"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/v1/messages", host: ["{{baseUrl}}"], path: ["api", "v1", "messages"] }
          }
        }
      ]
    },
    {
      name: "09 - Marketplace, Discovery & Search",
      item: [
        {
          name: "9.1 Browse Categories Hierarchy",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/api/marketplace/categories", host: ["{{baseUrl}}"], path: ["api", "marketplace", "categories"] }
          }
        },
        {
          name: "9.2 Browse Professionals with Filters",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/api/marketplace/professionals?category=Commercial%20Services", host: ["{{baseUrl}}"], path: ["api", "marketplace", "professionals"], query: [{ key: "category", value: "Commercial Services" }] }
          }
        },
        {
          name: "9.3 Universal Keyword Search",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/api/search?q=cctv", host: ["{{baseUrl}}"], path: ["api", "search"], query: [{ key: "q", value: "cctv" }] }
          }
        },
        {
          name: "9.4 Geocoding Address Lookup",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/api/geocode?q=Marine%20Drive%20Mumbai", host: ["{{baseUrl}}"], path: ["api", "geocode"], query: [{ key: "q", value: "Marine Drive Mumbai" }] }
          }
        },
        {
          name: "9.5 Public Contact Form Submission",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Rahul Mehta",
                email: "rahul@example.com",
                subject: "Enterprise Inquiry",
                message: "We need onboarding for our 50 regional technicians."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/contact", host: ["{{baseUrl}}"], path: ["api", "contact"] }
          }
        },
        {
          name: "9.6 Dashboard Overview Stats",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{token}}" },
              { key: "Cookie", value: "servio_session={{token}}" }
            ],
            url: { raw: "{{baseUrl}}/api/dashboard", host: ["{{baseUrl}}"], path: ["api", "dashboard"] }
          }
        }
      ]
    },
    {
      name: "10 - Admin Suite & Operations",
      item: [
        {
          name: "10.1 Admin Overview Analytics",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/data/overview", host: ["{{baseUrl}}"], path: ["api", "admin", "data", "overview"] }
          }
        },
        {
          name: "10.2 Admin Sidebar Counters",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/sidebar-counts", host: ["{{baseUrl}}"], path: ["api", "admin", "sidebar-counts"] }
          }
        },
        {
          name: "10.3 Database & Migration Status",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/database-status", host: ["{{baseUrl}}"], path: ["api", "admin", "database-status"] }
          }
        },
        {
          name: "10.4 Get Platform Settings",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/settings", host: ["{{baseUrl}}"], path: ["api", "admin", "settings"] }
          }
        },
        {
          name: "10.5 Update Platform Settings",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                commissionRate: 5.0,
                autoReleaseDays: 3
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/admin/settings", host: ["{{baseUrl}}"], path: ["api", "admin", "settings"] }
          }
        },
        {
          name: "10.6 List Pending KYC Verifications",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/verifications", host: ["{{baseUrl}}"], path: ["api", "admin", "verifications"] }
          }
        },
        {
          name: "10.7 Approve / Reject KYC Application",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                verificationId: 1,
                status: "APPROVED",
                rejectionReason: null
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/admin/verifications", host: ["{{baseUrl}}"], path: ["api", "admin", "verifications"] }
          }
        },
        {
          name: "10.8 Get Dispute Details",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/disputes/1", host: ["{{baseUrl}}"], path: ["api", "admin", "disputes", "1"] }
          }
        },
        {
          name: "10.9 Resolve Dispute & Escrow Release",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                resolution: "RELEASE_TO_PROFESSIONAL",
                notes: "Inspection verified cables were properly labeled and functional."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/admin/disputes/1", host: ["{{baseUrl}}"], path: ["api", "admin", "disputes", "1"] }
          }
        },
        {
          name: "10.10 Send Admin Message in Dispute Thread",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                message: "Admin mediation team is reviewing photographic proof submitted."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/admin/disputes/1/messages", host: ["{{baseUrl}}"], path: ["api", "admin", "disputes", "1", "messages"] }
          }
        },
        {
          name: "10.11 Get Finance & Payouts Ledger",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/finance/payouts", host: ["{{baseUrl}}"], path: ["api", "admin", "finance", "payouts"] }
          }
        },
        {
          name: "10.12 Approve / Reject Withdrawal Request",
          request: {
            method: "PATCH",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({ action: "approve" }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/admin/finance/withdrawals/1", host: ["{{baseUrl}}"], path: ["api", "admin", "finance", "withdrawals", "1"] }
          }
        },
        {
          name: "10.13 Get Escrow Holdings Report",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/extra/escrow", host: ["{{baseUrl}}"], path: ["api", "admin", "extra", "escrow"] }
          }
        },
        {
          name: "10.14 Security Audit Logs",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
            url: { raw: "{{baseUrl}}/api/admin/extra/audit-logs", host: ["{{baseUrl}}"], path: ["api", "admin", "extra", "audit-logs"] }
          }
        }
      ]
    },
    {
      name: "11 - Webhooks & Autonomous Cron Automation",
      item: [
        {
          name: "11.1 Razorpay Payment Webhook",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "x-razorpay-signature", value: "mock_signature" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                event: "payment.captured",
                payload: {
                  payment: {
                    entity: {
                      id: "pay_test123",
                      order_id: "order_test123",
                      amount: 500000,
                      status: "captured"
                    }
                  }
                }
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/webhooks/razorpay", host: ["{{baseUrl}}"], path: ["api", "webhooks", "razorpay"] }
          }
        },
        {
          name: "11.2 Persona KYC Webhook",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                data: {
                  attributes: {
                    status: "completed",
                    payload: { inquiryId: "inq_test123" }
                  }
                }
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/webhooks/persona", host: ["{{baseUrl}}"], path: ["api", "webhooks", "persona"] }
          }
        },
        {
          name: "11.3 SpringVerify Background Check Webhook",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                event: "check.completed",
                candidateId: "cand_123"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/webhooks/springverify", host: ["{{baseUrl}}"], path: ["api", "webhooks", "springverify"] }
          }
        },
        {
          name: "11.4 Milestone 3-Day Auto-Release Cron (15-min autonomous)",
          request: {
            method: "GET",
            header: [
              { key: "x-internal-loopback", value: "true" },
              { key: "Authorization", value: "Bearer {{cronSecret}}" }
            ],
            url: { raw: "{{baseUrl}}/api/cron/milestone-releases", host: ["{{baseUrl}}"], path: ["api", "cron", "milestone-releases"] }
          }
        }
      ]
    }
  ]
};

const jsonStr = JSON.stringify(collection, null, 2);

// Target files to update
const targetPaths = [
  "D:\\Klick-Pro API Collection.postman_collection.json",
  path.resolve("KlickPro_APIs.postman_collection.json"),
  path.resolve("klick-pro-postman-collection.json")
];

targetPaths.forEach(tp => {
  try {
    fs.writeFileSync(tp, jsonStr, "utf8");
    console.log("Successfully wrote Postman collection to:", tp);
  } catch (err) {
    console.error("Failed to write to:", tp, err.message);
  }
});

let totalEndpoints = 0;
function countReq(items) {
  for (const it of items) {
    if (it.item) countReq(it.item);
    else totalEndpoints++;
  }
}
countReq(collection.item);
console.log("Total comprehensive endpoints in collection:", totalEndpoints);
