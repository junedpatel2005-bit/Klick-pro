import fs from "fs";
import path from "path";

const collection = {
  info: {
    _postman_id: "c4b12345-6789-4abc-def0-123456789abc",
    name: "Klick Pro - Marketplace & Escrow API Collection",
    description: "Official comprehensive API test collection for Klick Pro platform. Includes Auth, Razorpay deposit & order generation, Escrow funding, 3-day validity release cron worker, dispute freeze/resume, professional withdrawals, and PDF exports.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000", type: "string" },
    { key: "token", value: "", type: "string" },
    { key: "cronSecret", value: "servio-cron-internal-secret-2026", type: "string" },
    { key: "jobId", value: "1", type: "string" },
    { key: "projectId", value: "1", type: "string" },
    { key: "milestoneId", value: "1", type: "string" },
    { key: "paymentId", value: "1", type: "string" }
  ],
  item: [
    {
      name: "01 - Authentication",
      item: [
        {
          name: "Register Client",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "client@example.com",
                password: "Password123!",
                firstName: "Aarav",
                lastName: "Sharma",
                role: "CLIENT",
                phone: "+919876543210"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/register", host: ["{{baseUrl}}"], path: ["api", "auth", "register"] }
          }
        },
        {
          name: "Register Professional",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "pro@example.com",
                password: "Password123!",
                firstName: "Rohan",
                lastName: "Verma",
                role: "PROFESSIONAL",
                phone: "+919876543211",
                category: "Electrical Engineering",
                city: "Surat"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/register", host: ["{{baseUrl}}"], path: ["api", "auth", "register"] }
          }
        },
        {
          name: "Login User",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "const response = pm.response.json();",
                  "if (response.token) {",
                  "  pm.collectionVariables.set('token', response.token);",
                  "  pm.environment.set('token', response.token);",
                  "  console.log('Saved auth token:', response.token);",
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
                email: "client@example.com",
                password: "Password123!"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/auth/login", host: ["{{baseUrl}}"], path: ["api", "auth", "login"] }
          }
        },
        {
          name: "Get Current Profile (Me)",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/api/auth/me", host: ["{{baseUrl}}"], path: ["api", "auth", "me"] }
          }
        }
      ]
    },
    {
      name: "02 - Wallet & Razorpay Deposits",
      item: [
        {
          name: "Get Razorpay Config",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/api/payments/razorpay/config", host: ["{{baseUrl}}"], path: ["api", "payments", "razorpay", "config"] }
          }
        },
        {
          name: "Create Razorpay Deposit Order",
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
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                amount: 5000,
                currency: "INR",
                notes: { purpose: "Wallet Balance Top-Up" }
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/deposit/order", host: ["{{baseUrl}}"], path: ["api", "wallet", "deposit", "order"] }
          }
        },
        {
          name: "Verify Razorpay Payment Signature",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                razorpay_order_id: "{{razorpayOrderId}}",
                razorpay_payment_id: "pay_test_123456789",
                razorpay_signature: "mock_signature_for_test_environment"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/deposit/verify", host: ["{{baseUrl}}"], path: ["api", "wallet", "deposit", "verify"] }
          }
        },
        {
          name: "Get Wallet Balance & Ledger",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/api/wallet", host: ["{{baseUrl}}"], path: ["api", "wallet"] }
          }
        }
      ]
    },
    {
      name: "03 - Wallet Withdrawals & Banking",
      item: [
        {
          name: "Verify Bank Account (Penny Drop / IFSC)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                accountNumber: "123456789012",
                ifsc: "SBIN0001234",
                accountHolderName: "Rohan Verma"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/verify-bank-account", host: ["{{baseUrl}}"], path: ["api", "wallet", "verify-bank-account"] }
          }
        },
        {
          name: "Verify UPI VPA",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                vpa: "rohanverma@okhdfcbank"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/verify-vpa", host: ["{{baseUrl}}"], path: ["api", "wallet", "verify-vpa"] }
          }
        },
        {
          name: "Request Payout / Withdrawal",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                amount: 3000,
                method: "BANK_ACCOUNT",
                accountId: "1"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/withdraw", host: ["{{baseUrl}}"], path: ["api", "wallet", "withdraw"] }
          }
        }
      ]
    },
    {
      name: "04 - Milestone Escrow, Disputes & 15m Cron",
      item: [
        {
          name: "Fund Milestone Escrow (Deposit to Escrow)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                milestoneId: "{{milestoneId}}",
                amount: 4000,
                action: "FUND"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/wallet/milestone", host: ["{{baseUrl}}"], path: ["api", "wallet", "milestone"] }
          }
        },
        {
          name: "Release Milestone Payment (Client Approval)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "RELEASE_MILESTONE",
                milestoneId: "{{milestoneId}}"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "Raise Dispute (Instantly Freezes Auto-Payout)",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                action: "RAISE_DISPUTE",
                milestoneId: "{{milestoneId}}",
                reason: "Work submitted requires rectification and revision."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/portal/project-actions", host: ["{{baseUrl}}"], path: ["api", "portal", "project-actions"] }
          }
        },
        {
          name: "Autonomous 15m Milestone Cron Worker (Server Background Release)",
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
    },
    {
      name: "05 - Marketplace & Radius Discovery (1-100 km)",
      item: [
        {
          name: "Post New Job",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Complete Office CCTV & Network Setup",
                description: "Need licensed technician to set up 8 IP cameras and patch panel.",
                category: "Security & Networking",
                timingType: "FIXED",
                budgetMin: 8000,
                budgetMax: 12000,
                locationAddress: "Athwa Gate, Surat, Gujarat",
                latitude: 21.1702,
                longitude: 72.8311
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/jobs", host: ["{{baseUrl}}"], path: ["api", "client", "jobs"] }
          }
        },
        {
          name: "Discovery Jobs with 25 km Radius Filter",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: {
              raw: "{{baseUrl}}/api/marketplace/jobs?radiusKm=25&lat=21.1702&lng=72.8311&nearMe=true",
              host: ["{{baseUrl}}"],
              path: ["api", "marketplace", "jobs"],
              query: [
                { key: "radiusKm", value: "25" },
                { key: "lat", value: "21.1702" },
                { key: "lng", value: "72.8311" },
                { key: "nearMe", value: "true" }
              ]
            }
          }
        },
        {
          name: "Discovery Jobs with 50 km Radius Filter",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: {
              raw: "{{baseUrl}}/api/marketplace/jobs?radiusKm=50&lat=21.1702&lng=72.8311&nearMe=true",
              host: ["{{baseUrl}}"],
              path: ["api", "marketplace", "jobs"],
              query: [
                { key: "radiusKm", value: "50" },
                { key: "lat", value: "21.1702" },
                { key: "lng", value: "72.8311" },
                { key: "nearMe", value: "true" }
              ]
            }
          }
        },
        {
          name: "Reopen Completed Job",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                reason: "Additional scope requested by client."
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/jobs/{{jobId}}/reopen", host: ["{{baseUrl}}"], path: ["api", "client", "jobs", "{{jobId}}", "reopen"] }
          }
        }
      ]
    },
    {
      name: "06 - Reports & Official PDF Dossiers",
      item: [
        {
          name: "Export Full Job Dossier PDF",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/api/portal/jobs/{{jobId}}/export", host: ["{{baseUrl}}"], path: ["api", "portal", "jobs", "{{jobId}}", "export"] }
          }
        },
        {
          name: "Export Client Projects Statement PDF / CSV",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Authorization", value: "Bearer {{token}}" }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                scope: "all",
                pageSize: "A4",
                orientation: "portrait"
              }, null, 2)
            },
            url: { raw: "{{baseUrl}}/api/client/jobs/export", host: ["{{baseUrl}}"], path: ["api", "client", "jobs", "export"] }
          }
        },
        {
          name: "Export Milestone Tax Invoice PDF",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/api/portal/invoices/{{paymentId}}", host: ["{{baseUrl}}"], path: ["api", "portal", "invoices", "{{paymentId}}"] }
          }
        }
      ]
    }
  ]
};

const jsonStr = JSON.stringify(collection, null, 2);

// Save to project repository
const repoPath = path.resolve("klick-pro-postman-collection.json");
fs.writeFileSync(repoPath, jsonStr, "utf8");
console.log("Written Postman collection to:", repoPath);

// Save to D:\ drive for easy sharing
try {
  const dPath = "D:\\Klick_Pro_API_Collection.postman_collection.json";
  fs.writeFileSync(dPath, jsonStr, "utf8");
  console.log("Written Postman collection copy to:", dPath);
} catch (e) {
  console.warn("Could not write to D drive root:", e.message);
}
