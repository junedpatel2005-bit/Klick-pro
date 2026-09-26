import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  emitAdminNotification,
  emitAdminVerificationsUpdate,
  emitRealtimeNotification,
} from "@/lib/realtime";
import {
  AuthBridgeAdapter,
  authBridgeAdapter,
} from "@/lib/verification/adapters/authbridge.adapter";
import { PersonaAdapter, personaAdapter } from "@/lib/verification/adapters/persona.adapter";
import {
  SpringVerifyAdapter,
  springVerifyAdapter,
} from "@/lib/verification/adapters/springverify.adapter";
import type {
  AadhaarVerificationResult,
  BgvCheckSession,
  PanVerificationResult,
  VerificationInquirySession,
  VerificationStatusResponse,
  VerificationUser,
  WebhookProcessResult,
} from "@/lib/verification/types";

export class VerificationService {
  constructor(
    private persona: PersonaAdapter = personaAdapter,
    private authBridge: AuthBridgeAdapter = authBridgeAdapter,
    private springVerify: SpringVerifyAdapter = springVerifyAdapter,
  ) {}

  public isConfigured(): boolean {
    return this.persona.isConfigured();
  }

  public getConfig() {
    return {
      persona: this.persona.getConfig(),
      authBridge: this.authBridge.getConfig(),
      springVerify: this.springVerify.getConfig(),
    };
  }

  // --- Persona Flow ---

  public async startVerification(userId: number): Promise<{
    enabled: boolean;
    inquiryId?: string;
    status?: string;
    hostedUrl?: string | null;
    message?: string;
  }> {
    if (!this.persona.isConfigured()) {
      return {
        enabled: false,
        message: "Document verification is not currently configured.",
      };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user || !user.isActive) {
      throw new Error("Active user account not found.");
    }

    if (user.isVerified) {
      return {
        enabled: true,
        status: "approved",
        message: "Your identity is already verified.",
      };
    }

    // Check for an existing open inquiry within the last 24 hours to prevent orphan spamming
    const existingInquiry = await db.personaVerification.findFirst({
      where: {
        userId: user.id,
        provider: "persona",
        adminStatus: "PENDING",
        providerStatus: { in: ["created", "pending"] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingInquiry) {
      return {
        enabled: true,
        inquiryId: existingInquiry.providerInquiryId,
        status: existingInquiry.providerStatus,
        message: "A verification inquiry is already in progress.",
      };
    }

    const idempotencyKey = `servio-persona-${user.id}-${crypto.randomUUID()}`;
    const verificationUser: VerificationUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const session: VerificationInquirySession | null = await this.persona.createInquiry(
      verificationUser,
      idempotencyKey,
    );

    if (!session) {
      return {
        enabled: false,
        message: "Document verification is not currently configured.",
      };
    }

    await db.personaVerification.create({
      data: {
        userId: user.id,
        provider: "persona",
        providerInquiryId: session.inquiryId,
        providerStatus: session.status,
      },
    });

    emitAdminVerificationsUpdate({ userId: user.id });

    return {
      enabled: true,
      inquiryId: session.inquiryId,
      status: session.status,
      hostedUrl: session.hostedUrl,
    };
  }

  // --- AuthBridge Indian Verification (PAN / Aadhaar) ---

  public async verifyIndianPan(userId: number, panNumber: string): Promise<PanVerificationResult> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new Error("Active user account not found.");
    }

    const verificationUser: VerificationUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const result = await this.authBridge.verifyPan(verificationUser, panNumber);

    // Save verification record
    await db.personaVerification.create({
      data: {
        userId: user.id,
        provider: "authbridge",
        providerInquiryId: result.inquiryId,
        providerStatus: result.status,
        adminStatus: "PENDING",
      },
    });

    emitAdminNotification({
      title: "PAN Verification Submitted",
      description: `${user.firstName} ${user.lastName} submitted PAN (${result.maskedPan}) for verification review.`,
      href: "/admin/verifications",
      type: "VERIFICATION_SUBMITTED",
    });

    emitAdminVerificationsUpdate({ userId: user.id });

    return result;
  }

  public async verifyIndianAadhaar(
    userId: number,
    aadhaarNumber: string,
  ): Promise<AadhaarVerificationResult> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new Error("Active user account not found.");
    }

