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
- "colorantFormula": the colorant mix recipe. Transcribe EXACTLY as shown on the label, preserving the brand's column format. Each colorant on its own line.
  Examples:
  Behr format:      "AX Perm Yellow  0 oz  24/48  0/96\nD Thalo Green  0 oz  42/48  0/96"
  Sherwin-Williams:  "B1-Black  - oz  29/32  -/64  1/128\nG2-New Green  - oz  41/32  -/64  1/128"
  Include the column headers if visible (e.g., "OZ 32 64 128" or "OZ 48 96"). The goal is for a paint store employee to be able to remix the exact color from this transcription.
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
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<PhotoClassification> {
  const text = await chatWithImage(
    `You are analyzing a photo of a home maintenance issue at a residential property in Saratoga Springs, NY.

Classify this issue and return a JSON object with:
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
