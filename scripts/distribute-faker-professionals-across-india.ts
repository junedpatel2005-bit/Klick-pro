import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getIndiaDemoLocation, INDIA_DEMO_CITIES } from "./india-demo-locations";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  if (INDIA_DEMO_CITIES.length !== 105) {
    throw new Error(`Expected 105 cities, found ${INDIA_DEMO_CITIES.length}`);
  }

  const professionals = await db.user.findMany({
    where: { role: "PROFESSIONAL", email: { startsWith: "faker.pro." } },
    select: { id: true, professionalCategoryId: true },
    orderBy: { professionalCategoryId: "asc" },
  });

  for (let index = 0; index < professionals.length; index += 1) {
    // Surat already has the preserved Surat professional, so Faker accounts fill slots 2 and 3 there.
    const location = getIndiaDemoLocation(Math.floor((index + 1) / 3));
    await db.user.update({
      where: { id: professionals[index]!.id },
      data: {
        professionalCity: location.city,
        professionalState: location.state,
        professionalDistrict: location.city,
        professionalLatitude: location.lat,
        professionalLongitude: location.lng,
      },
    });
  }

  const counts = await db.user.groupBy({
    by: ["professionalCity"],
    where: { role: "PROFESSIONAL", professionalCity: { not: null } },
    _count: { _all: true },
  });
  const maxPerCity = Math.max(...counts.map((item) => item._count._all));
  console.info(
    JSON.stringify({ professionals: professionals.length, cities: counts.length, maxPerCity }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