    const verificationUser: VerificationUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const result = await this.authBridge.verifyAadhaar(verificationUser, aadhaarNumber);

    // Save verification record
    await db.personaVerification.create({
      data: {
        userId: user.id,
        provider: "authbridge",
        providerInquiryId: result.inquiryId,
        providerStatus: result.status,
        adminStatus: "PENDING",
      },
    });

    emitAdminNotification({
      title: "Aadhaar Verification Submitted",
      description: `${user.firstName} ${user.lastName} submitted Aadhaar (${result.maskedAadhaar}) for verification review.`,
      href: "/admin/verifications",
      type: "VERIFICATION_SUBMITTED",
    });

    emitAdminVerificationsUpdate({ userId: user.id });

    return result;
  }

  public async initiateAuthBridgeAadhaar(
    userId: number,
    returnUrl: string,
  ): Promise<{ enabled: boolean; inquiryId: string; redirectionUrl: string }> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new Error("Active user account not found.");
    }

    const session = await this.authBridge.initiateAadhaarDigiLocker(user, returnUrl);

    await db.personaVerification.create({
      data: {
        userId: user.id,
        provider: "authbridge",
        providerInquiryId: session.inquiryId,
        providerStatus: session.status,
        adminStatus: "PENDING",
      },
    });

    emitAdminVerificationsUpdate({ userId: user.id });

    return {
      enabled: true,
      inquiryId: session.inquiryId,
      redirectionUrl: session.redirectionUrl,
    };
  }

  // --- SpringVerify Background Check (BGV) ---

  public async initiateSpringVerifyBgv(userId: number): Promise<BgvCheckSession> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new Error("Active user account not found.");
    }

    const session = await this.springVerify.initiateBgvCheck(user);

    await db.personaVerification.create({
      data: {
        userId: user.id,
        provider: "springverify",
        providerInquiryId: session.checkId,
        providerStatus: session.status,
        adminStatus: "PENDING",
      },
    });

    emitAdminNotification({
      title: "SpringVerify BGV Initiated",
      description: `Background check (${session.checkId}) initiated for ${user.firstName} ${user.lastName}.`,
      href: "/admin/verifications",
      type: "VERIFICATION_SUBMITTED",
    });

    emitAdminVerificationsUpdate({ userId: user.id });

    return session;
  }

  // --- Status & Reviews ---

  public async getVerificationStatus(userId: number): Promise<VerificationStatusResponse> {
    const latest = await db.personaVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        provider: true,
        providerStatus: true,
        providerInquiryId: true,
        adminStatus: true,
      },
    });

    return {
      enabled:
        this.persona.isConfigured() ||
        this.authBridge.getConfig().enabled ||
        this.springVerify.getConfig().enabled,
      provider: latest?.provider ?? "persona",
      providerStatus: latest?.providerStatus,
      inquiryId: latest?.providerInquiryId,
      adminStatus: latest?.adminStatus,
    };
  }

  public async getAllVerificationsForUser(userId: number) {
    return db.personaVerification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- Universal Webhook Processor ---

  public async processWebhook(
    rawBody: string,
    signatureHeader: string | null,
    provider: "persona" | "authbridge" | "springverify" = "persona",
  ): Promise<WebhookProcessResult> {
    let payload = null;

    if (provider === "persona") {
      if (!this.persona.verifyWebhookSignature(rawBody, signatureHeader)) {
        return { ok: false, status: 401, error: "Invalid Persona webhook signature." };
      }
      payload = this.persona.parseWebhookPayload(rawBody);
    } else if (provider === "authbridge") {
      if (!this.authBridge.verifyWebhookSignature(rawBody, signatureHeader)) {
        return { ok: false, status: 401, error: "Invalid AuthBridge webhook signature." };
      }
      payload = this.authBridge.parseWebhookPayload(rawBody);
    } else if (provider === "springverify") {
      if (!this.springVerify.verifyWebhookSignature(rawBody, signatureHeader)) {
        return { ok: false, status: 401, error: "Invalid SpringVerify webhook signature." };
      }
      payload = this.springVerify.parseWebhookPayload(rawBody);
    }

    if (!payload) {
      return { ok: false, status: 400, error: `Malformed ${provider} webhook payload.` };
    }

    const { eventId, eventName, createdAt: eventCreatedAt, inquiryId, status } = payload;

    try {
      const result = await db.$transaction(async (tx) => {
        // 1. Deduplicate by recording the event atomically
        try {
          await tx.personaWebhookEvent.create({
            data: {
              provider,
              providerEventId: eventId,
              eventName,
            },
          });
        } catch (error) {
          if ((error as { code?: string }).code === "P2002") {
            return { duplicate: true };
          }
          throw error;
        }

        // 2. Locate the verification record
        const existing = await tx.personaVerification.findUnique({
          where: { providerInquiryId: inquiryId },
        });

        if (!existing) {
          return { ignored: true };
        }

        // 3. Prevent out-of-order event replay from overwriting newer updates
        if (
          eventCreatedAt &&
          existing.lastProviderEventAt &&
          eventCreatedAt <= existing.lastProviderEventAt
        ) {
          return { stale: true };
        }

        // 4. Update verification status
        const isPending = status === "pending";
        await tx.personaVerification.update({
          where: { id: existing.id },
          data: {
            providerStatus: status,
            lastProviderEventAt: eventCreatedAt ?? existing.lastProviderEventAt,
            submittedAt:
              isPending && !existing.submittedAt
                ? (eventCreatedAt ?? new Date())
                : existing.submittedAt,
          },
        });

        return { success: true, userId: existing.userId, status };
      });

      if ("duplicate" in result && result.duplicate) {
        return { ok: true, status: 200, duplicate: true };
      }
      if ("ignored" in result && result.ignored) {
        return { ok: true, status: 200, ignored: true };
      }
      if ("stale" in result && result.stale) {
        return { ok: true, status: 200, stale: true };
      }

      // 5. Emit real-time notification to operators when an inquiry reaches a reviewable status
      if (
        result.status === "completed" ||
        result.status === "approved" ||
        result.status === "clear"
      ) {
        emitAdminNotification({
          title: `${provider.toUpperCase()} Verification Ready`,
          description: `Identity inquiry (${inquiryId}) is ready for review with status: ${result.status}.`,
          href: "/admin/verifications",
          type: "VERIFICATION_SUBMITTED",
        });
        emitAdminVerificationsUpdate({ userId: result.userId });
      }

      return { ok: true, status: 200 };
    } catch (error) {
      console.error(`verification.service.webhook.${provider}.failed`, {
        eventId,
        inquiryId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { ok: false, status: 500, error: "Failed to persist webhook transaction." };
    }
  }

  public async reviewPersonaVerification(params: {
    providerInquiryId: string;
    adminId: number;
    status: "APPROVED" | "REJECTED";
  }) {
    const { providerInquiryId, adminId, status } = params;

    const existing = await db.personaVerification.findUnique({
      where: { providerInquiryId },
      include: { user: { select: { id: true, firstName: true } } },
    });

    if (!existing) {
      throw new Error("Verification record not found.");
    }

    const isApproved = status === "APPROVED";

    const [updatedVerification] = await db.$transaction([
      db.personaVerification.update({
        where: { providerInquiryId },
        data: {
          adminStatus: status,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
      db.user.update({
        where: { id: existing.userId },
        data: {
          isVerified: isApproved,
        },
      }),
      db.auditLog.create({
        data: {
          actorId: adminId,
          action: "IDENTITY_VERIFICATION_REVIEW",
          entityType: "PersonaVerification",
          entityId: providerInquiryId,
          metadata: {
            provider: existing.provider,
            adminStatus: status,
            userId: existing.userId,
            providerStatus: existing.providerStatus,
          },
        },
      }),
    ]);

    // Update ProfessionalVerification status if it exists
    await db.professionalVerification
      .update({
        where: { userId: existing.userId },
        data: { status: isApproved ? "APPROVED" : "REJECTED" },
      })
      .catch(() => null);

    // Notify user in real time
    emitRealtimeNotification([existing.userId], {
      title: isApproved ? "Identity Verification Approved" : "Identity Verification Rejected",
      description: isApproved
        ? `Your ${existing.provider} verification has been approved. Your profile now shows the verified badge.`
        : `Your ${existing.provider} verification was reviewed and not approved.`,
      href: "/verification",
      type: "VERIFICATION_UPDATE",
    });

    emitAdminVerificationsUpdate({ userId: existing.userId, status });

    return updatedVerification;
  }
}

export const verificationService = new VerificationService();
