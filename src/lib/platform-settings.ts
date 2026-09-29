import { db } from "@/lib/db";

export type PlatformSettingItem = {
  key: string;
  value: string;
  description: string;
  category: "FINANCE" | "DISPUTES" | "GENERAL" | "SECURITY";
};

export const DEFAULT_PLATFORM_SETTINGS: Record<
  string,
  { value: string; description: string; category: "FINANCE" | "DISPUTES" | "GENERAL" | "SECURITY" }
> = {
  commission_rate: {
    value: "20",
    description:
      "Platform commission percentage charged to professionals on milestone payouts (e.g. 20%)",
    category: "FINANCE",
  },
  max_dispute_rounds: {
    value: "5",
    description:
      "Maximum number of dispute appeal rounds allowed per project contract (e.g. 5 rounds)",
    category: "DISPUTES",
  },
  dispute_limit: {
    value: "5",
    description:
      "Maximum number of disputes a client or pro can raise per project (e.g. 5 disputes)",
    category: "DISPUTES",
  },
  min_withdrawal_amount: {
    value: "500",
    description: "Minimum withdrawal amount in INR for professionals to cash out to bank",
    category: "FINANCE",
  },
  auto_resolve_days: {
    value: "7",
    description: "Days of inactivity before an unresolved dispute can be auto-escalated or settled",
    category: "DISPUTES",
  },
  autopay_enabled: {
    value: "true",
    description:
      "When ON, client milestone approvals automatically release net earnings to professional wallet after deducting admin commission. When OFF, payments remain held in admin review.",
    category: "FINANCE",
  },
};

export async function getPlatformSetting(key: string, fallback?: string): Promise<string> {
  try {
    const record = await db.platformSetting.findUnique({ where: { key } });
    if (record) return record.value;
  } catch (error) {
    console.error("platform-settings.get.failed", { key, error });
  }
  return fallback ?? DEFAULT_PLATFORM_SETTINGS[key]?.value ?? "";
}

export async function getPlatformCommissionRate(): Promise<number> {
  try {
    const raw = await getPlatformSetting("commission_rate", "10");
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed < 0) return 0.1;
    return parsed > 1 ? parsed / 100 : parsed;
  } catch {
    return 0.1;
  }
}

export async function getMinWithdrawalAmount(): Promise<number> {
  try {
    const raw = await getPlatformSetting("min_withdrawal_amount", "500");
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed <= 0 ? 500 : parsed;
  } catch {
    return 500;
  }
}

export async function isAutopayEnabled(): Promise<boolean> {
  try {
    const raw = await getPlatformSetting("autopay_enabled", "true");
    return raw === "true" || raw === "1" || raw === "on";
  } catch {
    return true;
  }
}

export async function getPlatformSettings(): Promise<PlatformSettingItem[]> {
  try {
    const records = await db.platformSetting.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });

    const existingKeys = new Set(records.map((r) => r.key));
    const items: PlatformSettingItem[] = records.map((r) => ({
      key: r.key,
      value: r.value,
      description: r.description ?? "",
      category: (r.category as PlatformSettingItem["category"]) || "GENERAL",
    }));

    // Ensure defaults exist in list even if not yet queried
    for (const [key, meta] of Object.entries(DEFAULT_PLATFORM_SETTINGS)) {
      if (!existingKeys.has(key)) {
        items.push({
          key,
          value: meta.value,
          description: meta.description,
          category: meta.category,
        });
      }
    }

    return items;
  } catch (error) {
    console.error("platform-settings.getAll.failed", error);
    return Object.entries(DEFAULT_PLATFORM_SETTINGS).map(([key, meta]) => ({
      key,
      value: meta.value,
      description: meta.description,
      category: meta.category,
    }));
  }
}

export async function setPlatformSetting(
  key: string,
  value: string,
  description?: string,
  category?: string,
): Promise<void> {
  const meta = DEFAULT_PLATFORM_SETTINGS[key];
  await db.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      description: description ?? meta?.description ?? "",
      category: category ?? meta?.category ?? "GENERAL",
    },
    update: {
      value,
      ...(description ? { description } : {}),
      ...(category ? { category } : {}),
      updatedAt: new Date(),
    },
  });
}
