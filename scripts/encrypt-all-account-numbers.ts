import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { encryptAccountNumber } from "../src/lib/encryption";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("Starting encryption of all bank account numbers across database...");

  // 1. UserLinkedAccount
  const linkedAccounts = await db.userLinkedAccount.findMany({
    where: {
      accountNumber: {
        not: null,
      },
    },
  });

  let encryptedAccountsCount = 0;
  for (const acc of linkedAccounts) {
    if (acc.accountNumber && !acc.accountNumber.startsWith("enc:v1:")) {
      const enc = encryptAccountNumber(acc.accountNumber);
      await db.userLinkedAccount.update({
        where: { id: acc.id },
        data: {
          accountNumber: enc.encrypted,
          last4: enc.last4,
        },
      });
      encryptedAccountsCount++;
      console.log(`Encrypted UserLinkedAccount #${acc.id} (last4: ${enc.last4})`);
    }
  }
  console.log(`Processed ${linkedAccounts.length} linked accounts (${encryptedAccountsCount} encrypted).`);

  // 2. ProjectWithdrawal destinationLabel
  const withdrawals = await db.projectWithdrawal.findMany();
  let encryptedWithdrawalsCount = 0;

  for (const w of withdrawals) {
    if (!w.destinationLabel) continue;

    try {
      const parsed = JSON.parse(w.destinationLabel);
      if (parsed && typeof parsed === "object") {
        let changed = false;

        if (parsed.accountNumber && typeof parsed.accountNumber === "string" && !parsed.accountNumber.startsWith("enc:v1:")) {
          const enc = encryptAccountNumber(parsed.accountNumber);
          parsed.accountNumber = enc.encrypted;
          parsed.last4 = enc.last4;
          changed = true;
        }

        if (parsed.cardNumber && typeof parsed.cardNumber === "string" && !parsed.cardNumber.startsWith("enc:v1:")) {
          const enc = encryptAccountNumber(parsed.cardNumber);
          parsed.cardNumber = enc.encrypted;
          parsed.last4 = enc.last4;
          changed = true;
        }

        if (changed) {
          await db.projectWithdrawal.update({
            where: { id: w.id },
            data: {
              destinationLabel: JSON.stringify(parsed),
            },
          });
          encryptedWithdrawalsCount++;
          console.log(`Encrypted ProjectWithdrawal #${w.id} destinationLabel`);
        }
      }
    } catch {
      // If legacy plain text destination contains digits, leave or format
    }
  }
  console.log(`Processed ${withdrawals.length} withdrawals (${encryptedWithdrawalsCount} encrypted).`);

  // 3. WalletTransaction metadataJson
  const transactions = await db.walletTransaction.findMany();
  let encryptedTransactionsCount = 0;

  for (const tx of transactions) {
    if (!tx.metadataJson) continue;

    try {
      const parsed = JSON.parse(tx.metadataJson);
      let changed = false;

      if (parsed.destinationLabel) {
        try {
          const inner = JSON.parse(parsed.destinationLabel);
          if (inner && inner.accountNumber && typeof inner.accountNumber === "string" && !inner.accountNumber.startsWith("enc:v1:")) {
            const enc = encryptAccountNumber(inner.accountNumber);
            inner.accountNumber = enc.encrypted;
            inner.last4 = enc.last4;
            parsed.destinationLabel = JSON.stringify(inner);
            changed = true;
          }
        } catch {
          // not inner JSON
        }
      }

      if (parsed.accountNumber && typeof parsed.accountNumber === "string" && !parsed.accountNumber.startsWith("enc:v1:")) {
        const enc = encryptAccountNumber(parsed.accountNumber);
        parsed.accountNumber = enc.encrypted;
        parsed.last4 = enc.last4;
        changed = true;
      }

      if (changed) {
        await db.walletTransaction.update({
          where: { id: tx.id },
          data: {
            metadataJson: JSON.stringify(parsed),
          },
        });
        encryptedTransactionsCount++;
        console.log(`Encrypted WalletTransaction #${tx.id} metadataJson`);
      }
    } catch {
      // ignore
    }
  }
  console.log(`Processed ${transactions.length} wallet transactions (${encryptedTransactionsCount} encrypted).`);

  console.log("Database encryption completed successfully!");
}

main()
  .catch((e) => {
    console.error("Encryption error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
