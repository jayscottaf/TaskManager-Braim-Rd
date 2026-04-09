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
