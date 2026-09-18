import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed categories.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type SubCat = {
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
};

type MainCat = {
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  subcategories: SubCat[];
};

type ParentCat = {
  name: string;
  slug: string;
  segment: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL";
  description: string;
  iconName: string;
  categories: MainCat[];
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const HIERARCHY: ParentCat[] = [
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
        description:
          "Professional cleaning, deep cleaning, and housekeeping services for residences.",
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
        description:
          "Licensed electricians for wiring, switchboards, lighting, and home electrical repairs.",
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
        description: "Expert plumbers for leakages, taps, bathrooms, pipelines, and drainage.",
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
        description: "Air conditioning repair, servicing, gas refilling, and HVAC installations.",
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
        description: "Custom woodwork, furniture repair, modular kitchens, and door installations.",
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
        description:
          "Interior & exterior house painting, waterproofing, wallpapers, and false ceilings.",
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
        description: "Complete room renovations, civil work, tiling, plastering, and remodelling.",
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
        description:
          "Repairs for refrigerators, washing machines, microwaves, TVs, and kitchen appliances.",
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
        description:
          "RO installation, servicing, membrane filter replacement, and water softeners.",
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
        description:
          "Safe pest extermination for termites, cockroaches, rodents, mosquitoes, and bed bugs.",
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
        description:
          "House shifting, local & intercity relocation, packing, and furniture transport.",
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
        description: "Gardeners, lawn maintenance, terrace gardens, and residential landscaping.",
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
        description: "CCTV, smart locks, video doorbells, alarms, and smart home automation.",
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
        description:
          "Solar panel cleaning, chimney & duct cleaning, pressure washing, and drain clearing.",
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
        description:
          "Furniture assembly, TV mounting, curtain rods, drilling, shelf mounting, and repairs.",
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
        description:
          "Trained residential security guards, night watchmen, and gated community security.",
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
        description:
          "Facility management, housekeeping staff, commercial HVAC, elevators, and fire safety.",
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
        description:
          "Commercial interior fitouts, civil contractors, glass partitions, and false ceilings.",
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
        description:
          "Commercial electrical panels, diesel generators, chillers, cooling towers, and VRF systems.",
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
        description:
          "Networking, server rooms, commercial Wi-Fi, biometric access, and structured cabling.",
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
        description:
          "Office shifting, corporate security, receptionists, office boys, and staffing.",
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
        description:
          "Kitchen equipment, commercial refrigeration, exhaust hoods, pest control, and laundry.",
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
        description:
          "PLC programming, SCADA, HMI, VFD, MCC/PCC panels, and industrial control systems.",
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
        description:
          "Machine installation, preventive breakdown maintenance, millwrights, pumps, and compressors.",
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
        description:
          "MIG, TIG, ARC welding, stainless-steel fabrication, pipe fabrication, CNC, and laser cutting.",
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
        description:
          "Industrial RCC, factory renovations, epoxy & industrial flooring, and structural steel.",
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
        description:
          "Process piping, calibration, flow meters, sensors, valves, pneumatics, and hydraulics.",
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
        description:
          "Robot programming, robotic arm installation, vision systems, and conveyor automation.",
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
        description:
          "Factory maintenance, shutdown maintenance, boilers, chillers, ETP/STP, and water treatment.",
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
        description:
          "Certified fitters, welders, CNC machine operators, and maintenance technicians.",
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
        description:
          "Industrial safety audits, fire safety compliance, PPE, and equipment safety inspections.",
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
        description:
          "Electrical, mechanical, and civil engineering, CAD 3D design, and technical consulting.",
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

async function upsertCategory(data: {
  name: string;
  slug: string;
  description: string;
  iconName: string;
  segment: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL";
  sortOrder: number;
  parentId: number | null;
}) {
  const existing = await db.serviceCategory.findFirst({
    where: {
      OR: [{ slug: data.slug }, { name: data.name }],
    },
  });
  if (existing) {
    return await db.serviceCategory.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        iconName: data.iconName,
        segment: data.segment,
        sortOrder: data.sortOrder,
        parentId: data.parentId,
      },
    });
  } else {
    return await db.serviceCategory.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        iconName: data.iconName,
        segment: data.segment,
        sortOrder: data.sortOrder,
        parentId: data.parentId,
      },
    });
  }
}

async function seedHierarchy() {
  console.log("=== SEEDING 3-TIER CATEGORY HIERARCHY ===");
  let parentCount = 0;
  let mainCatCount = 0;
  let subCatCount = 0;

  for (let pIdx = 0; pIdx < HIERARCHY.length; pIdx++) {
    const parentDef = HIERARCHY[pIdx]!;
    const parentRecord = await upsertCategory({
      name: parentDef.name,
      slug: parentDef.slug,
      description: parentDef.description,
      iconName: parentDef.iconName,
      segment: parentDef.segment,
      sortOrder: pIdx + 1,
      parentId: null,
    });
    parentCount++;
    console.log(
      `[Tier 1 Parent] #${parentRecord.id} ${parentRecord.name} (${parentRecord.segment})`,
    );

    for (let cIdx = 0; cIdx < parentDef.categories.length; cIdx++) {
      const catDef = parentDef.categories[cIdx]!;
      const catRecord = await upsertCategory({
        name: catDef.name,
        slug: catDef.slug,
        description: catDef.description ?? `Professional ${catDef.name} services.`,
        iconName: catDef.iconName ?? "Briefcase",
        segment: parentDef.segment,
        sortOrder: cIdx + 1,
        parentId: parentRecord.id,
      });
      mainCatCount++;
      console.log(`  [Tier 2 Cat] #${catRecord.id} ${catRecord.name}`);

      for (let sIdx = 0; sIdx < catDef.subcategories.length; sIdx++) {
        const subDef = catDef.subcategories[sIdx]!;
        const subRecord = await upsertCategory({
          name: subDef.name,
          slug: subDef.slug,
          description: subDef.description ?? `${subDef.name} in ${catDef.name}.`,
          iconName: subDef.iconName ?? catDef.iconName ?? "Wrench",
          segment: parentDef.segment,
          sortOrder: sIdx + 1,
          parentId: catRecord.id,
        });
        subCatCount++;
      }
    }
  }

  console.log("\n✅ HIERARCHY SEEDING COMPLETE!");
  console.log(`  - Parent Categories (Tier 1): ${parentCount}`);
  console.log(`  - Main Categories   (Tier 2): ${mainCatCount}`);
  console.log(`  - Subcategories     (Tier 3): ${subCatCount}`);
  console.log(`  - Total Seeded Categories: ${parentCount + mainCatCount + subCatCount}`);
}

seedHierarchy()
  .catch((err) => {
    console.error("Failed to seed category hierarchy:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
