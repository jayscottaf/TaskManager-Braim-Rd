import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { checkAuth } from "@/lib/auth";
import { getTemplate } from "@/lib/feature-templates";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const dbId = request.nextUrl.searchParams.get("dbId");
    if (!dbId) return NextResponse.json({ error: "dbId required" }, { status: 400 });

    const showArchived = request.nextUrl.searchParams.get("archived") === "true";

    const template = getTemplate(id);
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // Filter by _Status if the property exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryOpts: any = { database_id: dbId };

    if (!showArchived) {
      // Show only active items (or items without a _Status field for backwards compat)
      queryOpts.filter = {
        or: [
          { property: "_Status", select: { equals: "Active" } },
          { property: "_Status", select: { is_empty: true } },
        ],
      };
    }

    let response;
    try {
      response = await notion.databases.query(queryOpts);
    } catch {
      // If filter fails (e.g. _Status property doesn't exist), query without filter
      response = await notion.databases.query({ database_id: dbId });
    }

    const items = response.results
      .filter((p): p is PageObjectResponse => "properties" in p)
      .map((page) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields: Record<string, any> = { id: page.id };

        // Read _Status
        const statusProp = page.properties["_Status"];
        if (statusProp && statusProp.type === "select") {
          fields._status = statusProp.select?.name ?? "Active";
        } else {
          fields._status = "Active";
        }

        for (const field of template.schema) {
          const prop = page.properties[field.name];
          if (!prop) { fields[field.name] = null; continue; }
          switch (prop.type) {
            case "title":
              fields[field.name] = prop.title.map((t) => t.plain_text).join("");
              break;
            case "rich_text":
              fields[field.name] = prop.rich_text.map((t) => t.plain_text).join("");
              break;
            case "number":
              fields[field.name] = prop.number;
              break;
            case "select":
              fields[field.name] = prop.select?.name ?? null;
              break;
            case "date":
              fields[field.name] = prop.date?.start ?? null;
              break;
            case "url":
              fields[field.name] = prop.url;
              break;
            default:
              fields[field.name] = null;
          }
        }
        return fields;
      });

    // When not showing archived, filter out any that slipped through
    const filtered = showArchived ? items : items.filter((i) => i._status !== "Archived");

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Feature items GET error:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { dbId, ...data } = body;

    if (!dbId) return NextResponse.json({ error: "dbId required" }, { status: 400 });

    const template = getTemplate(id);
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};
    for (let i = 0; i < template.schema.length; i++) {
      const field = template.schema[i];
      const value = data[field.name];
      if (value === undefined || value === null || value === "") continue;

      if (i === 0) {
        properties[field.name] = { title: [{ text: { content: String(value) } }] };
      } else {
        switch (field.type) {
          case "text":
          case "textarea":
            properties[field.name] = { rich_text: [{ text: { content: String(value) } }] };
            break;
          case "number":
            properties[field.name] = { number: Number(value) };
            break;
          case "select":
            properties[field.name] = { select: { name: String(value) } };
            break;
          case "date":
            properties[field.name] = { date: { start: String(value) } };
            break;
          case "url":
            properties[field.name] = { url: String(value) };
            break;
        }
      }
    }

    // Set _Status to Active (silently skip if property doesn't exist)
    properties["_Status"] = { select: { name: "Active" } };

    let page;
    try {
      page = await notion.pages.create({
        parent: { database_id: dbId },
        properties,
      });
    } catch {
      // If _Status property doesn't exist, retry without it
      delete properties["_Status"];
      page = await notion.pages.create({
        parent: { database_id: dbId },
        properties,
      });
    }

    return NextResponse.json({ id: page.id }, { status: 201 });
  } catch (error) {
    console.error("Feature items POST error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create item: ${msg}` }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { pageId, _action, ...data } = body;

    if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

    // Handle archive/restore actions
    if (_action === "archive" || _action === "restore") {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          "_Status": { select: { name: _action === "archive" ? "Archived" : "Active" } },
        },
      });
      return NextResponse.json({ success: true });
    }

    const template = getTemplate(id);
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};
    for (let i = 0; i < template.schema.length; i++) {
      const field = template.schema[i];
      const value = data[field.name];
      if (value === undefined) continue;

      if (i === 0) {
        properties[field.name] = { title: [{ text: { content: String(value || "") } }] };
      } else if (value === null || value === "") {
        switch (field.type) {
          case "text": case "textarea": properties[field.name] = { rich_text: [] }; break;
          case "number": properties[field.name] = { number: null }; break;
          case "select": properties[field.name] = { select: null }; break;
          case "date": properties[field.name] = { date: null }; break;
          case "url": properties[field.name] = { url: null }; break;
        }
      } else {
        switch (field.type) {
          case "text":
          case "textarea":
            properties[field.name] = { rich_text: [{ text: { content: String(value) } }] };
            break;
          case "number":
            properties[field.name] = { number: Number(value) };
            break;
          case "select":
            properties[field.name] = { select: { name: String(value) } };
            break;
          case "date":
            properties[field.name] = { date: { start: String(value) } };
            break;
          case "url":
            properties[field.name] = { url: String(value) };
            break;
        }
      }
    }

    await notion.pages.update({ page_id: pageId, properties });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feature items PATCH error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to update item: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    await params;
    const { pageId } = await request.json();

    if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

    // Permanently archive in Notion (moves to trash, recoverable for 30 days)
    await notion.pages.update({
      page_id: pageId,
      archived: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feature items DELETE error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to delete item: ${msg}` }, { status: 500 });
  }
}
