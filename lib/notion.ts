import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
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

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

// ── Helpers to read Notion properties ──────────────────────────────

function getTitle(page: PageObjectResponse): string {
  const prop = page.properties["Task"];
  if (prop.type === "title") return prop.title.map((t) => t.plain_text).join("");
  return "";
}

function getSelect(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop.type === "select") return prop.select?.name ?? null;
  return null;
}

function getStatus(page: PageObjectResponse): Status {
  const prop = page.properties["Status"];
  if (prop.type === "status") return (prop.status?.name as Status) ?? "Not Started";
  return "Not Started";
}

function getMultiSelect(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  if (prop.type === "multi_select") return prop.multi_select.map((o) => o.name);
  return [];
}

function getDate(
  page: PageObjectResponse,
  name: string
): { start: string; end?: string } | null {
  const prop = page.properties[name];
  if (prop.type === "date" && prop.date) {
    return {
      start: prop.date.start,
      ...(prop.date.end ? { end: prop.date.end } : {}),
    };
  }
  return null;
}

function getNumber(page: PageObjectResponse, name: string): number | null {
  const prop = page.properties[name];
  if (prop.type === "number") return prop.number;
  return null;
}

function getText(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop.type === "rich_text")
    return prop.rich_text.map((t) => t.plain_text).join("") || null;
  return null;
}

function getPeople(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  if (prop.type === "people") return prop.people.map((p) => p.id);
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
    assignedTo: getPeople(page, "Assigned To"),
    contractorVendor: getText(page, "Contractor/Vendor"),
    costEstimate: getNumber(page, "Cost Estimate"),
    actualCost: getNumber(page, "Actual Cost"),
    createdTime: page.created_time,
  };
}

// ── CRUD operations ────────────────────────────────────────────────

export interface GetTasksOptions {
  status?: Status;
  priority?: Priority;
  area?: Area;
}

export async function getTasks(options?: GetTasksOptions): Promise<Task[]> {
  const filters: QueryDatabaseParameters["filter"][] = [];

  if (options?.status) {
    filters.push({
      property: "Status",
      status: { equals: options.status },
    } as QueryDatabaseParameters["filter"]);
  }
  if (options?.priority) {
    filters.push({
      property: "Priority",
      select: { equals: options.priority },
    } as QueryDatabaseParameters["filter"]);
  }
  if (options?.area) {
    filters.push({
      property: "Area",
      select: { equals: options.area },
    } as QueryDatabaseParameters["filter"]);
  }

  const query: QueryDatabaseParameters = {
    database_id: databaseId,
    sorts: [{ property: "Due Date", direction: "ascending" }],
  };

  if (filters.length === 1) {
    query.filter = filters[0];
  } else if (filters.length > 1) {
    query.filter = { and: filters } as QueryDatabaseParameters["filter"];
  }

  const response = await notion.databases.query(query);
  return response.results
    .filter((p): p is PageObjectResponse => "properties" in p)
    .map(pageToTask);
}

export async function getTask(id: string): Promise<Task> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return pageToTask(page);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Task: { title: [{ text: { content: input.task } }] },
  };

  if (input.status) {
    properties["Status"] = { status: { name: input.status } };
  }
  if (input.priority) {
    properties["Priority"] = { select: { name: input.priority } };
  }
  if (input.area) {
    properties["Area"] = { select: { name: input.area } };
  }
  if (input.subLocation) {
    properties["Sub-location"] = {
      rich_text: [{ text: { content: input.subLocation } }],
    };
  }
  if (input.type && input.type.length > 0) {
    properties["Type"] = {
      multi_select: input.type.map((t) => ({ name: t })),
    };
  }
  if (input.frequency) {
    properties["Frequency"] = { select: { name: input.frequency } };
  }
  if (input.dueDate) {
    properties["Due Date"] = {
      date: { start: input.dueDate.start, end: input.dueDate.end ?? null },
    };
  }
  if (input.contractorVendor) {
    properties["Contractor/Vendor"] = {
      rich_text: [{ text: { content: input.contractorVendor } }],
    };
  }
  if (input.costEstimate !== undefined) {
    properties["Cost Estimate"] = { number: input.costEstimate };
  }

  const page = (await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  })) as PageObjectResponse;

  return pageToTask(page);
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (input.task !== undefined) {
    properties["Task"] = { title: [{ text: { content: input.task } }] };
  }
  if (input.status !== undefined) {
    properties["Status"] = { status: { name: input.status } };
  }
  if (input.priority !== undefined) {
    properties["Priority"] = { select: { name: input.priority } };
  }
  if (input.area !== undefined) {
    properties["Area"] = { select: { name: input.area } };
  }
  if (input.subLocation !== undefined) {
    properties["Sub-location"] = {
      rich_text: [{ text: { content: input.subLocation } }],
    };
  }
  if (input.type !== undefined) {
    properties["Type"] = {
      multi_select: input.type.map((t) => ({ name: t })),
    };
  }
  if (input.frequency !== undefined) {
    properties["Frequency"] = { select: { name: input.frequency } };
  }
  if (input.dueDate !== undefined) {
    properties["Due Date"] = input.dueDate
      ? { date: { start: input.dueDate.start, end: input.dueDate.end ?? null } }
      : { date: null };
  }
  if (input.dateCompleted !== undefined) {
    properties["Date Completed"] = input.dateCompleted
      ? { date: { start: input.dateCompleted.start, end: input.dateCompleted.end ?? null } }
      : { date: null };
  }
  if (input.contractorVendor !== undefined) {
    properties["Contractor/Vendor"] = {
      rich_text: [{ text: { content: input.contractorVendor } }],
    };
  }
  if (input.costEstimate !== undefined) {
    properties["Cost Estimate"] = { number: input.costEstimate };
  }
  if (input.actualCost !== undefined) {
    properties["Actual Cost"] = { number: input.actualCost };
  }

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return pageToTask(page);
}

export async function deleteTask(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}
