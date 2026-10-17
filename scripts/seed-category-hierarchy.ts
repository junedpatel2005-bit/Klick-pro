import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

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
  segment: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | "HEALTH_CARE" | "PERSONAL_CARE" | "EDUCATION" | string;
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
  {
    name: "Health Care",
    slug: "health-care",
    segment: "HEALTH_CARE",
    description: "Medical care, health services and healthcare delivery.",
    iconName: "HeartPulse",
    categories: [
      {
        name: "Medical Services",
        slug: "medical-services",
        iconName: "Stethoscope",
        description: "Doctor consultations, home visits, and specialized clinical care.",
        subcategories: [
          { name: "Doctor Home Visits", slug: "doctor-home-visits" },
          { name: "General Physician Consultation", slug: "general-physician-consultation" },
          { name: "Specialist Consultation", slug: "specialist-consultation" },
          { name: "Online Doctor Consultation", slug: "online-doctor-consultation" },
        ],
      },
      {
        name: "Nursing & Home Health Care",
        slug: "nursing-home-health-care",
        iconName: "HeartPulse",
        description: "Professional nursing, post-surgery, and home medical assistance.",
        subcategories: [
          { name: "Home Nursing", slug: "home-nursing" },
          { name: "Post-Surgery Care", slug: "post-surgery-care" },
          { name: "Wound Care & Dressing", slug: "wound-care-dressing" },
          { name: "Medication Support", slug: "medication-support" },
          { name: "Vital Signs Monitoring", slug: "vital-signs-monitoring" },
          { name: "Elderly Health Care", slug: "elderly-health-care" },
        ],
      },
      {
        name: "Therapy & Rehabilitation",
        slug: "therapy-rehabilitation",
        iconName: "Activity",
        description: "Physical rehabilitation, occupational therapy, and mental health counselling.",
        subcategories: [
          { name: "Physiotherapy", slug: "physiotherapy" },
          { name: "Occupational Therapy", slug: "occupational-therapy" },
          { name: "Speech Therapy", slug: "speech-therapy" },
          { name: "Post-Injury Rehabilitation", slug: "post-injury-rehabilitation" },
          { name: "Mental Health Counselling", slug: "mental-health-counselling" },
          { name: "Behavioural Support", slug: "behavioural-support" },
        ],
      },
      {
        name: "Medical Testing",
        slug: "medical-testing",
        iconName: "FlaskConical",
        description: "Diagnostic blood tests, sample collection, and home laboratory services.",
        subcategories: [
          { name: "Blood Sample Collection", slug: "blood-sample-collection" },
          { name: "Home Diagnostic Tests", slug: "home-diagnostic-tests" },
          { name: "Lab Test Booking", slug: "lab-test-booking" },
          { name: "Other Approved Home Testing Services", slug: "other-approved-home-testing-services" },
        ],
      },
      {
        name: "Medicine Home Delivery",
        slug: "medicine-home-delivery",
        iconName: "Pill",
        description: "Prescription medications, refills, OTC delivery, and medical supplies.",
        subcategories: [
          { name: "Prescription Medicine Delivery", slug: "prescription-medicine-delivery" },
          { name: "Over-the-Counter (OTC) Medicine Delivery", slug: "otc-medicine-delivery" },
          { name: "Prescription Refill Delivery", slug: "prescription-refill-delivery" },
          { name: "Pharmacy Order Pickup & Delivery", slug: "pharmacy-order-pickup-delivery" },
          { name: "Approved Medical Supplies Delivery", slug: "approved-medical-supplies-delivery" },
          { name: "Contactless Medicine Delivery", slug: "contactless-medicine-delivery" },
        ],
      },
      {
        name: "Health Support Services",
        slug: "health-support-services",
        iconName: "ShieldPlus",
        description: "Patient transportation, wheelchair mobility, and medical coordination.",
        subcategories: [
          { name: "Non-Emergency Medical Transportation", slug: "non-emergency-medical-transportation" },
          { name: "Wheelchair Transportation", slug: "wheelchair-transportation" },
          { name: "Medical Appointment Assistance", slug: "medical-appointment-assistance" },
          { name: "Health Care Coordination", slug: "health-care-coordination" },
        ],
      },
    ],
  },
  {
    name: "Personal Care & Home Services",
    slug: "personal-care-home-services",
    segment: "PERSONAL_CARE",
    description: "Household help, grooming, beauty and everyday personal assistance.",
    iconName: "Sparkles",
    categories: [
      {
        name: "Maid & Cleaning Services",
        slug: "personal-maid-cleaning-services",
        iconName: "Sparkles",
        description: "House maids, regular domestic cleaning, dishwashing, and housekeeping.",
        subcategories: [
          { name: "House Maid", slug: "house-maid" },
          { name: "Regular House Cleaning", slug: "personal-regular-house-cleaning" },
          { name: "Deep Cleaning", slug: "personal-deep-cleaning" },
          { name: "Kitchen Cleaning", slug: "personal-kitchen-cleaning" },
          { name: "Bathroom Cleaning", slug: "personal-bathroom-cleaning" },
          { name: "Laundry & Ironing", slug: "personal-laundry-ironing" },
          { name: "Dishwashing", slug: "personal-dishwashing" },
          { name: "Move-In / Move-Out Cleaning", slug: "personal-move-in-move-out-cleaning" },
          { name: "Live-In Maid Services", slug: "live-in-maid-services" },
          { name: "Part-Time Maid Services", slug: "part-time-maid-services" },
        ],
      },
      {
        name: "Beauty Parlour & Salon",
        slug: "beauty-parlour-salon",
        iconName: "Scissors",
        description: "Hair styling, makeup, skincare, bridal packages, and grooming at home.",
        subcategories: [
          { name: "Haircut & Hairstyling", slug: "haircut-hairstyling" },
          { name: "Hair Colouring", slug: "hair-colouring" },
          { name: "Facial & Skincare", slug: "facial-skincare" },
          { name: "Makeup Services", slug: "makeup-services" },
          { name: "Bridal Makeup", slug: "bridal-makeup" },
          { name: "Manicure & Pedicure", slug: "manicure-pedicure" },
          { name: "Waxing & Threading", slug: "waxing-threading" },
          { name: "Hair Spa & Treatments", slug: "hair-spa-treatments" },
          { name: "Men’s Grooming", slug: "mens-grooming" },
          { name: "Home Salon Services", slug: "home-salon-services" },
        ],
      },
      {
        name: "Personal Support & Caregiving",
        slug: "personal-support-caregiving",
        iconName: "Users",
        description: "Senior citizen care, babysitting, nannies, and specialized caregiving.",
        subcategories: [
          { name: "Senior Citizen Care", slug: "senior-citizen-care" },
          { name: "Babysitting", slug: "babysitting" },
          { name: "Nanny Services", slug: "nanny-services" },
          { name: "Newborn & Infant Care", slug: "newborn-infant-care" },
          { name: "Disability Support", slug: "disability-support" },
          { name: "Bathing & Grooming Assistance", slug: "bathing-grooming-assistance" },
          { name: "Mobility Assistance", slug: "mobility-assistance" },
          { name: "Companionship", slug: "companionship" },
          { name: "Respite Care", slug: "respite-care" },
          { name: "Live-In Caregiving", slug: "live-in-caregiving" },
        ],
      },
      {
        name: "Personal Wellness",
        slug: "personal-wellness",
        iconName: "Smile",
        description: "Massage, yoga trainers, fitness coaches, and wellness guidance.",
        subcategories: [
          { name: "Non-Medical Massage & Relaxation", slug: "non-medical-massage-relaxation" },
          { name: "Personal Grooming", slug: "personal-grooming" },
          { name: "Yoga Instructor", slug: "wellness-yoga-instructor" },
          { name: "Personal Fitness Trainer", slug: "wellness-fitness-trainer" },
          { name: "Meditation & Wellness Coaching", slug: "meditation-wellness-coaching" },
        ],
      },
      {
        name: "Household Assistance",
        slug: "household-assistance",
        iconName: "Home",
        description: "Meal preparation, errands, grocery shopping, and home organization.",
        subcategories: [
          { name: "Meal Preparation", slug: "meal-preparation" },
          { name: "Grocery Shopping", slug: "grocery-shopping" },
          { name: "Household Errands", slug: "household-errands" },
          { name: "Dishwashing & Kitchen Help", slug: "kitchen-help" },
          { name: "Laundry Services", slug: "household-laundry-services" },
          { name: "Home Organization", slug: "home-organization" },
          { name: "Appointment Accompaniment", slug: "appointment-accompaniment" },
        ],
      },
    ],
  },
  {
    name: "Education",
    slug: "education",
    segment: "EDUCATION",
    description: "Academic tutoring, language learning, IT skills, and professional coaching.",
    iconName: "GraduationCap",
    categories: [
      {
        name: "Academic Tutoring",
        slug: "academic-tutoring",
        iconName: "BookOpen",
        description: "School and college subject tutoring, mathematics, science, and learning support.",
        subcategories: [
          { name: "Home Tutoring", slug: "home-tutoring" },
          { name: "Online Tutoring", slug: "online-tutoring" },
          { name: "Mathematics", slug: "mathematics-tutoring" },
          { name: "Science", slug: "science-tutoring" },
          { name: "English", slug: "english-tutoring" },
          { name: "Social Studies", slug: "social-studies-tutoring" },
          { name: "School Subject Tutoring", slug: "school-subject-tutoring" },
          { name: "Special Education & Learning Support", slug: "special-education-support" },
          { name: "Early Childhood Learning", slug: "early-childhood-learning" },
        ],
      },
      {
        name: "Language Learning",
        slug: "language-learning",
        iconName: "Languages",
        description: "Spoken English, foreign languages, IELTS, TOEFL, and communication.",
        subcategories: [
          { name: "English Language Training", slug: "english-language-training" },
          { name: "French Language Training", slug: "french-language-training" },
          { name: "Foreign Language Training", slug: "foreign-language-training" },
          { name: "Spoken English", slug: "spoken-english" },
          { name: "Business Communication", slug: "business-communication" },
          { name: "IELTS Preparation", slug: "ielts-preparation" },
          { name: "CELPIP Preparation", slug: "celpip-preparation" },
          { name: "TOEFL Preparation", slug: "toefl-preparation" },
        ],
      },
      {
        name: "Exam Preparation",
        slug: "exam-preparation",
        iconName: "FileCheck",
        description: "Competitive examinations, entrance tests, and government test coaching.",
        subcategories: [
          { name: "School Entrance Exams", slug: "school-entrance-exams" },
          { name: "University Entrance Exams", slug: "university-entrance-exams" },
          { name: "Competitive Exam Coaching", slug: "competitive-exam-coaching" },
          { name: "Government Exam Preparation", slug: "government-exam-preparation" },
          { name: "Professional Certification Exams", slug: "professional-certification-exams" },
          { name: "Standardized Test Preparation", slug: "standardized-test-preparation" },
        ],
      },
      {
        name: "Technology & IT Training",
        slug: "technology-it-training",
        iconName: "Code",
        description: "Coding, software development, AI, cybersecurity, and cloud computing.",
        subcategories: [
          { name: "Computer Basics", slug: "computer-basics" },
          { name: "Coding & Programming", slug: "coding-programming" },
          { name: "Web Development", slug: "web-development-training" },
          { name: "Mobile App Development", slug: "mobile-app-development-training" },
          { name: "Artificial Intelligence", slug: "ai-training" },
          { name: "Data Science & Analytics", slug: "data-science-analytics" },
          { name: "Cybersecurity", slug: "cybersecurity-training" },
          { name: "Networking & Cloud Computing", slug: "networking-cloud-computing" },
          { name: "Robotics & STEM Education", slug: "robotics-stem-education" },
        ],
      },
      {
        name: "Vocational & Technical Training",
        slug: "vocational-technical-training",
        iconName: "Wrench",
        description: "Hands-on trades, electrical, mechanical, welding, HVAC, and industrial skills.",
        subcategories: [
          { name: "Electrical Training", slug: "electrical-training" },
          { name: "Industrial Automation & PLC", slug: "industrial-automation-plc-training" },
          { name: "Mechanical Training", slug: "mechanical-training" },
          { name: "Welding & Fabrication", slug: "welding-fabrication-training" },
          { name: "HVAC Training", slug: "hvac-training" },
          { name: "Automotive Training", slug: "automotive-training" },
          { name: "Construction Skills", slug: "construction-skills-training" },
          { name: "Plumbing Training", slug: "plumbing-training" },
          { name: "Occupational Health & Safety", slug: "occupational-health-safety-training" },
          { name: "First Aid & Safety Training", slug: "first-aid-safety-training" },
        ],
      },
      {
        name: "Professional & Business Training",
        slug: "professional-business-training",
        iconName: "Briefcase",
        description: "Management, digital marketing, sales, accounting, and leadership.",
        subcategories: [
          { name: "Business Management", slug: "business-management-training" },
          { name: "Entrepreneurship", slug: "entrepreneurship-training" },
          { name: "Accounting & Bookkeeping", slug: "accounting-bookkeeping-training" },
          { name: "Digital Marketing", slug: "digital-marketing-training" },
          { name: "Project Management", slug: "project-management-training" },
          { name: "Human Resources Training", slug: "hr-training" },
          { name: "Leadership & Communication", slug: "leadership-communication" },
          { name: "Sales Training", slug: "sales-training" },
          { name: "Customer Service Training", slug: "customer-service-training" },
          { name: "Corporate Training", slug: "corporate-training" },
        ],
      },
      {
        name: "Arts, Music & Creative Learning",
        slug: "arts-music-creative-learning",
        iconName: "Palette",
        description: "Music, singing, dance, drawing, graphic design, and video editing.",
        subcategories: [
          { name: "Music Lessons", slug: "music-lessons" },
          { name: "Singing & Vocal Training", slug: "singing-vocal-training" },
          { name: "Instrument Lessons", slug: "instrument-lessons" },
          { name: "Dance Classes", slug: "dance-classes" },
          { name: "Art & Drawing", slug: "art-drawing" },
          { name: "Painting", slug: "painting-classes" },
          { name: "Photography", slug: "photography-classes" },
          { name: "Video Editing", slug: "video-editing-classes" },
          { name: "Graphic Design", slug: "graphic-design-training" },
          { name: "Fashion Design", slug: "fashion-design-training" },
        ],
      },
      {
        name: "Sports & Fitness Training",
        slug: "sports-fitness-training",
        iconName: "Trophy",
        description: "Personal sports coaching, cricket, football, swimming, and fitness.",
        subcategories: [
          { name: "Personal Sports Coaching", slug: "personal-sports-coaching" },
          { name: "Cricket Coaching", slug: "cricket-coaching" },
          { name: "Football Coaching", slug: "football-coaching" },
          { name: "Basketball Coaching", slug: "basketball-coaching" },
          { name: "Tennis Coaching", slug: "tennis-coaching" },
          { name: "Swimming Lessons", slug: "swimming-lessons" },
          { name: "Martial Arts", slug: "martial-arts-training" },
          { name: "Yoga Training", slug: "education-yoga-training" },
          { name: "Meditation Classes", slug: "education-meditation-classes" },
          { name: "Personal Fitness Training", slug: "education-fitness-training" },
        ],
      },
      {
        name: "Higher Education & Career Guidance",
        slug: "higher-education-career-guidance",
        iconName: "Compass",
        description: "Career counselling, study abroad, college guidance, and interview prep.",
        subcategories: [
          { name: "Career Counselling", slug: "career-counselling" },
          { name: "Study Abroad Counselling", slug: "study-abroad-counselling" },
          { name: "College & University Guidance", slug: "college-university-guidance" },
          { name: "Course Selection Guidance", slug: "course-selection-guidance" },
          { name: "Resume & Interview Training", slug: "resume-interview-training" },
          { name: "Career Skills Development", slug: "career-skills-development" },
          { name: "Scholarship Guidance", slug: "scholarship-guidance" },
          { name: "Professional Development", slug: "professional-development-guidance" },
        ],
      },
      {
        name: "Driving & Practical Skills",
        slug: "driving-practical-skills",
        iconName: "Car",
        description: "Driving lessons, defensive driving, public speaking, and financial literacy.",
        subcategories: [
          { name: "Driving Lessons", slug: "driving-lessons" },
          { name: "Commercial Driving Training", slug: "commercial-driving-training" },
          { name: "Defensive Driving", slug: "defensive-driving" },
          { name: "Computer Skills", slug: "practical-computer-skills" },
          { name: "Public Speaking", slug: "public-speaking-training" },
          { name: "Personal Development", slug: "personal-development-training" },
          { name: "Financial Literacy", slug: "financial-literacy" },
          { name: "Life Skills Training", slug: "life-skills-training" },
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
  segment: string;
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
