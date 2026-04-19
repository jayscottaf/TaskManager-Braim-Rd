import OpenAI from "openai";
import type { Task, TaskType, Area, Priority } from "./types";
import { buildSeasonalContext } from "./seasonal";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "placeholder" });

export interface PrioritizedTask {
  id: string;
  reason: string;
}

export interface AISuggestion {
  task: string;
  area: string;
  types: string[];
  priority: string;
  reason: string;
}

export interface PhotoClassification {
  task: string;
  type: TaskType[];
  area: Area;
  priority: Priority;
  costEstimate: number;
  description: string;
}

async function chat(prompt: string, maxTokens = 2048): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

async function chatWithImage(
  prompt: string,
  imageBase64: string,
  mediaType: string,
  maxTokens = 1024
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${imageBase64}` },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function prioritizeTasks(
  tasks: Task[]
): Promise<PrioritizedTask[]> {
  const activeTasks = tasks.filter((t) => t.status !== "Completed");
  if (activeTasks.length === 0) return [];

  const seasonalContext = buildSeasonalContext();
  const taskList = activeTasks
    .map(
      (t) =>
        `- ID: ${t.id} | "${t.task}" | Status: ${t.status} | Priority: ${t.priority || "none"} | Area: ${t.area || "none"} | Type: ${t.type.join(", ") || "none"} | Due: ${t.dueDate?.start || "none"} | Frequency: ${t.frequency || "none"} | Cost: $${t.costEstimate || "?"}`
    )
    .join("\n");

  const text = await chat(`You are a home maintenance prioritization expert. Reorder these tasks by urgency.

${seasonalContext}

CURRENT TASKS:
${taskList}

Consider:
1. Overdue tasks are highest priority
2. Seasonal urgency (tasks in active seasonal windows)
3. Safety/damage prevention (water leaks, HVAC before extreme weather)
4. Frequency — flag tasks past their recurring schedule
5. Cost efficiency (cheaper preventive tasks before expensive reactive ones)

Return a JSON array of objects with "id" and "reason" (1 short sentence), ordered from most to least urgent. Only include active (non-completed) tasks. Return ONLY the JSON array, no other text.`);

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch {
    // Fall through
  }
  return activeTasks.map((t) => ({ id: t.id, reason: "Default order" }));
}

export async function suggestTasks(
  existingTasks: Task[]
): Promise<AISuggestion[]> {
  const seasonalContext = buildSeasonalContext();
  const existingNames = existingTasks.map((t) => t.task).join(", ");

  const text = await chat(`You are a home maintenance advisor for a property in Saratoga Springs, NY.

${seasonalContext}

EXISTING TASKS: ${existingNames || "none"}

Suggest 3-5 maintenance tasks that are NOT already in the list but should be, based on the current season and common home maintenance needs. Return a JSON array of objects with:
- "task": task name
- "area": one of Kitchen, Bathroom, Bedroom, Living Room, Garage, Exterior, Garden, Roof, Laundry, Basement/Attic, Driveway/Walkway, Fence
- "types": array from Plumbing, Electrical, Painting, Carpentry, Cleaning, Landscaping, HVAC, General Repair
- "priority": High, Medium, or Low
- "reason": why this task is timely (1 sentence)

Return ONLY the JSON array, no other text.`, 1024);

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch {
    // Fall through
  }
  return [];
}

export interface PaintLabelScan {
  brand: string;
  colorName: string;
  colorCode: string;
  finish: string;
  interiorExterior: string;
  size: string;
  base: string;
  colorantFormula: string;
  roomsUsed: string;
  store: string;
  purchaseDate: string;
}

export async function classifyPaintLabel(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<PaintLabelScan> {
  const text = await chatWithImage(
    `You are analyzing a photo of a paint can label. Extract as much information as possible.

Return a JSON object with these fields (use empty string "" if not visible):
- "brand": paint brand (e.g., "Behr", "Benjamin Moore", "Sherwin-Williams"). Look for brand logos or text like "Premium Plus" = Behr.
- "colorName": the color name (e.g., "Sorus", "Simply White")
- "colorCode": the color code (e.g., "3A60-3", "OC-117")
- "finish": one of "Flat", "Matte", "Eggshell", "Satin", "Semi-Gloss", "Gloss"
- "interiorExterior": one of "Interior", "Exterior", "Interior/Exterior"
- "size": one of "Sample", "Quart", "Gallon", "5 Gallon"
- "base": the base type and number (e.g., "Pastel Base (2500)", "Extra White")
- "colorantFormula": the colorant mix recipe. This is CRITICAL — a paint store needs this to remix the color.
  ALWAYS start with the column header row (e.g., "BAC COLORANT  OZ  32  64  128" or "COLORANT  OZ  48  96").
  Then each colorant on its own line, exactly as printed.
  Examples:
  Sherwin-Williams: "BAC COLORANT  OZ  32  64  128\nB1-Black  -  29  -  1\nG2-New Green  -  41  -  1\nY3-Deep Gold  -  26  1  1"
  Behr: "COLORANT  OZ  48  96\nAX Perm Yellow  0  24  0\nD Thalo Green  0  42  0\nI Brown Oxide  0  46  0"
  The header row tells the store which measurement columns are used. Without it the numbers are meaningless. Transcribe ALL rows including the header.
- "roomsUsed": any room labels written on the can (e.g., "Dining Rm", "Master Bed", "Office")
- "store": the store name and location if visible (e.g., "Home Depot, Saratoga Springs", "Sherwin Williams")
- "purchaseDate": date in YYYY-MM-DD format if visible (e.g., "2002-10-14")

Look carefully at:
1. The main label for brand, color name/code, finish, base
2. The mixing sticker for colorant formula — transcribe all columns exactly as printed
3. Any handwritten or stamped text on the can (usually room names like "OFFICE", "Dining Rm")
4. Store info and date on the label

Return ONLY the JSON object, no other text.`,
    imageBase64,
    mediaType,
    2048
  );

  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);

  return {
    brand: "",
    colorName: "",
    colorCode: "",
    finish: "",
    interiorExterior: "",
    size: "",
    base: "",
    colorantFormula: "",
    roomsUsed: "",
    store: "",
    purchaseDate: "",
  };
}

export async function classifyPhoto(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  userContext?: string
): Promise<PhotoClassification> {
  const contextBlock = userContext && userContext.trim().length > 0
    ? `USER CONTEXT (take this seriously — it describes the real situation the photo alone can't show):
"${userContext.trim()}"

Analyze the photo in light of this context. If the user says a prior issue is already fixed, focus on what remains. Let the context override what the photo might imply in isolation.

`
    : "";

  const text = await chatWithImage(
    `You are analyzing a photo of a home maintenance issue at a residential property in Saratoga Springs, NY.

${contextBlock}Classify this issue and return a JSON object with:
- "task": suggested task name (concise, e.g., "Fix leaky kitchen faucet")
- "type": array from [Plumbing, Electrical, Painting, Carpentry, Cleaning, Landscaping, HVAC, General Repair]
- "area": one of [Kitchen, Bathroom, Bedroom, Living Room, Garage, Exterior, Garden, Roof, Laundry, Basement/Attic, Driveway/Walkway, Fence]
- "priority": High, Medium, or Low
- "costEstimate": estimated repair cost in USD (number)
- "description": brief description of the issue (1-2 sentences)

Return ONLY the JSON object, no other text.`,
    imageBase64,
    mediaType
  );

  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);

  return {
    task: "Maintenance issue",
    type: ["General Repair"],
    area: "Exterior",
    priority: "Medium",
    costEstimate: 0,
    description: "Could not classify the image.",
  };
}

// --- Task Analysis ---

export interface TaskAnalysis {
  diyGuidance: {
    recommendation: "DIY" | "Hire a pro" | "Either works";
    reasoning: string;
    steps: string[];
    materials: string[];
  };
  costSanityCheck: {
    estimateIsReasonable: boolean;
    expectedRange: { low: number; high: number };
    note: string;
  };
  contractorAdvice: {
    tradeType: string;
    questionsToAsk: string[];
    redFlags: string[];
  };
}

export async function analyzeTask(task: Task): Promise<TaskAnalysis> {
  const costLine = task.costEstimate != null
    ? `Homeowner's current cost estimate: $${task.costEstimate}`
    : "Homeowner hasn't estimated a cost yet.";

  const prompt = `You are an experienced home-maintenance advisor for a residential property in Saratoga Springs, NY (typical 3BR home, ~$350K market value). Use current 2024-2026 pricing for this area.

Analyze this task and return a JSON object with three sections:

TASK:
- Name: "${task.task}"
- Area: ${task.area || "unspecified"}
- Type: ${task.type.join(", ") || "unspecified"}
- Priority: ${task.priority || "unspecified"}
- ${costLine}
- Notes: ${task.notes ? task.notes.slice(0, 500) : "(none)"}

Return a JSON object with:
{
  "diyGuidance": {
    "recommendation": "DIY" | "Hire a pro" | "Either works",
    "reasoning": "1-2 sentences on why",
    "steps": ["3-6 concise steps if DIY-viable; empty array if not"],
    "materials": ["materials and tools needed; empty array if not DIY"]
  },
  "costSanityCheck": {
    "estimateIsReasonable": true | false,
    "expectedRange": { "low": <number>, "high": <number> },
    "note": "1 sentence explaining the range"
  },
  "contractorAdvice": {
    "tradeType": "e.g., Licensed plumber, General handyman, HVAC technician",
    "questionsToAsk": ["3-5 specific vetting questions"],
    "redFlags": ["2-3 warning signs of a bad contractor for this job"]
  }
}

If the user hasn't provided a cost estimate, set estimateIsReasonable to true and put your own range. Return ONLY the JSON object.`;

  const text = await chat(prompt, 1500);
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as TaskAnalysis;
    } catch {
      // fall through to fallback
    }
  }

  return {
    diyGuidance: {
      recommendation: "Either works",
      reasoning: "Analysis unavailable — try regenerating.",
      steps: [],
      materials: [],
    },
    costSanityCheck: {
      estimateIsReasonable: true,
      expectedRange: { low: 0, high: 0 },
      note: "Unable to estimate.",
    },
    contractorAdvice: {
      tradeType: "General contractor",
      questionsToAsk: [],
      redFlags: [],
    },
  };
}

