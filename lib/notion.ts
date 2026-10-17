import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
  UpdatePageParameters,
  CreatePageParameters,
  UpdateDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Priority,
  Status,
  Area,
  TaskType,
  Frequency,
} from "./types";
import { getOrLoadCached, clearCache, clearCachePrefix, CACHE_TTL } from "./cache";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

// Notion rich_text blocks cap at 2000 chars each. Split long content across blocks.
function richTextChunks(text: string): { text: { content: string } }[] {
  const MAX = 2000;
  if (text.length <= MAX) return [{ text: { content: text } }];
  const chunks: { text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += MAX) {
    chunks.push({ text: { content: text.slice(i, i + MAX) } });
  }
  return chunks;
}

// ── Helpers to read Notion properties ──────────────────────────────

function getTitle(page: PageObjectResponse): string {
  const prop = page.properties["Task"];
  if (prop?.type === "title") return prop.title.map((t) => t.plain_text).join("");
  return "";
}

function getSelect(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop?.type === "select") return prop.select?.name ?? null;
  return null;
}

function getStatus(page: PageObjectResponse): Status {
  const prop = page.properties["Status"];
  if (prop?.type === "status") return (prop.status?.name as Status) ?? "Not Started";
  return "Not Started";
}

function getMultiSelect(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  if (prop?.type === "multi_select") return prop.multi_select.map((o) => o.name);
  return [];
}

function getDate(
  page: PageObjectResponse,
  name: string
): { start: string; end?: string } | null {
  const prop = page.properties[name];
  if (prop?.type === "date" && prop.date) {
    return {
      start: prop.date.start,
      ...(prop.date.end ? { end: prop.date.end } : {}),
    };
  }
  return null;
}

function getNumber(page: PageObjectResponse, name: string): number | null {
  const prop = page.properties[name];
  if (prop?.type === "number") return prop.number;
  return null;
}

function getText(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (!prop) return null;
  if (prop.type === "rich_text")
    return prop.rich_text.map((t) => t.plain_text).join("") || null;
  return null;
}

function getPeople(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  if (prop?.type === "people") return prop.people.map((p) => p.id);
  return [];
}

// ── Map Notion page → Task ─────────────────────────────────────────

function pageToTask(page: PageObjectResponse): Task {
  return {
    id: page.id,
    task: getTitle(page),
    status: getStatus(page),
    priority: getSelect(page, "Priority") as Priority | null,
    area: getSelect(page, "Area") as Area | null,
    subLocation: getText(page, "Sub-location"),
    type: getMultiSelect(page, "Type") as TaskType[],
    frequency: getSelect(page, "Frequency") as Frequency | null,
    dueDate: getDate(page, "Due Date"),
    dateCompleted: getDate(page, "Date Completed"),
    isDeadline: page.properties["Firm Deadline"]?.type === "checkbox" ? page.properties["Firm Deadline"].checkbox : false,
    recurrenceAnchor: getDate(page, "Recurrence Anchor"),
    nextOccurrencePending: page.properties["Next Occurrence Pending"]?.type === "checkbox" ? page.properties["Next Occurrence Pending"].checkbox : false,
    assignedTo: getPeople(page, "Assigned To"),
    contractorVendor: getText(page, "Contractor/Vendor"),
    costEstimate: getNumber(page, "Cost Estimate"),
    actualCost: getNumber(page, "Actual Cost"),
    notes: getText(page, "Notes"),
    tags: getMultiSelect(page, "Tags"),
    workMode: getSelect(page, "Work Mode") as "DIY" | "Contractor" | null,
    createdTime: page.created_time,
  };
}

// ── CRUD operations ────────────────────────────────────────────────

export interface GetTasksOptions {
  status?: Status;
  priority?: Priority;
  area?: Area;
  excludeCompleted?: boolean;
  /** Mutation recovery must not rely on a process-local cached snapshot. */
  bypassCache?: boolean;
}

function tasksCacheKey(options?: GetTasksOptions): string {
  return `tasks:${[options?.status ?? "", options?.priority ?? "", options?.area ?? "", options?.excludeCompleted ? "xc" : ""].join("|")}`;
}

function invalidateTasksCache(id?: string, removeAnalysis = false): void {
  clearCachePrefix("tasks:");
  clearCache("ai-prioritize");
  clearCache("ai-suggest");
  clearCachePrefix("start-my-day:");
  if (id) {
    clearCache(`task:${id}`);
    // Analysis keys include their user-authored inputs, so ordinary saves can reuse them.
    if (removeAnalysis) clearCachePrefix(`ai-analyze:${id}:`);
  }
}

