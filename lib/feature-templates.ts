export interface FieldDefinition {
  name: string;
  type: "text" | "number" | "select" | "date" | "url" | "textarea";
  options?: string[];
  placeholder?: string;
}

export interface FeatureTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "Tracking" | "Directory" | "Inventory";
  popularity: number; // TODO: replace with real tracking
  schema: FieldDefinition[];
}

export const FEATURE_TEMPLATES: FeatureTemplate[] = [
  {
    id: "paint-tracker",
    name: "Paint Tracker",
    description: "Track paint brands, colors, codes, and which rooms they were used in.",
    icon: "Paintbrush",
    category: "Tracking",
    popularity: 1247,
    schema: [
      { name: "Brand", type: "text", placeholder: "e.g., Behr, Benjamin Moore" },
      { name: "Color Name", type: "text", placeholder: "e.g., Sorus, Simply White" },
      { name: "Color Code", type: "text", placeholder: "e.g., 3A60-3, OC-117" },
      { name: "Finish", type: "select", options: ["Flat", "Matte", "Eggshell", "Satin", "Semi-Gloss", "Gloss"] },
      { name: "Interior/Exterior", type: "select", options: ["Interior", "Exterior", "Interior/Exterior"] },
      { name: "Size", type: "select", options: ["Sample", "Quart", "Gallon", "5 Gallon"] },
      { name: "Base", type: "text", placeholder: "e.g., Pastel Base (2500)" },
      { name: "Colorant Formula", type: "textarea", placeholder: "e.g., AX Perm Yellow 0/24/0\nD Thalo Green 0/42/0" },
      { name: "Rooms Used", type: "text", placeholder: "e.g., Living Room, Master Bedroom" },
      { name: "Store", type: "text", placeholder: "e.g., Home Depot, Sherwin-Williams" },
      { name: "Purchase Date", type: "date" },
      { name: "Price", type: "number" },
      { name: "Photo", type: "url", placeholder: "Photo URL (auto-filled by scanner)" },
    ],
  },
  {
    id: "appliance-registry",
    name: "Appliance Registry",
    description: "Catalog all appliances with make, model, serial numbers, and warranty dates.",
    icon: "Refrigerator",
    category: "Inventory",
    popularity: 2831,
    schema: [
      { name: "Appliance", type: "text", placeholder: "e.g., Dishwasher" },
      { name: "Make", type: "text", placeholder: "e.g., Bosch" },
      { name: "Model", type: "text", placeholder: "e.g., SHPM88Z75N" },
      { name: "Serial Number", type: "text", placeholder: "e.g., FD1234567" },
      { name: "Location", type: "select", options: ["Kitchen", "Bathroom", "Bedroom", "Living Room", "Garage", "Basement/Attic", "Laundry", "Exterior"] },
      { name: "Purchase Date", type: "date" },
      { name: "Warranty Expires", type: "date" },
      { name: "Manual URL", type: "url", placeholder: "https://..." },
      { name: "Cost", type: "number" },
    ],
  },
  {
    id: "contractor-directory",
    name: "Contractor Directory",
    description: "Keep a directory of contractors, vendors, and service providers with contact info and ratings.",
    icon: "HardHat",
    category: "Directory",
    popularity: 1893,
    schema: [
      { name: "Name", type: "text", placeholder: "e.g., Joe's Plumbing" },
      { name: "Phone", type: "text", placeholder: "e.g., (518) 555-1234" },
      { name: "Email", type: "text", placeholder: "e.g., joe@plumbing.com" },
      { name: "Specialty", type: "select", options: ["Plumbing", "Electrical", "HVAC", "Painting", "Carpentry", "Landscaping", "Roofing", "General"] },
      { name: "Rating", type: "select", options: ["5 - Excellent", "4 - Good", "3 - Average", "2 - Below Average", "1 - Poor"] },
      { name: "Last Used", type: "date" },
      { name: "Notes", type: "text", placeholder: "Any notes about this contractor..." },
    ],
  },
  {
    id: "warranty-tracker",
    name: "Warranty Tracker",
    description: "Never miss a warranty expiration. Track coverage details and claim history.",
    icon: "ShieldCheck",
    category: "Tracking",
    popularity: 956,
    schema: [
      { name: "Item", type: "text", placeholder: "e.g., Roof, HVAC System" },
      { name: "Provider", type: "text", placeholder: "e.g., Home Depot, Manufacturer" },
      { name: "Coverage Type", type: "select", options: ["Full", "Parts Only", "Labor Only", "Extended"] },
      { name: "Start Date", type: "date" },
      { name: "Expiration Date", type: "date" },
      { name: "Claim Phone", type: "text", placeholder: "e.g., 1-800-..." },
      { name: "Policy Number", type: "text", placeholder: "e.g., WRN-12345" },
      { name: "Notes", type: "text", placeholder: "Claim history, exclusions..." },
    ],
  },
  {
    id: "home-inventory",
    name: "Home Inventory",
    description: "Document everything you own for insurance purposes with photos and values.",
    icon: "Package",
    category: "Inventory",
    popularity: 1534,
    schema: [
      { name: "Item", type: "text", placeholder: "e.g., Samsung 65\" TV" },
      { name: "Category", type: "select", options: ["Electronics", "Furniture", "Appliances", "Tools", "Jewelry", "Art", "Clothing", "Sports", "Other"] },
      { name: "Room", type: "select", options: ["Kitchen", "Bathroom", "Bedroom", "Living Room", "Garage", "Basement/Attic", "Office", "Dining Room"] },
      { name: "Purchase Date", type: "date" },
      { name: "Purchase Price", type: "number" },
      { name: "Current Value", type: "number" },
      { name: "Serial Number", type: "text", placeholder: "If applicable" },
      { name: "Notes", type: "text", placeholder: "Condition, receipt location..." },
    ],
  },
  {
    id: "key-tracker",
    name: "Key & Access Tracker",
    description: "Track who has keys, codes, and access to your property.",
    icon: "Key",
    category: "Tracking",
    popularity: 672,
    schema: [
      { name: "Item", type: "text", placeholder: "e.g., Front Door Key, Garage Code" },
      { name: "Type", type: "select", options: ["Physical Key", "Code/PIN", "Smart Lock", "Gate Remote", "Lockbox"] },
      { name: "Held By", type: "text", placeholder: "e.g., Neighbor (Jane), Dog Walker" },
      { name: "Location", type: "text", placeholder: "e.g., Front door, Side gate" },
      { name: "Code/Details", type: "text", placeholder: "e.g., 1234#" },
      { name: "Date Given", type: "date" },
      { name: "Notes", type: "text", placeholder: "Return date, restrictions..." },
    ],
  },
];

export function getTemplate(id: string): FeatureTemplate | undefined {
  return FEATURE_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category?: string): FeatureTemplate[] {
  const templates = category
    ? FEATURE_TEMPLATES.filter((t) => t.category === category)
    : FEATURE_TEMPLATES;
  return templates.sort((a, b) => b.popularity - a.popularity);
}