// --- Wish List Project Planner ---

export interface WishListPlan {
  project: string;
  description: string;
  plan: string;
  diyCost: number;
  hiredCost: number;
  valueAdd: number;
  diyRoi: number;
  hiredRoi: number;
  diyRoiRating: string;
  hiredRoiRating: string;
  diyDifficulty: string;
  category: string;
  priority: string;
  timeline: string;
  bestSeason: string;
}

export async function planWishListProject(
  description: string,
  imageBase64?: string,
  mediaType?: string
): Promise<WishListPlan> {
  const prompt = `You are a home improvement project planner for a residential property in Saratoga Springs, NY (typical 3BR home, ~$350K market value).

The homeowner wants to plan a future project. Based on their description${imageBase64 ? " and the attached photo" : ""}, create a detailed project plan.

HOMEOWNER'S DESCRIPTION: "${description}"

Return a JSON object with:
- "project": Clean, concise project name (e.g., "Belgium Block Driveway Border")
- "description": 1-2 sentence summary of the project
- "plan": Detailed step-by-step plan as a single string. Each step on its own line, numbered. Include materials needed, key considerations, and approximate timeline for each step.
- "diyCost": Cost if the homeowner does all labor themselves (materials, tools, tool rentals only). Use current 2024-2026 pricing for the Saratoga Springs, NY area.
- "hiredCost": Full contractor price including materials and labor for the Saratoga Springs, NY area. Use current 2024-2026 pricing.
- "valueAdd": Estimated increase in home resale value from this project. Be realistic — not all projects add value equal to their cost. This is the same regardless of who does the work.
- "diyRoi": ROI percentage for DIY calculated as (valueAdd / diyCost) × 100, rounded to nearest integer
- "hiredRoi": ROI percentage for hired out calculated as (valueAdd / hiredCost) × 100, rounded to nearest integer
- "diyRoiRating": Based on diyRoi — one of "High ROI" (roi > 100), "Good" (roi 50-100), "Low" (roi < 50), or "Lifestyle" (project primarily improves quality of life, not resale value)
- "hiredRoiRating": Based on hiredRoi — same thresholds as above
- "diyDifficulty": One of "Easy" (basic tools, anyone can do it — e.g., painting, simple landscaping), "Moderate" (some skill/experience needed — e.g., deck staining, basic tiling), "Hard" (experienced DIYer only — e.g., framing, concrete work), "Pro Only" (requires licensed contractor or specialized equipment — e.g., electrical panel, roofing, structural work)
- "category": One of "Landscaping", "Driveway", "Interior", "Exterior", "Roofing", "Plumbing", "Electrical", "General"
- "priority": "High", "Medium", or "Low" based on impact and urgency
- "timeline": One of "This Year", "Next Year", "2+ Years", "Someday"
- "bestSeason": One of "Spring", "Summer", "Fall", "Winter", "Any" — recommend the best time considering weather, contractor availability, and cost. Add a brief reason in parentheses.

Return ONLY the JSON object, no other text.`;

  let text: string;
  if (imageBase64 && mediaType) {
    text = await chatWithImage(prompt, imageBase64, mediaType, 4096);
  } else {
    text = await chat(prompt, 4096);
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    // Normalize — GPT sometimes returns plan as an array instead of a string
    if (Array.isArray(parsed.plan)) parsed.plan = parsed.plan.join("\n");
    if (Array.isArray(parsed.description)) parsed.description = parsed.description.join(" ");
    return parsed;
  }

  return {
    project: description.slice(0, 60),
    description: description,
    plan: "Could not generate a plan. Please try again with more detail.",
    diyCost: 0,
    hiredCost: 0,
    valueAdd: 0,
    diyRoi: 0,
    hiredRoi: 0,
    diyRoiRating: "Low",
    hiredRoiRating: "Low",
    diyDifficulty: "Moderate",
    category: "General",
    priority: "Medium",
    timeline: "Someday",
    bestSeason: "Any",
  };
}
