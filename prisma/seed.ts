import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const SEED_PASSWORD = "ServioSeed#2026";
const SEED_CLIENT_EMAIL = "seed.client@servio.example";
const SEED_ADMIN_EMAIL = "seed.admin@servio.example";
const SEED_PROFESSIONAL_EMAIL = "surat.pro@servio.example";
const SEED_DOMAIN = "seed.servio.example";
const categories = [
  "Development",
  "Design",
  "Home Services",
  "Photography",
  "Marketing",
  "Tutoring",
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed the database.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const INDIAN_CITIES: { city: string; lat: number; lng: number }[] = [
  { city: "Mumbai", lat: 19.076, lng: 72.8777 },
  { city: "Delhi", lat: 28.7041, lng: 77.1025 },
  { city: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { city: "Surat", lat: 21.1702, lng: 72.8311 },
  { city: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { city: "Pune", lat: 18.5204, lng: 73.8567 },
  { city: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { city: "Chennai", lat: 13.0827, lng: 80.2707 },
  { city: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { city: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { city: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { city: "Chandigarh", lat: 30.7333, lng: 76.7794 },
];

/** Jitters a city center by up to ~5km so professionals in the same city don't stack exactly. */
function jitterNearCity(city: { lat: number; lng: number }) {
  const jitterDegrees = 0.045;
  return {
    lat: city.lat + (Math.random() - 0.5) * jitterDegrees,
    lng: city.lng + (Math.random() - 0.5) * jitterDegrees,
  };
}

const CATEGORY_INDUSTRY: Record<string, string> = {
  Development: "Information Technology",
  Design: "Creative Services",
  "Home Services": "Home & Facility Maintenance",
  Photography: "Media & Entertainment",
  Marketing: "Marketing & Advertising",
  Tutoring: "Education & Training",
};

const HIERARCHY = [
  {
    name: "Residential Services",
    slug: "residential",
    segment: "RESIDENTIAL",
    description: "Home improvement, cleaning, repairs, and residential maintenance services.",
    iconName: "Home",
    categories: [
      {
        name: "Home Cleaning & Housekeeping",
        slug: "home-cleaning-housekeeping",
        iconName: "Sparkles",
        subcategories: [
          { name: "Regular home cleaning", slug: "regular-home-cleaning" },
          { name: "Deep cleaning", slug: "deep-cleaning" },
          { name: "Kitchen cleaning", slug: "kitchen-cleaning" },
          { name: "Bathroom cleaning", slug: "bathroom-cleaning" },
          { name: "Sofa cleaning", slug: "sofa-cleaning" },
          { name: "Carpet cleaning", slug: "carpet-cleaning" },
          { name: "Mattress cleaning", slug: "mattress-cleaning" },
          { name: "Water-tank cleaning (Residential)", slug: "residential-water-tank-cleaning" },
          { name: "Move-in/move-out cleaning", slug: "move-in-move-out-cleaning" },
        ],
      },
      {
        name: "Electrical Services",
        slug: "residential-electrical-services",
        iconName: "Zap",
        subcategories: [
          { name: "Electrician", slug: "electrician" },
          { name: "Wiring", slug: "residential-wiring" },
          { name: "Switch/socket", slug: "switch-socket-repair" },
          { name: "Fan installation/repair", slug: "fan-installation-repair" },
          { name: "Light installation", slug: "light-installation" },
          { name: "MCB/DB work", slug: "mcb-db-work" },
          { name: "Inverter installation", slug: "inverter-installation" },
          { name: "Generator installation", slug: "residential-generator" },
          { name: "Solar electrical work", slug: "residential-solar-electrical" },
          { name: "Home automation", slug: "residential-home-automation" },
        ],
      },
      {
        name: "Plumbing",
        slug: "residential-plumbing",
        iconName: "Wrench",
        subcategories: [
          { name: "Leak repair", slug: "plumbing-leak-repair" },
          { name: "Tap/faucet", slug: "tap-faucet-repair" },
          { name: "Toilet", slug: "toilet-plumbing" },
          { name: "Bathroom plumbing", slug: "bathroom-plumbing" },
          { name: "Kitchen plumbing", slug: "kitchen-plumbing" },
          { name: "Drain blockage", slug: "drain-blockage-removal" },
          { name: "Water tank plumbing", slug: "water-tank-plumbing" },
          { name: "Pump installation", slug: "pump-installation" },
          { name: "Pipeline installation", slug: "pipeline-installation" },
          { name: "Water heater/geyser plumbing", slug: "water-heater-geyser-plumbing" },
        ],
      },
      {
        name: "AC & HVAC",
        slug: "residential-ac-hvac",
        iconName: "Airplay",
        subcategories: [
          { name: "AC installation", slug: "ac-installation" },
          { name: "AC repair", slug: "ac-repair" },
          { name: "AC servicing", slug: "ac-servicing" },
          { name: "Gas charging", slug: "ac-gas-charging" },
          { name: "Split AC", slug: "split-ac-service" },
          { name: "Window AC", slug: "window-ac-service" },
          { name: "Duct AC", slug: "duct-ac-service" },
          { name: "VRF/VRV", slug: "residential-vrf-vrv" },
          { name: "Cooler repair", slug: "cooler-repair" },
          { name: "Ventilation", slug: "residential-ventilation" },
        ],
      },
      {
        name: "Carpentry",
        slug: "residential-carpentry",
        iconName: "Hammer",
        subcategories: [
          { name: "Furniture repair", slug: "furniture-repair" },
          { name: "Custom furniture", slug: "custom-furniture" },
          { name: "Modular furniture", slug: "modular-furniture" },
          { name: "Kitchen cabinets", slug: "kitchen-cabinets" },
          { name: "Wardrobe", slug: "wardrobe-carpentry" },
          { name: "Door/window repair", slug: "door-window-repair" },
          { name: "Bed/table/chair repair", slug: "bed-table-chair-repair" },
          { name: "Woodwork", slug: "general-woodwork" },
        ],
      },
      {
        name: "Painting & Wall Services",
        slug: "painting-wall-services",
        iconName: "Paintbrush",
        subcategories: [
          { name: "Interior painting", slug: "interior-painting" },
          { name: "Exterior painting", slug: "exterior-painting" },
          { name: "Texture painting", slug: "texture-painting" },
          { name: "Waterproofing (Residential)", slug: "residential-waterproofing" },
          { name: "Wallpaper", slug: "wallpaper-installation" },
          { name: "POP", slug: "pop-work" },
          { name: "Gypsum work", slug: "gypsum-work" },
          { name: "False ceiling (Residential)", slug: "residential-false-ceiling" },
        ],
      },
      {
        name: "Home Renovation & Construction",
        slug: "home-renovation-construction",
        iconName: "Home",
        subcategories: [
          { name: "Kitchen renovation", slug: "kitchen-renovation" },
          { name: "Bathroom renovation", slug: "bathroom-renovation" },
          { name: "Room renovation", slug: "room-renovation" },
          { name: "Flooring (Residential)", slug: "residential-flooring" },
          { name: "Tiling", slug: "tiling-work" },
          { name: "Civil work (Residential)", slug: "residential-civil-work" },
          { name: "Mason", slug: "mason-work" },
          { name: "Brickwork", slug: "brickwork" },
          { name: "Plastering", slug: "plastering-work" },
          { name: "Demolition (Residential)", slug: "residential-demolition" },
        ],
      },
      {
        name: "Appliance Repair",
        slug: "residential-appliance-repair",
        iconName: "Tv",
        subcategories: [
          { name: "Refrigerator repair", slug: "refrigerator-repair" },
          { name: "Washing machine repair", slug: "washing-machine-repair" },
          { name: "Dishwasher repair", slug: "dishwasher-repair" },
          { name: "Microwave repair", slug: "microwave-repair" },
          { name: "Oven repair", slug: "oven-repair" },
          { name: "TV repair", slug: "tv-repair" },
          { name: "Geyser repair", slug: "geyser-repair" },
          { name: "Water purifier/RO repair", slug: "water-purifier-repair" },
          { name: "Chimney repair", slug: "chimney-repair" },
          { name: "Gas stove repair", slug: "gas-stove-repair" },
        ],
      },
      {
        name: "Water Purifier & RO",
        slug: "water-purifier-ro",
        iconName: "Droplets",
        subcategories: [
          { name: "RO installation", slug: "ro-installation" },
          { name: "RO servicing", slug: "ro-servicing" },
          { name: "Filter replacement", slug: "filter-replacement" },
          { name: "UV purifier", slug: "uv-purifier-service" },
          { name: "Water-softener service", slug: "water-softener-service" },
        ],
      },
      {
        name: "Pest Control",
        slug: "residential-pest-control",
        iconName: "Bug",
        subcategories: [
          { name: "Cockroach control", slug: "cockroach-control" },
          { name: "Mosquito control", slug: "mosquito-control" },
          { name: "Termite control", slug: "termite-control" },
          { name: "Rodent control", slug: "rodent-control" },
          { name: "Bed bugs control", slug: "bed-bugs-control" },
          { name: "Ants control", slug: "ants-control" },
          { name: "General pest control", slug: "general-pest-control" },
        ],
      },
      {
        name: "Packers & Movers",
        slug: "residential-packers-movers",
        iconName: "Truck",
        subcategories: [
          { name: "Home shifting", slug: "home-shifting" },
          { name: "Local moving", slug: "local-moving" },
          { name: "Intercity moving", slug: "intercity-moving" },
          { name: "Packing services", slug: "packing-services" },
          { name: "Loading/unloading", slug: "loading-unloading" },
          { name: "Furniture transportation", slug: "furniture-transportation" },
          { name: "Vehicle transportation", slug: "vehicle-transportation" },
          { name: "Storage (Residential)", slug: "residential-storage" },
        ],
      },
      {
        name: "Gardening & Landscaping",
        slug: "gardening-landscaping",
        iconName: "Trees",
        subcategories: [
          { name: "Gardener", slug: "gardener" },
          { name: "Lawn maintenance", slug: "lawn-maintenance" },
          { name: "Tree trimming", slug: "tree-trimming" },
          { name: "Plant maintenance", slug: "plant-maintenance" },
          { name: "Landscaping", slug: "residential-landscaping" },
          { name: "Irrigation", slug: "residential-irrigation" },
          { name: "Terrace garden", slug: "terrace-garden" },
        ],
      },
      {
        name: "Security & Smart Home",
        slug: "residential-security-smart-home",
        iconName: "ShieldCheck",
        subcategories: [
          { name: "CCTV (Residential)", slug: "residential-cctv" },
          { name: "Video doorbell", slug: "video-doorbell" },
          { name: "Smart lock", slug: "smart-lock-installation" },
          { name: "Alarm", slug: "home-alarm-system" },
          { name: "Access control (Residential)", slug: "residential-access-control" },
          { name: "Intercom", slug: "home-intercom" },
          { name: "Smart home automation", slug: "smart-home-automation" },
        ],
      },
      {
        name: "Cleaning & Maintenance",
        slug: "residential-cleaning-maintenance",
        iconName: "Brush",
        subcategories: [
          { name: "Water tank (Cleaning)", slug: "water-tank-cleaning-maint" },
          { name: "Solar panel cleaning", slug: "solar-panel-cleaning" },
          { name: "Chimney cleaning", slug: "chimney-cleaning" },
          { name: "Duct cleaning", slug: "duct-cleaning" },
          { name: "Pressure washing", slug: "pressure-washing" },
          { name: "Drain cleaning", slug: "drain-cleaning" },
        ],
      },
      {
        name: "General Handyman",
        slug: "general-handyman",
        iconName: "Wrench",
        subcategories: [
          { name: "Furniture assembly", slug: "furniture-assembly" },
          { name: "TV mounting", slug: "tv-mounting" },
          { name: "Curtain installation", slug: "curtain-installation" },
          { name: "Drilling", slug: "drilling-services" },
          { name: "Shelf installation", slug: "shelf-installation" },
          { name: "Minor repairs", slug: "minor-handyman-repairs" },
        ],
      },
      {
        name: "Security & Guards",
        slug: "residential-security-guards",
        iconName: "Shield",
        subcategories: [
          { name: "Security guard", slug: "residential-security-guard" },
          { name: "Night guard", slug: "night-guard" },
          { name: "Residential security", slug: "residential-security" },
          { name: "Event security (Residential)", slug: "residential-event-security" },
        ],
      },
    ],
  },
  {
    name: "Commercial Services",
    slug: "commercial",
    segment: "COMMERCIAL",
    description:
      "Facility management, office renovations, IT networking, and business support services.",
    iconName: "Building2",
    categories: [
      {
        name: "Building & Facility Services",
        slug: "building-facility-services",
        iconName: "Building",
        subcategories: [
          { name: "Commercial cleaning", slug: "commercial-cleaning" },
          { name: "Housekeeping staff", slug: "housekeeping-staff-commercial" },
          { name: "Facility management", slug: "facility-management" },
          { name: "Building maintenance", slug: "building-maintenance" },
          { name: "Electrical maintenance", slug: "commercial-electrical-maintenance" },
          { name: "Plumbing maintenance", slug: "commercial-plumbing-maintenance" },
          { name: "HVAC maintenance", slug: "commercial-hvac-maintenance" },
          { name: "Lift/elevator maintenance", slug: "elevator-maintenance" },
          { name: "Fire safety", slug: "commercial-fire-safety" },
        ],
      },
      {
        name: "Construction & Renovation (Commercial)",
        slug: "commercial-construction-renovation",
        iconName: "HardHat",
        subcategories: [
          { name: "Commercial renovation", slug: "commercial-renovation" },
          { name: "Civil contractor", slug: "civil-contractor" },
          { name: "Interior contractor", slug: "interior-contractor" },
          { name: "False ceiling (Commercial)", slug: "commercial-false-ceiling" },
          { name: "Flooring (Commercial)", slug: "commercial-flooring" },
          { name: "Painting (Commercial)", slug: "commercial-painting" },
          { name: "Glass/aluminium", slug: "glass-aluminium-work" },
          { name: "Fabrication (Commercial)", slug: "commercial-fabrication" },
          { name: "Waterproofing (Commercial)", slug: "commercial-waterproofing" },
        ],
      },
      {
        name: "Electrical & HVAC (Commercial)",
        slug: "commercial-electrical-hvac",
        iconName: "Zap",
        subcategories: [
          { name: "Commercial electrician", slug: "commercial-electrician" },
          { name: "Electrical panel (Commercial)", slug: "commercial-electrical-panel" },
          { name: "DG/generator", slug: "commercial-dg-generator" },
          { name: "UPS", slug: "commercial-ups-systems" },
          { name: "Solar (Commercial)", slug: "commercial-solar" },
          { name: "HVAC (Commercial)", slug: "commercial-hvac" },
          { name: "VRF/VRV (Commercial)", slug: "commercial-vrf-vrv" },
          { name: "Chiller (Commercial)", slug: "commercial-chiller" },
          { name: "Cooling tower (Commercial)", slug: "commercial-cooling-tower" },
          { name: "Ventilation (Commercial)", slug: "commercial-ventilation" },
        ],
      },
      {
        name: "IT & Technology",
        slug: "commercial-it-technology",
        iconName: "Laptop",
        subcategories: [
          { name: "Computer repair", slug: "computer-repair" },
          { name: "IT support", slug: "it-support" },
          { name: "Networking", slug: "commercial-networking" },
          { name: "Wi-Fi", slug: "commercial-wifi" },
          { name: "Server installation", slug: "server-installation" },
          { name: "CCTV (Commercial)", slug: "commercial-cctv" },
          { name: "Access control (Commercial)", slug: "commercial-access-control" },
          { name: "Biometric attendance", slug: "biometric-attendance" },
          { name: "Structured cabling", slug: "structured-cabling" },
          { name: "Fiber optic", slug: "fiber-optic" },
        ],
      },
      {
        name: "Business Support",
        slug: "commercial-business-support",
        iconName: "Briefcase",
        subcategories: [
          { name: "Office shifting", slug: "office-shifting" },
          { name: "Packers & movers (Commercial)", slug: "commercial-packers-movers" },
          { name: "Security guards (Commercial)", slug: "commercial-security-guards" },
          { name: "Receptionist", slug: "receptionist-staff" },
          { name: "Office boy", slug: "office-boy-services" },
          { name: "Housekeeping staff (Office)", slug: "office-housekeeping-staff" },
          { name: "Temporary labour", slug: "temporary-labour-commercial" },
          { name: "Data entry", slug: "data-entry-services" },
          { name: "Event staff", slug: "event-staff-commercial" },
        ],
      },
      {
        name: "Restaurant & Hospitality",
        slug: "restaurant-hospitality",
        iconName: "Utensils",
        subcategories: [
          { name: "Kitchen equipment", slug: "commercial-kitchen-equipment" },
          { name: "Commercial refrigeration", slug: "commercial-refrigeration" },
          { name: "Exhaust/hood", slug: "exhaust-hood-services" },
          { name: "Gas pipeline", slug: "commercial-gas-pipeline" },
          { name: "Restaurant cleaning", slug: "restaurant-cleaning" },
          { name: "Pest control (Commercial)", slug: "commercial-pest-control" },
          { name: "Laundry (Commercial)", slug: "commercial-laundry" },
          { name: "Hotel maintenance", slug: "hotel-maintenance" },
        ],
      },
    ],
  },
  {
    name: "Industrial Services",
    slug: "industrial",
    segment: "INDUSTRIAL",
    description:
      "Plant maintenance, automation, robotics, fabrication, mechanical, and safety compliance.",
    iconName: "Factory",
    categories: [
      {
        name: "Electrical & Automation",
        slug: "industrial-electrical-automation",
        iconName: "Cpu",
        subcategories: [
          { name: "Industrial electrician", slug: "industrial-electrician" },
          { name: "Electrical panel (Industrial)", slug: "industrial-electrical-panel" },
          { name: "MCC/PCC", slug: "mcc-pcc-panels" },
          { name: "PLC programming", slug: "plc-programming" },
          { name: "HMI", slug: "hmi-programming" },
          { name: "SCADA", slug: "scada-systems" },
          { name: "VFD", slug: "vfd-drives" },
          { name: "Servo systems", slug: "servo-systems" },
          { name: "Industrial automation", slug: "industrial-automation" },
          { name: "Control systems", slug: "control-systems" },
          { name: "Instrumentation", slug: "industrial-instrumentation" },
        ],
      },
      {
        name: "Mechanical",
        slug: "industrial-mechanical",
        iconName: "Cog",
        subcategories: [
          { name: "Mechanical maintenance", slug: "mechanical-maintenance" },
          { name: "Machine installation", slug: "machine-installation" },
          { name: "Machine repair", slug: "machine-repair" },
          {
            name: "Preventive maintenance (Mechanical)",
            slug: "preventive-maintenance-mechanical",
          },
          { name: "Breakdown maintenance", slug: "breakdown-maintenance" },
          { name: "Millwright", slug: "millwright-services" },
          { name: "Machinery alignment", slug: "machinery-alignment" },
          { name: "Pumps (Industrial)", slug: "industrial-pumps" },
          { name: "Gearboxes", slug: "industrial-gearboxes" },
          { name: "Compressors", slug: "industrial-compressors" },
        ],
      },
      {
        name: "Welding & Fabrication",
        slug: "industrial-welding-fabrication",
        iconName: "Flame",
        subcategories: [
          { name: "MIG welding", slug: "mig-welding" },
          { name: "TIG welding", slug: "tig-welding" },
          { name: "ARC welding", slug: "arc-welding" },
          { name: "Stainless-steel fabrication", slug: "stainless-steel-fabrication" },
          { name: "Structural fabrication", slug: "structural-fabrication" },
          { name: "Pipe fabrication", slug: "pipe-fabrication" },
          { name: "Sheet-metal fabrication", slug: "sheet-metal-fabrication" },
          { name: "CNC cutting", slug: "cnc-cutting" },
          { name: "Laser cutting", slug: "laser-cutting" },
        ],
      },
      {
        name: "Civil & Infrastructure (Industrial)",
        slug: "industrial-civil-infrastructure",
        iconName: "Layers",
        subcategories: [
          { name: "Industrial civil work", slug: "industrial-civil-work" },
          { name: "RCC", slug: "industrial-rcc" },
          { name: "Flooring (Industrial)", slug: "industrial-flooring-work" },
          { name: "Industrial flooring", slug: "industrial-epoxy-flooring" },
          { name: "Structural steel", slug: "structural-steel-work" },
          { name: "Roofing (Industrial)", slug: "industrial-roofing" },
          { name: "Waterproofing (Industrial)", slug: "industrial-waterproofing" },
          { name: "Factory renovation", slug: "factory-renovation" },
        ],
      },
      {
        name: "Process & Instrumentation",
        slug: "process-instrumentation",
        iconName: "Activity",
        subcategories: [
          { name: "Process piping", slug: "process-piping" },
          { name: "Instrumentation (Process)", slug: "process-instrumentation-service" },
          { name: "Calibration", slug: "calibration-services" },
          { name: "Sensors", slug: "industrial-sensors" },
          { name: "Flow meters", slug: "flow-meters" },
          { name: "Pressure instruments", slug: "pressure-instruments" },
          { name: "Temperature instruments", slug: "temperature-instruments" },
          { name: "Control valves", slug: "control-valves" },
          { name: "Pneumatics", slug: "industrial-pneumatics" },
          { name: "Hydraulics", slug: "industrial-hydraulics" },
        ],
      },
      {
        name: "Robotics & Automation",
        slug: "robotics-automation",
        iconName: "Bot",
        subcategories: [
          { name: "Robot programming", slug: "robot-programming" },
          { name: "Robot installation", slug: "robot-installation" },
          { name: "Robot maintenance", slug: "robot-maintenance" },
          { name: "Vision systems", slug: "industrial-vision-systems" },
          { name: "Conveyor automation", slug: "conveyor-automation" },
          { name: "Pick-and-place", slug: "pick-and-place-automation" },
          { name: "Production automation", slug: "production-automation" },
        ],
      },
      {
        name: "Plant & Facility Maintenance",
        slug: "plant-facility-maintenance",
        iconName: "Wrench",
        subcategories: [
          { name: "Factory maintenance", slug: "factory-maintenance" },
          { name: "Preventive maintenance (Plant)", slug: "plant-preventive-maintenance" },
          { name: "Shutdown maintenance", slug: "shutdown-maintenance" },
          { name: "Utility maintenance", slug: "utility-maintenance" },
          { name: "Boiler", slug: "industrial-boiler" },
          { name: "Chiller (Industrial)", slug: "industrial-chiller" },
          { name: "Cooling tower (Industrial)", slug: "industrial-cooling-tower" },
          { name: "Compressed air", slug: "compressed-air-systems" },
          { name: "DG (Industrial)", slug: "industrial-dg" },
          { name: "ETP/STP", slug: "etp-stp-maintenance" },
          { name: "Water treatment", slug: "industrial-water-treatment" },
        ],
      },
      {
        name: "Skilled Labour",
        slug: "industrial-skilled-labour",
        iconName: "Users",
        subcategories: [
          { name: "Electrician (Industrial)", slug: "industrial-skilled-electrician" },
          { name: "Fitter", slug: "industrial-fitter" },
          { name: "Welder", slug: "industrial-welder" },
          { name: "Technician", slug: "industrial-technician" },
          { name: "Mechanical technician", slug: "mechanical-technician" },
          { name: "Instrument technician", slug: "instrument-technician" },
          { name: "CNC operator", slug: "cnc-operator" },
          { name: "Machine operator", slug: "machine-operator" },
          { name: "General labour (Industrial)", slug: "industrial-general-labour" },
          { name: "Maintenance technician", slug: "maintenance-technician" },
        ],
      },
      {
        name: "Safety & Compliance",
        slug: "industrial-safety-compliance",
        iconName: "ShieldAlert",
        subcategories: [
          { name: "Industrial safety", slug: "industrial-safety-audit" },
          { name: "Fire safety (Industrial)", slug: "industrial-fire-safety" },
          { name: "Safety audit", slug: "safety-audit" },
          { name: "PPE", slug: "ppe-compliance" },
          { name: "Safety training", slug: "industrial-safety-training" },
          { name: "Equipment inspection", slug: "equipment-inspection" },
          { name: "Electrical inspection", slug: "electrical-safety-inspection" },
        ],
      },
      {
        name: "Engineering & Professional",
        slug: "industrial-engineering-professional",
        iconName: "FileCheck",
        subcategories: [
          { name: "Electrical engineering", slug: "electrical-engineering" },
          { name: "Mechanical engineering", slug: "mechanical-engineering" },
          { name: "Civil engineering", slug: "civil-engineering" },
          { name: "Automation engineering", slug: "automation-engineering" },
          { name: "CAD design", slug: "cad-design" },
          { name: "3D modelling", slug: "3d-modelling" },
          { name: "Project management (Industrial)", slug: "industrial-project-management" },
          { name: "Quality inspection", slug: "quality-inspection" },
          { name: "Technical consulting", slug: "technical-consulting" },
        ],
      },
    ],
  },
];

async function upsertCategories() {
  for (let pIdx = 0; pIdx < HIERARCHY.length; pIdx++) {
    const parentDef = HIERARCHY[pIdx]!;
    const parentRecord = await db.serviceCategory.upsert({
      where: { slug: parentDef.slug },
      update: {
        name: parentDef.name,
        description: parentDef.description,
        iconName: parentDef.iconName,
        segment: parentDef.segment,
        sortOrder: pIdx + 1,
        parentId: null,
      },
      create: {
        name: parentDef.name,
        slug: parentDef.slug,
        description: parentDef.description,
        iconName: parentDef.iconName,
        segment: parentDef.segment,
        sortOrder: pIdx + 1,
        parentId: null,
      },
    });

    for (let cIdx = 0; cIdx < parentDef.categories.length; cIdx++) {
      const catDef = parentDef.categories[cIdx]!;
      const catRecord = await db.serviceCategory.upsert({
        where: { slug: catDef.slug },
        update: {
          name: catDef.name,
          description: `Professional ${catDef.name} services.`,
          iconName: catDef.iconName ?? "Briefcase",
          segment: parentDef.segment,
          sortOrder: cIdx + 1,
          parentId: parentRecord.id,
        },
        create: {
          name: catDef.name,
          slug: catDef.slug,
          description: `Professional ${catDef.name} services.`,
          iconName: catDef.iconName ?? "Briefcase",
          segment: parentDef.segment,
          sortOrder: cIdx + 1,
          parentId: parentRecord.id,
        },
      });

      for (let sIdx = 0; sIdx < catDef.subcategories.length; sIdx++) {
        const subDef = catDef.subcategories[sIdx]!;
        await db.serviceCategory.upsert({
          where: { slug: subDef.slug },
          update: {
            name: subDef.name,
            description: `${subDef.name} in ${catDef.name}.`,
            iconName: catDef.iconName ?? "Wrench",
            segment: parentDef.segment,
            sortOrder: sIdx + 1,
            parentId: catRecord.id,
          },
          create: {
            name: subDef.name,
            slug: subDef.slug,
            description: `${subDef.name} in ${catDef.name}.`,
            iconName: catDef.iconName ?? "Wrench",
            segment: parentDef.segment,
            sortOrder: sIdx + 1,
            parentId: catRecord.id,
          },
        });
      }
    }
  }
}

async function createProfessionals(passwordHash: string) {
  const professionals = Array.from({ length: 12 }, (_, index) => {
    const cityInfo = INDIAN_CITIES[index % INDIAN_CITIES.length]!;
    const coords = jitterNearCity(cityInfo);
    const category = categories[index % categories.length] ?? "Development";
    return {
      email: `professional.${index + 1}@${SEED_DOMAIN}`,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      category,
      industry: CATEGORY_INDUSTRY[category] ?? "Professional Services",
      city: cityInfo.city,
      hourlyRate: faker.number.int({ min: 35, max: 180 }),
      fixedRate: faker.number.int({ min: 2000, max: 25000 }),
      experienceYears: faker.number.int({ min: 1, max: 15 }),
      serviceArea: `${cityInfo.city} and nearby areas`,
      address: `${faker.location.buildingNumber()}, ${faker.location.street()}, ${cityInfo.city}`,
      teamSize: faker.helpers.arrayElement(["Just me", "2-5", "6-10"]),
      skills: faker.helpers.arrayElements(
        ["React", "TypeScript", "Plumbing", "Figma", "SEO", "Photography", "Tutoring", "AWS"],
        { min: 3, max: 5 },
      ),
      latitude: coords.lat,
      longitude: coords.lng,
    };
  });

  // A fully-detailed professional used as the reference profile.
  const suratCity = INDIAN_CITIES.find((entry) => entry.city === "Surat")!;
  professionals.push({
    email: "surat.pro@servio.example",
    firstName: "Rajesh",
    lastName: "Patel",
    category: "Development",
    industry: CATEGORY_INDUSTRY.Development!,
    city: "Surat",
    hourlyRate: 120,
    fixedRate: 45000,
    experienceYears: 8,
    serviceArea: "Vesu, Adajan, Piplod, Surat",
    address: "204, Divine Enclave, Vesu, Surat, Gujarat 395007",
    teamSize: "2-5",
    skills: ["React", "TypeScript", "AWS", "Figma", "SEO"],
    latitude: suratCity.lat,
    longitude: suratCity.lng,
  });

  return Promise.all(
    professionals.map((professional, index) =>
      db.user.upsert({
        where: { email: professional.email },
        update: {
          professionalLatitude: professional.latitude,
          professionalLongitude: professional.longitude,
          professionalCity: professional.city,
          industry: professional.industry,
          experienceYears: professional.experienceYears,
          fixedRate: professional.fixedRate,
          serviceArea: professional.serviceArea,
          address: professional.address,
          teamSize: professional.teamSize,
        },
        create: {
          email: professional.email,
          firstName: professional.firstName,
          lastName: professional.lastName,
          passwordHash,
          role: "PROFESSIONAL",
          authProvider: "LOCAL",
          emailVerifiedAt: new Date(),
          professionalCategory: professional.category,
          industry: professional.industry,
          professionalCity: professional.city,
          hourlyRate: professional.hourlyRate,
          fixedRate: professional.fixedRate,
          experienceYears: professional.experienceYears,
          serviceArea: professional.serviceArea,
          address: professional.address,
          teamSize: professional.teamSize,
          professionalSkillsJson: JSON.stringify(professional.skills),
          companyDescription: faker.company.catchPhrase(),
          isVerified: index % 3 !== 0,
          availabilityStatus: index % 2 === 0 ? "available" : "this_week",
          averageRating: faker.number.float({ min: 4.1, max: 5, fractionDigits: 1 }),
          reviewCount: faker.number.int({ min: 3, max: 65 }),
          professionalLatitude: professional.latitude,
          professionalLongitude: professional.longitude,
        },
      }),
    ),
  );
}

async function createJobs(clientId: number) {
  const jobs = Array.from({ length: 8 }, (_, index) => ({
    title: `Seed marketplace job ${index + 1}: ${faker.company.catchPhrase()}`,
    category: categories[index % categories.length] ?? "Development",
    description: faker.lorem.paragraphs(2),
  }));
  await Promise.all(
    jobs.map(async (job, index) => {
      const existing = await db.clientJob.findFirst({
        where: { title: job.title },
        select: { id: true },
      });
      if (existing) return;
      await db.clientJob.create({
        data: {
          userId: clientId,
          title: job.title,
          category: job.category,
          description: job.description,
          budgetMin: faker.number.int({ min: 500, max: 2500 }),
          budgetMax: faker.number.int({ min: 3000, max: 10000 }),
          urgency: index % 3 === 0 ? "HIGH" : "MEDIUM",
          workMode: index % 2 === 0 ? "REMOTE" : "ON_SITE",
          locationLabel: index % 2 === 0 ? "Remote" : faker.location.city(),
          deadline: faker.date.soon({ days: 30 }),
        },
      });
    }),
  );
}

// Mirrors src/lib/wallet-ledger.ts#calculateMilestoneMoney — kept as a plain copy here so the
// seed script doesn't have to import a "server-only"-guarded module outside of Next's runtime.
function calculateMilestoneMoney(baseAmount: number) {
  const clientFeeAmount = Math.ceil(baseAmount * 0.1);
  const professionalFeeAmount = Math.ceil(baseAmount * 0.1);
  const clientChargeAmount = baseAmount + clientFeeAmount;
  const professionalPayoutAmount = Math.max(0, baseAmount - professionalFeeAmount);
  return {
    baseAmount,
    clientFeeAmount,
    clientChargeAmount,
    professionalPayoutAmount,
    adminNetAmount: clientChargeAmount - professionalPayoutAmount,
  };
}

async function ensureWallet(userId: number) {
  return db.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
}

async function seedWalletActivity(client: { id: number }, professional: { id: number }) {
  const admin = await db.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {},
    create: {
      email: SEED_ADMIN_EMAIL,
      username: "seed-admin",
      firstName: "Seed",
      lastName: "Admin",
      passwordHash: await bcrypt.hash(SEED_PASSWORD, 12),
      role: "ADMIN",
      authProvider: "LOCAL",
      emailVerifiedAt: new Date(),
    },
  });

  const [clientWallet, professionalWallet, adminWallet] = await Promise.all([
    ensureWallet(client.id),
    ensureWallet(professional.id),
    ensureWallet(admin.id),
  ]);

  const topUps = [20000, 15000];
  for (const [index, amount] of topUps.entries()) {
    const idempotencyKey = `seed-topup-${client.id}-${index}`;
    if (await db.walletTransaction.findUnique({ where: { idempotencyKey } })) continue;
    await db.walletTransaction.create({
      data: {
        walletId: clientWallet.id,
        amount,
        type: "WALLET_TOP_UP",
        status: "COMPLETED",
        description: `Wallet top-up: ${amount}`,
        idempotencyKey,
      },
    });
    await db.wallet.update({
      where: { id: clientWallet.id },
      data: { balance: { increment: amount } },
    });
  }

  const milestones = [
    { base: 5000, title: "Homepage redesign milestone" },
    { base: 12000, title: "API integration milestone" },
    { base: 8000, title: "QA & handoff milestone" },
  ];
  for (const [index, milestone] of milestones.entries()) {
    const idempotencyKey = `seed-milestone-${client.id}-${professional.id}-${index}`;
    if (await db.payment.findUnique({ where: { idempotencyKey } })) continue;
    const milestoneId = 900_001 + index;
    const money = calculateMilestoneMoney(milestone.base);

    const payment = await db.payment.create({
      data: {
        clientId: client.id,
        professionalId: professional.id,
        amount: money.clientChargeAmount,
        baseAmount: money.baseAmount,
        clientFeeAmount: money.clientFeeAmount,
        professionalPayoutAmount: money.professionalPayoutAmount,
        adminNetAmount: money.adminNetAmount,
        commissionAmount: money.adminNetAmount,
        currency: "INR",
        provider: "wallet",
        milestoneId,
        status: "COMPLETED",
        capturedAt: new Date(),
        idempotencyKey,
      },
    });
    await db.invoice.create({
      data: {
        invoiceNumber: `INV-SEED-${String(payment.id).padStart(6, "0")}`,
        paymentId: payment.id,
        clientId: client.id,
        professionalId: professional.id,
        amount: money.clientChargeAmount,
        commissionAmount: money.adminNetAmount,
        netAmount: money.professionalPayoutAmount,
        currency: "INR",
      },
    });
    await db.projectTransaction.create({
      data: {
        trackingId: 900_000 + index,
        milestoneId,
        clientId: client.id,
        professionalId: professional.id,
        amount: milestone.base,
        currency: "INR",
        type: "WALLET_MILESTONE_PAYMENT",
        status: "COMPLETED",
        description: `Wallet milestone payment: ${milestone.title}`,
      },
    });

    await db.walletTransaction.create({
      data: {
        walletId: clientWallet.id,
        amount: -money.clientChargeAmount,
        type: "MILESTONE_PAYMENT",
        status: "COMPLETED",
        description: `Milestone payment debited: ${money.baseAmount}`,
        idempotencyKey: `${idempotencyKey}-client-debit`,
      },
    });
    await db.walletTransaction.create({
      data: {
        walletId: adminWallet.id,
        amount: money.clientChargeAmount,
        type: "ADMIN_MILESTONE_RECEIPT",
        status: "COMPLETED",
        description: `Client milestone receipt: ${money.clientChargeAmount}`,
        idempotencyKey: `${idempotencyKey}-admin-credit`,
      },
    });
    await db.walletTransaction.create({
      data: {
        walletId: adminWallet.id,
        amount: -money.professionalPayoutAmount,
        type: "PROFESSIONAL_PAYOUT",
        status: "COMPLETED",
        description: `Professional payout: ${money.professionalPayoutAmount}`,
        idempotencyKey: `${idempotencyKey}-admin-debit`,
      },
    });
    await db.walletTransaction.create({
      data: {
        walletId: professionalWallet.id,
        amount: money.professionalPayoutAmount,
        type: "MILESTONE_EARNING",
        status: "COMPLETED",
        description: `Milestone earning: ${money.professionalPayoutAmount}`,
        idempotencyKey: `${idempotencyKey}-professional-credit`,
      },
    });
    await Promise.all([
      db.wallet.update({
        where: { id: clientWallet.id },
        data: { balance: { decrement: money.clientChargeAmount } },
      }),
      db.wallet.update({
        where: { id: adminWallet.id },
        data: { balance: { increment: money.adminNetAmount } },
      }),
      db.wallet.update({
        where: { id: professionalWallet.id },
        data: { balance: { increment: money.professionalPayoutAmount } },
      }),
    ]);
  }

  const pendingWithdrawalNote = "seed-pending-withdrawal";
  const existingWithdrawal = await db.projectWithdrawal.findFirst({
    where: { professionalId: professional.id, note: pendingWithdrawalNote },
  });
  if (!existingWithdrawal) {
    await db.projectWithdrawal.create({
      data: {
        professionalId: professional.id,
        amount: 4000,
        destinationType: "BANK",
        destinationLabel: "HDFC Bank •••• 4821",
        status: "PENDING",
        note: pendingWithdrawalNote,
      },
    });
  }
}

async function main() {
  faker.seed(20260810);
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  await upsertCategories();
  const client = await db.user.upsert({
    where: { email: SEED_CLIENT_EMAIL },
    update: {},
    create: {
      email: SEED_CLIENT_EMAIL,
      firstName: "Seed",
      lastName: "Client",
      passwordHash,
      role: "CLIENT",
      authProvider: "LOCAL",
      emailVerifiedAt: new Date(),
    },
  });
  await createProfessionals(passwordHash);
  await createJobs(client.id);
  const professional = await db.user.findUniqueOrThrow({
    where: { email: SEED_PROFESSIONAL_EMAIL },
    select: { id: true },
  });
  await seedWalletActivity(client, professional);
  console.info("seed.completed", { categories: categories.length, professionals: 12, jobs: 8 });
}

main()
  .catch((error: unknown) => {
    console.error("seed.failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
