import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const clients = await db.user.findMany({
    where: { role: "CLIENT" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      companyName: true,
      address: true,
      createdAt: true,
    },
    orderBy: { id: "desc" },
  });

  console.log(`Found ${clients.length} client accounts in database.`);

  let mdContent = `# Klick-Pro Seeded Client Accounts & Credentials\n\n`;
  mdContent += `Total Client Accounts: **${clients.length}**\n\n`;
  mdContent += `> **Standard Default Passwords**:\n`;
  mdContent += `> - Newly Faker-generated clients: \`ClientPass#2026\`\n`;
  mdContent += `> - Seed fixture client (\`seed.client@servio.example\`): \`ServioSeed#2026\`\n\n`;
  mdContent += `| # | User ID | Name | Email / Gmail | Password | Phone | Company | City / Address |\n`;
  mdContent += `| :---: | :---: | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  const jsonList: Array<{
    id: number;
    name: string;
    email: string;
    password: string;
    phone: string | null;
    company: string | null;
    address: string | null;
  }> = [];

  clients.forEach((client, index) => {
    const password =
      client.email === "seed.client@servio.example" ? "ServioSeed#2026" : "ClientPass#2026";
    const name = `${client.firstName} ${client.lastName}`.trim();
    const company = client.companyName ?? "Personal Account";
    const address = client.address ?? "India";

    mdContent += `| ${index + 1} | \`#${client.id}\` | **${name}** | \`${client.email}\` | \`${password}\` | \`${client.phone ?? "N/A"}\` | ${company} | ${address} |\n`;

    jsonList.push({
      id: client.id,
      name,
      email: client.email,
      password,
      phone: client.phone,
      company: client.companyName,
      address: client.address,
    });
  });

  const mdPath = path.resolve(process.cwd(), "CLIENT_CREDENTIALS.md");
  const jsonPath = path.resolve(process.cwd(), "clients-credentials.json");

  fs.writeFileSync(mdPath, mdContent, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(jsonList, null, 2), "utf8");

  console.log(`Exported credentials to:`);
  console.log(`- ${mdPath}`);
  console.log(`- ${jsonPath}`);
}

main()
  .catch((err) => {
    console.error("Export error:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
