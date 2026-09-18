import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString, max: 2 });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const catalog = [
  [
    "RESIDENTIAL",
    [
      [
        "Home Cleaning & Housekeeping",
        [
          "Regular home cleaning",
          "Deep cleaning",
          "Kitchen cleaning",
          "Bathroom cleaning",
          "Sofa cleaning",
          "Carpet cleaning",
          "Mattress cleaning",
          "Water-tank cleaning",
          "Move-in/move-out cleaning",
        ],
      ],
      [
        "Electrical Services",
        [
          "Electrician",
          "Wiring",
          "Switch/socket",
          "Fan installation/repair",
          "Light installation",
          "MCB/DB work",
          "Inverter installation",
          "Generator",
          "Solar electrical work",
          "Home automation",
        ],
      ],
      [
        "Plumbing",
        [
          "Leak repair",
          "Tap/faucet",
          "Toilet",
          "Bathroom plumbing",
          "Kitchen plumbing",
          "Drain blockage",
          "Water tank",
          "Pump installation",
          "Pipeline installation",
          "Water heater/geyser",
        ],
      ],
      [
        "AC & HVAC",
        [
          "AC installation",
          "AC repair",
          "AC servicing",
          "Gas charging",
          "Split AC",
          "Window AC",
          "Duct AC",
          "VRF/VRV",
          "Cooler repair",
          "Ventilation",
        ],
      ],
      [
        "Carpentry",
        [
          "Furniture repair",
          "Custom furniture",
          "Modular furniture",
          "Kitchen cabinets",
          "Wardrobe",
          "Door/window repair",
          "Bed/table/chair repair",
          "Woodwork",
        ],
      ],
      [
        "Painting & Wall Services",
        [
          "Interior painting",
          "Exterior painting",
          "Texture painting",
          "Waterproofing",
          "Wallpaper",
          "POP",
          "Gypsum work",
          "False ceiling",
        ],
      ],
      [
        "Home Renovation & Construction",
        [
          "Kitchen renovation",
          "Bathroom renovation",
          "Room renovation",
          "Flooring",
          "Tiling",
          "Civil work",
          "Mason",
          "Brickwork",
          "Plastering",
          "Demolition",
        ],
      ],
      [
        "Appliance Repair",
        [
          "Refrigerator",
          "Washing machine",
          "Dishwasher",
          "Microwave",
          "Oven",
          "TV",
          "Geyser",
          "Water purifier/RO",
          "Chimney",
          "Gas stove",
        ],
      ],
      [
        "Water Purifier & RO",
        [
          "RO installation",
          "RO servicing",
          "Filter replacement",
          "UV purifier",
          "Water-softener service",
        ],
      ],
      [
        "Pest Control",
        ["Cockroach", "Mosquito", "Termite", "Rodent", "Bed bugs", "Ants", "General pest control"],
      ],
      [
        "Packers & Movers",
        [
          "Home shifting",
          "Local moving",
          "Intercity moving",
          "Packing",
          "Loading/unloading",
          "Furniture transportation",
          "Vehicle transportation",
          "Storage",
        ],
      ],
      [
        "Gardening & Landscaping",
        [
          "Gardener",
          "Lawn maintenance",
          "Tree trimming",
          "Plant maintenance",
          "Landscaping",
          "Irrigation",
          "Terrace garden",
        ],
      ],
      [
        "Security & Smart Home",
        ["CCTV", "Video doorbell", "Smart lock", "Alarm", "Access control", "Intercom"],
      ],
      [
        "Cleaning & Maintenance",
        [
          "Solar panel cleaning",
          "Chimney cleaning",
          "Duct cleaning",
          "Pressure washing",
          "Drain cleaning",
        ],
      ],
      [
        "General Handyman",
        [
          "Furniture assembly",
          "TV mounting",
          "Curtain installation",
          "Drilling",
          "Shelf installation",
          "Minor repairs",
        ],
      ],
      [
        "Security & Guards",
        ["Security guard", "Night guard", "Residential security", "Event security"],
      ],
    ],
  ],
  [
    "COMMERCIAL",
    [
      [
        "Building & Facility Services",
        [
          "Commercial cleaning",
          "Housekeeping staff",
          "Facility management",
          "Building maintenance",
          "Electrical maintenance",
          "Plumbing maintenance",
          "HVAC maintenance",
          "Lift/elevator maintenance",
          "Fire safety",
        ],
      ],
      [
        "Construction & Renovation",
        [
          "Commercial renovation",
          "Civil contractor",
          "Interior contractor",
          "Glass/aluminium",
          "Fabrication",
          "Waterproofing",
        ],
      ],
      [
        "Electrical & HVAC",
        [
          "Commercial electrician",
          "Electrical panel",
          "DG/generator",
          "UPS",
          "Solar",
          "HVAC",
          "VRF/VRV",
          "Chiller",
          "Cooling tower",
          "Ventilation",
        ],
      ],
      [
        "IT & Technology",
        [
          "Computer repair",
          "IT support",
          "Networking",
          "Wi-Fi",
          "Server installation",
          "CCTV",
          "Access control",
          "Biometric attendance",
          "Structured cabling",
          "Fiber optic",
        ],
      ],
      [
        "Business Support",
        [
          "Office shifting",
          "Packers & movers",
          "Security guards",
          "Receptionist",
          "Office boy",
          "Temporary labour",
          "Data entry",
          "Event staff",
        ],
      ],
      [
        "Restaurant & Hospitality",
        [
          "Kitchen equipment",
          "Commercial refrigeration",
          "Exhaust/hood",
          "Gas pipeline",
          "Restaurant cleaning",
          "Pest control",
          "Laundry",
          "Hotel maintenance",
        ],
      ],
    ],
  ],
  [
    "INDUSTRIAL",
    [
      [
        "Electrical & Automation",
        [
          "Industrial electrician",
          "Electrical panel",
          "MCC/PCC",
          "PLC programming",
          "HMI",
          "SCADA",
          "VFD",
          "Servo systems",
          "Industrial automation",
          "Control systems",
          "Instrumentation",
        ],
      ],
      [
        "Mechanical",
        [
          "Mechanical maintenance",
          "Machine installation",
          "Machine repair",
          "Preventive maintenance",
          "Breakdown maintenance",
          "Millwright",
          "Machinery alignment",
          "Pumps",
          "Gearboxes",
          "Compressors",
        ],
      ],
      [
        "Welding & Fabrication",
        [
          "MIG welding",
          "TIG welding",
          "ARC welding",
          "Stainless-steel fabrication",
          "Structural fabrication",
          "Pipe fabrication",
          "Sheet-metal fabrication",
          "CNC cutting",
          "Laser cutting",
        ],
      ],
      [
        "Civil & Infrastructure",
        [
          "Industrial civil work",
          "RCC",
          "Flooring",
          "Industrial flooring",
          "Structural steel",
          "Roofing",
          "Waterproofing",
          "Factory renovation",
        ],
      ],
      [
        "Process & Instrumentation",
        [
          "Process piping",
          "Calibration",
          "Sensors",
          "Flow meters",
          "Pressure instruments",
          "Temperature instruments",
          "Control valves",
          "Pneumatics",
          "Hydraulics",
        ],
      ],
      [
        "Robotics & Automation",
        [
          "Robot programming",
          "Robot installation",
          "Robot maintenance",
          "Vision systems",
          "Conveyor automation",
          "Pick-and-place",
          "Production automation",
        ],
      ],
      [
        "Plant & Facility Maintenance",
        [
          "Factory maintenance",
          "Shutdown maintenance",
          "Utility maintenance",
          "Boiler",
          "Chiller",
          "Cooling tower",
          "Compressed air",
          "DG",
          "ETP/STP",
          "Water treatment",
        ],
      ],
      [
        "Skilled Labour",
        [
          "Electrician",
          "Fitter",
          "Welder",
          "Technician",
          "Mechanical technician",
          "Instrument technician",
          "CNC operator",
          "Machine operator",
          "General labour",
          "Maintenance technician",
        ],
      ],
      [
        "Safety & Compliance",
        [
          "Industrial safety",
          "Fire safety",
          "Safety audit",
          "PPE",
          "Safety training",
          "Equipment inspection",
          "Electrical inspection",
        ],
      ],
      [
        "Engineering & Professional",
        [
          "Electrical engineering",
          "Mechanical engineering",
          "Civil engineering",
          "Automation engineering",
          "CAD design",
          "3D modelling",
          "Project management",
          "Quality inspection",
          "Technical consulting",
        ],
      ],
    ],
  ],
] as const;

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const legacyCategoryMap: Record<string, string> = {
  "Home Services": "Home Cleaning & Housekeeping",
  Development: "IT & Technology",
  "Web Development": "IT & Technology",
  web: "IT & Technology",
  Design: "Engineering & Professional",
  Marketing: "Business Support",
  Photography: "Business Support",
  Tutoring: "Business Support",
};