export async function getTasks(options?: GetTasksOptions): Promise<Task[]> {
  const load = async () => {
    const filters: Extract<NonNullable<QueryDatabaseParameters["filter"]>, { property: string }>[] = [];
    if (options?.status) filters.push({ property: "Status", status: { equals: options.status } });
    else if (options?.excludeCompleted) filters.push({ property: "Status", status: { does_not_equal: "Completed" } });
    if (options?.priority) filters.push({ property: "Priority", select: { equals: options.priority } });
    if (options?.area) filters.push({ property: "Area", select: { equals: options.area } });
    const query: QueryDatabaseParameters = {
      database_id: databaseId,
      page_size: 100,
      sorts: [{ property: "Due Date", direction: "ascending" }],
      ...(filters.length === 1 ? { filter: filters[0] } : filters.length > 1 ? { filter: { and: filters } } : {}),
    };
    const tasks: Task[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const response = await notion.databases.query({ ...query, ...(cursor ? { start_cursor: cursor } : {}) });
      for (const page of response.results) {
        if (page.object === "page" && "properties" in page && !seen.has(page.id)) {
          tasks.push(pageToTask(page));
          seen.add(page.id);
        }
      }
      if (!response.has_more) break;
      if (!response.next_cursor || response.next_cursor === cursor) throw new Error("Task pagination did not advance");
      cursor = response.next_cursor;
    } while (cursor);
    return tasks;
  };
  return options?.bypassCache ? load() : getOrLoadCached(tasksCacheKey(options), CACHE_TTL.TASK_LIST, load);
}

export async function getTask(id: string, options?: { bypassCache?: boolean }): Promise<Task> {
  const load = async () => {
    const page = await notion.pages.retrieve({ page_id: id });
    if (!("properties" in page) || page.archived) throw new Error("Task not found");
    return pageToTask(page);
  };
  return options?.bypassCache ? load() : getOrLoadCached(`task:${id}`, 0, load);
}

type TaskProperties = NonNullable<UpdatePageParameters["properties"]>;
type TaskDate = NonNullable<Task["dueDate"]>;

function taskProperties(input: CreateTaskInput | UpdateTaskInput): TaskProperties {
  const properties: TaskProperties = {};
  if (input.task !== undefined) properties.Task = { title: [{ text: { content: input.task } }] };
  if (input.status !== undefined) properties.Status = { status: { name: input.status } };
  if (input.priority !== undefined) properties.Priority = { select: input.priority ? { name: input.priority } : null };
  if (input.area !== undefined) properties.Area = { select: input.area ? { name: input.area } : null };
  if (input.subLocation !== undefined) properties["Sub-location"] = { rich_text: input.subLocation ? richTextChunks(input.subLocation) : [] };
  if (input.type !== undefined) properties.Type = { multi_select: input.type.map((name) => ({ name })) };
  if (input.frequency !== undefined) properties.Frequency = { select: input.frequency ? { name: input.frequency } : null };
  if (input.dueDate !== undefined) {
    properties["Due Date"] = { date: input.dueDate ? { start: input.dueDate.start, end: input.dueDate.end ?? null } : null };
  }
  if (input.dueDate === null) properties["Firm Deadline"] = { checkbox: false };
  else if (input.isDeadline !== undefined) properties["Firm Deadline"] = { checkbox: input.isDeadline };
  if ("dateCompleted" in input && input.dateCompleted !== undefined) properties["Date Completed"] = { date: input.dateCompleted ? { start: input.dateCompleted.start, end: input.dateCompleted.end ?? null } : null };
  if (input.contractorVendor !== undefined) properties["Contractor/Vendor"] = { rich_text: input.contractorVendor ? richTextChunks(input.contractorVendor) : [] };
  if (input.costEstimate !== undefined) properties["Cost Estimate"] = { number: input.costEstimate };
  if ("actualCost" in input && input.actualCost !== undefined) properties["Actual Cost"] = { number: input.actualCost };
  if (input.notes !== undefined) properties.Notes = { rich_text: input.notes ? richTextChunks(input.notes) : [] };
  if (input.tags !== undefined) properties.Tags = { multi_select: input.tags.map((name) => ({ name })) };
  if (input.workMode !== undefined) properties["Work Mode"] = { select: input.workMode ? { name: input.workMode } : null };
  return properties;
}

export async function createTask(input: CreateTaskInput, recurrence?: { sourceId: string; anchor: TaskDate }, internal?: { wishlistSourceId?: string }): Promise<Task> {
  await ensureNotesProperty({ strict: true });
  const properties = taskProperties(input);
  if (input.dueDate) properties["Recurrence Anchor"] = { date: { start: input.dueDate.start, end: input.dueDate.end ?? null } };
  if (input.status === "Completed") properties["Date Completed"] = { date: { start: new Date().toISOString().slice(0, 10) } };
  if (internal?.wishlistSourceId) properties["Wishlist Source"] = { rich_text: richTextChunks(internal.wishlistSourceId) };
  if (recurrence) {
    properties["Recurrence Source"] = { rich_text: richTextChunks(recurrence.sourceId) };
    properties["Recurrence Anchor"] = { date: { start: recurrence.anchor.start, end: recurrence.anchor.end ?? null } };
  }
  const page = await notion.pages.create({ parent: { database_id: databaseId }, properties: properties as CreatePageParameters["properties"] }).finally(() => invalidateTasksCache());
  if (!("properties" in page)) throw new Error("Task was created but could not be read");
  return pageToTask(page);
}

