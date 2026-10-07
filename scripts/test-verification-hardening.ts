import "dotenv/config";
import crypto from "node:crypto";
import { PersonaAdapter } from "../src/lib/verification/adapters/persona.adapter";
import { AuthBridgeAdapter } from "../src/lib/verification/adapters/authbridge.adapter";
import { SpringVerifyAdapter } from "../src/lib/verification/adapters/springverify.adapter";
import { VerificationService } from "../src/services/verification.service";
import { db } from "../src/lib/db";

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      return true;
    })
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      return false;
    });
}

function generateSignatureHeader(secret: string, body: string, timestampSeconds?: number): string {
  const t = timestampSeconds ?? Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

async function main() {
  console.log(
    "\n=== Starting Verification Subsystem Tests (Persona + AuthBridge + SpringVerify) ===\n",
  );

  const testSecret = "test_webhook_secret_key_123456789";
  const personaAdapter = new PersonaAdapter({
    enabled: true,
    apiKey: "test_key",
    templateId: "test_template",
    webhookSecret: testSecret,
  });

  const authBridgeAdapter = new AuthBridgeAdapter({
    enabled: true,
    apiKey: "test_ab_key",
    clientId: "test_client",
    webhookSecret: testSecret,
    isDevelopment: true,
  });

  const springVerifyAdapter = new SpringVerifyAdapter({
    enabled: true,
    apiKey: "test_sv_key",
    webhookSecret: testSecret,
    isDevelopment: true,
  });

  const validPayload = JSON.stringify({
    data: {
      id: "evt_12345",
      type: "event",
      attributes: {
        name: "inquiry.completed",
        "created-at": new Date().toISOString(),
        payload: {
          data: {
            id: "inq_99999",
            type: "inquiry",
            attributes: {
              status: "completed",
            },
          },
        },
      },
    },
  });

  const results: boolean[] = [];

  // --- 1. Persona Tests ---
  console.log("1. Persona Webhook Security Tests:");

  results.push(
    await runTest("accepts valid HMAC signature within timestamp window", () => {
      const header = generateSignatureHeader(testSecret, validPayload);
      const isValid = personaAdapter.verifyWebhookSignature(validPayload, header);
      if (!isValid) throw new Error("Expected valid signature to pass verification");
    }),
  );

  results.push(
    await runTest("rejects tampered payload content", () => {
      const header = generateSignatureHeader(testSecret, validPayload);
      const tampered = validPayload.replace("completed", "approved");
      const isValid = personaAdapter.verifyWebhookSignature(tampered, header);
      if (isValid) throw new Error("Tampered payload should have failed verification");
    }),
  );

  results.push(
    await runTest("rejects signature older than 300 seconds (replay prevention)", () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 360;
      const header = generateSignatureHeader(testSecret, validPayload, expiredTimestamp);
      const isValid = personaAdapter.verifyWebhookSignature(validPayload, header);
      if (isValid) throw new Error("Expired webhook timestamp should have failed verification");
    }),
  );

  // --- 2. AuthBridge Indian KYC Tests ---
  console.log("\n2. AuthBridge (Indian KYC / PAN) Tests:");

  results.push(
    await runTest("masks PAN properly without exposing raw digits", () => {
      const masked = authBridgeAdapter.maskPan("ABCDE1234F");
      if (masked !== "ABCDE****F") throw new Error(`Wrong masking: ${masked}`);
    }),
  );

  results.push(
    await runTest("verifies valid PAN format and returns verified record", async () => {
      const res = await authBridgeAdapter.verifyPan(
        { id: 999, firstName: "Juned", lastName: "Patel" },
        "ABCDE1234F",
      );
      if (res.status !== "approved" || res.maskedPan !== "ABCDE****F") {
        throw new Error(`Unexpected PAN result: ${JSON.stringify(res)}`);
      }
    }),
  );

  results.push(
    await runTest("rejects invalid PAN format", async () => {
      let threw = false;
      try {
        await authBridgeAdapter.verifyPan(
          { id: 999, firstName: "Juned", lastName: "Patel" },
          "INVALID_PAN_123",
        );
      } catch {
        threw = true;
      }
      if (!threw) throw new Error("Should have thrown error on invalid PAN format");
    }),
  );

  results.push(
    await runTest("masks Aadhaar properly without exposing raw digits", () => {
      const masked = authBridgeAdapter.maskAadhaar("123456789012");
      if (masked !== "XXXX-XXXX-9012") throw new Error(`Wrong Aadhaar masking: ${masked}`);
    }),
  );

  results.push(
    await runTest("verifies valid Aadhaar format and returns verified record", async () => {
      const res = await authBridgeAdapter.verifyAadhaar(
        { id: 999, firstName: "Juned", lastName: "Patel" },
        "123456789012",
      );
      if (res.status !== "approved" || res.maskedAadhaar !== "XXXX-XXXX-9012") {
        throw new Error(`Unexpected Aadhaar result: ${JSON.stringify(res)}`);
      }
    }),
  );

  results.push(
    await runTest("rejects invalid Aadhaar format (less than 12 digits)", async () => {
      let threw = false;
      try {
        await authBridgeAdapter.verifyAadhaar(
          { id: 999, firstName: "Juned", lastName: "Patel" },
          "123456789",
        );
      } catch {
        threw = true;
      }
      if (!threw) throw new Error("Should have thrown error on invalid Aadhaar length");
    }),
  );

  // --- 3. SpringVerify BGV Tests ---
  console.log("\n3. SpringVerify (Background Check) Tests:");

  results.push(
    await runTest("initiates candidate background check", async () => {
      const res = await springVerifyAdapter.initiateBgvCheck({
        id: 999,
        firstName: "Juned",
        lastName: "Patel",
        email: "juned@example.com",
      });
      if (!res.checkId.startsWith("sv_chk_") || res.status !== "pending") {
        throw new Error(`Unexpected BGV result: ${JSON.stringify(res)}`);
      }
    }),
  );

  results.push(
    await runTest("normalizes SpringVerify check.completed webhook to approved", () => {
      const svPayload = JSON.stringify({
        id: "evt_sv_001",
        event: "check.completed",
        timestamp: new Date().toISOString(),
        payload: {
          candidate_id: "sv_cand_999",
          status: "CLEAR",
        },
      });
      const parsed = springVerifyAdapter.parseWebhookPayload(svPayload);
      if (!parsed || parsed.status !== "approved") {
        throw new Error(`Expected normalized status 'approved', got '${parsed?.status}'`);
      }
    }),
  );

  // --- 4. Database & Service Integration Tests ---
  console.log("\n4. VerificationService End-to-End Integration Tests:");

  const service = new VerificationService(personaAdapter, authBridgeAdapter, springVerifyAdapter);

  let testUserId = 0;
  let adminUserId = 0;
  let panInquiryId = "";
  let aadhaarInquiryId = "";
  let bgvCheckId = "";

  try {
    const testUser = await db.user.create({
      data: {
        email: `test_indian_pro_${Date.now()}@example.com`,
        passwordHash: "test_hash",
        firstName: "Ramesh",
        lastName: "Sharma",
        role: "PROFESSIONAL",
        isVerified: false,
      },
    });
    testUserId = testUser.id;

    const adminUser = await db.user.create({
      data: {
        email: `test_admin_${Date.now()}@example.com`,
        passwordHash: "test_hash",
        firstName: "Admin",
        lastName: "Compliance",
        role: "ADMIN",
      },
    });
    adminUserId = adminUser.id;

    results.push(
      await runTest("verifies PAN and writes AuthBridge record to DB", async () => {
        const panRes = await service.verifyIndianPan(testUserId, "ABCDE1234F");
        panInquiryId = panRes.inquiryId;

        const dbRecord = await db.personaVerification.findUnique({
          where: { providerInquiryId: panInquiryId },
        });
        if (
          !dbRecord ||
          dbRecord.provider !== "authbridge" ||
          dbRecord.providerStatus !== "approved"
        ) {
          throw new Error(`AuthBridge PAN record in DB incorrect: ${JSON.stringify(dbRecord)}`);
        }
      }),
    );

    results.push(
      await runTest("verifies Aadhaar and writes AuthBridge record to DB", async () => {
        const aadhaarRes = await service.verifyIndianAadhaar(testUserId, "123456789012");
        aadhaarInquiryId = aadhaarRes.inquiryId;

        const dbRecord = await db.personaVerification.findUnique({
          where: { providerInquiryId: aadhaarInquiryId },
        });
        if (
          !dbRecord ||
          dbRecord.provider !== "authbridge" ||
          dbRecord.providerStatus !== "approved"
        ) {
          throw new Error(`AuthBridge Aadhaar record in DB incorrect: ${JSON.stringify(dbRecord)}`);
        }
      }),
    );

    results.push(
      await runTest("initiates SpringVerify BGV and writes record to DB", async () => {
        const bgvRes = await service.initiateSpringVerifyBgv(testUserId);
        bgvCheckId = bgvRes.checkId;

        const dbRecord = await db.personaVerification.findUnique({
          where: { providerInquiryId: bgvCheckId },
        });
        if (
          !dbRecord ||
          dbRecord.provider !== "springverify" ||
          dbRecord.providerStatus !== "pending"
        ) {
          throw new Error(`SpringVerify record in DB incorrect: ${JSON.stringify(dbRecord)}`);
        }
      }),
    );

    results.push(
      await runTest("admin review of AuthBridge/SpringVerify flips user.isVerified", async () => {
        await service.reviewPersonaVerification({
          providerInquiryId: panInquiryId,
          adminId: adminUserId,
          status: "APPROVED",
        });

        const verifiedUser = await db.user.findUnique({ where: { id: testUserId } });
        if (!verifiedUser?.isVerified) {
          throw new Error("user.isVerified was not flipped to true after review");
        }

        const audit = await db.auditLog.findFirst({
          where: {
            actorId: adminUserId,
            entityId: panInquiryId,
          },
        });
        if (!audit) throw new Error("AuditLog was not created for Indian KYC approval");
      }),
    );
  } finally {
    // Cleanup test data
    if (panInquiryId) {
      await db.personaVerification
        .deleteMany({ where: { providerInquiryId: panInquiryId } })
        .catch(() => null);
      await db.auditLog.deleteMany({ where: { entityId: panInquiryId } }).catch(() => null);
    }
    if (aadhaarInquiryId) {
      await db.personaVerification
        .deleteMany({ where: { providerInquiryId: aadhaarInquiryId } })
        .catch(() => null);
      await db.auditLog.deleteMany({ where: { entityId: aadhaarInquiryId } }).catch(() => null);
    }
    if (bgvCheckId) {
      await db.personaVerification
        .deleteMany({ where: { providerInquiryId: bgvCheckId } })
        .catch(() => null);
    }
    if (testUserId) {
      await db.user.delete({ where: { id: testUserId } }).catch(() => null);
    }
    if (adminUserId) {
      await db.user.delete({ where: { id: adminUserId } }).catch(() => null);
    }
  }

  console.log("\n-------------------------------------------");
  const passed = results.filter(Boolean).length;
  console.log(`Results: ${passed}/${results.length} passed.`);

  await db.$disconnect().catch(() => null);

  if (passed !== results.length) {
    process.exit(1);
  }
  process.exit(0);
}

void main();