async function main() {
  const before = {
    jobs: await db.clientJob.count(),
    hireJobs: await db.hireJob.count(),
    categories: await db.serviceCategory.count(),
    payments: await db.payment.count(),
    earnings: await db.projectTransaction.count(),
  };
  console.log("Before:", before);

  await db.$transaction(
    async (tx) => {
      // Keep financial records, but remove nonfinancial project workflow rows.
      await tx.payment.updateMany({ data: { milestoneId: null } });
      await tx.projectTimelineEvent.deleteMany();
      await tx.projectWorkUpload.deleteMany();
      await tx.projectCompletionRequest.deleteMany();
      await tx.projectRevisionRequest.deleteMany();
      await tx.projectReviewRequest.deleteMany();
      await tx.projectDisputeMessage.deleteMany();
      await tx.projectDispute.deleteMany();
      await tx.projectReview.deleteMany();
      await tx.projectNegotiation.deleteMany();
      await tx.projectRequest.deleteMany();
      await tx.projectMilestone.deleteMany();
      await tx.projectTracking.deleteMany();

      await tx.favoriteJob.deleteMany();
      await tx.clientJobAttachment.deleteMany();
      await tx.clientJob.deleteMany();

      await tx.hireMilestone.deleteMany();
      await tx.hireAttachment.deleteMany();
      await tx.hireContract.deleteMany();
      await tx.directHireNegotiation.deleteMany();
      await tx.hireJob.deleteMany();

      await tx.service.deleteMany();
      await tx.serviceCategory.deleteMany();

      const usedNames = new Set<string>();
      const usedSlugs = new Set<string>();
      for (const [segment, groups] of catalog) {
        const segmentSlug = slug(segment);
        const root = await tx.serviceCategory.create({
          data: {
            name: segment,
            slug: segmentSlug,
            segment: segment.toUpperCase(),
            sortOrder: catalog.findIndex(([name]) => name === segment),
          },
        });
        usedNames.add(segment);
        usedSlugs.add(segmentSlug);

        for (const [category, subCategories] of groups) {
          const categorySlug = slug(category);
          if (usedNames.has(category) || usedSlugs.has(categorySlug)) continue;
          const parent = await tx.serviceCategory.create({
            data: {
              name: category,
              slug: categorySlug,
              segment: segment.toUpperCase(),
              parentId: root.id,
            },
          });
          usedNames.add(category);
          usedSlugs.add(categorySlug);

          for (const subCategory of subCategories) {
            const subCategorySlug = slug(subCategory);
            if (usedNames.has(subCategory) || usedSlugs.has(subCategorySlug)) continue;
            await tx.serviceCategory.create({
              data: {
                name: subCategory,
                slug: subCategorySlug,
                segment: segment.toUpperCase(),
                parentId: parent.id,
              },
            });
            usedNames.add(subCategory);
            usedSlugs.add(subCategorySlug);
          }
        }
      }

      for (const [legacyCategory, newCategory] of Object.entries(legacyCategoryMap)) {
        const category = await tx.serviceCategory.findUnique({
          where: { name: newCategory },
          select: { id: true, name: true },
        });
        if (!category) continue;
        await tx.user.updateMany({
          where: { role: "PROFESSIONAL", professionalCategory: legacyCategory },
          data: { professionalCategory: category.name, professionalCategoryId: category.id },
        });
      }
    },
    { timeout: 120_000 },
  );

  const after = {
    jobs: await db.clientJob.count(),
    hireJobs: await db.hireJob.count(),
    categories: await db.serviceCategory.count(),
    payments: await db.payment.count(),
    earnings: await db.projectTransaction.count(),
  };
  console.log("After:", after);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