export async function updateTask(id: string, input: UpdateTaskInput, internal?: { nextOccurrencePending?: boolean; currentTask?: Task }): Promise<Task> {
  await ensureNotesProperty({ strict: true });
  const properties = taskProperties(input);
  if (input.dueDate !== undefined) {
    const current = internal?.currentTask ?? await getTask(id, { bypassCache: true });
    if (input.dueDate?.start !== current.dueDate?.start || input.dueDate?.end !== current.dueDate?.end) {
      properties["Recurrence Anchor"] = { date: input.dueDate ? { start: input.dueDate.start, end: input.dueDate.end ?? null } : null };
    }
  }
  if (internal?.nextOccurrencePending !== undefined) properties["Next Occurrence Pending"] = { checkbox: internal.nextOccurrencePending };
  const page = await notion.pages.update({ page_id: id, properties }).finally(() => invalidateTasksCache(id));
  if (!("properties" in page)) throw new Error("Task was saved but could not be read");
  return pageToTask(page);
}

/** Query persisted identity to recover after a lost response or failed completion retry. */
export async function findNextOccurrence(sourceId: string): Promise<Task | null> {
  await ensureNotesProperty({ strict: true });
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: { property: "Recurrence Source", rich_text: { equals: sourceId } },
    page_size: 1,
  });
  const page = response.results.find((result): result is PageObjectResponse => result.object === "page" && "properties" in result && !result.archived);
  return page ? pageToTask(page) : null;
}

/** Fresh promotion recovery lookup; legacy markers remain readable during rollout. */
export async function findWishlistTask(sourceId: string): Promise<Task | null> {
  await ensureNotesProperty({ strict: true });
  const query = async (property: string, rich_text: { equals: string } | { contains: string }) => {
    const response = await notion.databases.query({ database_id: databaseId, filter: { property, rich_text }, page_size: 1 });
    const page = response.results.find((result): result is PageObjectResponse => result.object === "page" && "properties" in result && !result.archived);
    return page ? pageToTask(page) : null;
  };
  return await query("Wishlist Source", { equals: sourceId }) ?? await query("Notes", { contains: `[wishlist-source:${sourceId}]` });
}

export async function deleteTask(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true }).finally(() => invalidateTasksCache(id, true));
}

/** Serialize writes for one task in this process. Notion has no cross-instance transaction. */
const taskMutations = new Map<string, Promise<unknown>>();
export async function withTaskMutation<T>(id: string, mutation: () => Promise<T>): Promise<T> {
  const previous = taskMutations.get(id) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(mutation);
  taskMutations.set(id, pending);
  try {
    return await pending;
  } finally {
    if (taskMutations.get(id) === pending) taskMutations.delete(id);
  }
}

// Extend existing databases lazily. Read pages can still render if setup is unavailable;
// writes require schema readiness so a missing checkbox cannot silently lose intent.
export async function ensureNotesProperty(options?: { strict?: boolean }): Promise<void> {
  try {
    await getOrLoadCached("schema:tasks", CACHE_TTL.SCHEMA_SYNC, async () => {
      const db = await notion.databases.retrieve({ database_id: databaseId });
      if (!("properties" in db)) throw new Error("Task database is unavailable");
      const missing: NonNullable<UpdateDatabaseParameters["properties"]> = {};
      if (!db.properties.Notes) missing.Notes = { rich_text: {} };
      if (!db.properties.Tags) missing.Tags = { multi_select: { options: [] } };
      if (!db.properties["Work Mode"]) missing["Work Mode"] = { select: { options: [{ name: "DIY" }, { name: "Contractor" }] } };
      if (!db.properties["Firm Deadline"]) missing["Firm Deadline"] = { checkbox: {} };
      if (!db.properties["Wishlist Source"]) missing["Wishlist Source"] = { rich_text: {} };
      if (!db.properties["Recurrence Source"]) missing["Recurrence Source"] = { rich_text: {} };
      if (!db.properties["Recurrence Anchor"]) missing["Recurrence Anchor"] = { date: {} };
      if (!db.properties["Next Occurrence Pending"]) missing["Next Occurrence Pending"] = { checkbox: {} };
      if (Object.keys(missing).length) await notion.databases.update({ database_id: databaseId, properties: missing });
      return true;
    });
  } catch (error) {
    if (options?.strict) throw error;
    console.error("Task property setup failed:", error);
  }
}
