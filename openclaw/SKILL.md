# TaskTracker — OpenClaw Skill

## Overview
Home maintenance task manager for Braim Rd, Saratoga Springs, NY.
Backed by Notion database "Braim Rd Maintenance."

## Capabilities

### Daily Digest (Cron: 8am EST daily)
Query Notion for:
- Tasks with Due Date ≤ 3 days from now
- Tasks with Due Date in the past (overdue) and Status ≠ Completed
- Tasks with Status = In Progress

Format as Telegram message:
```
Good morning! Here's your maintenance update:

🔴 Overdue:
• Fix leaky kitchen faucet (due Mar 28)

🟡 Due soon:
• Pool opening prep (due Apr 12)
• Gutter cleaning (due Apr 14)

🔵 In progress:
• Paint front porch

Total: X overdue, Y due soon, Z in progress
```

Skip if no tasks match. Max 1 message per day.

### Quick Add (Chat command)
User sends: "add task: <description>, <priority>"
Parse and create in Notion:
- Task name from description
- Priority: High/Medium/Low (default Medium)
- Status: Not Started
- Frequency: One-time

Reply: "✅ Created: <task name> (Priority: <priority>)"

### Photo Classification (Chat with photo)
User sends a photo via Telegram.
1. Run Claude Vision to classify: type, area, priority, cost estimate
2. Create task in Notion with classified fields
3. Reply: "📸 Created: <task> | Area: <area> | Priority: <priority> | Est. $<cost>"

### Seasonal Suggestions (Cron: 1st of each month)
Check seasonal rules for Saratoga Springs:
- Pool opening: Mar 25 – May 15
- Spring cleanup: Apr 1 – May 1
- AC service: April
- Lawn care: May – October
- Furnace service: September
- Pool closing: Sep 15 – Oct 15
- Fall cleanup / gutter cleaning: October
- Winterize: Oct 1 – Nov 1

Cross-reference with existing Notion tasks. Suggest missing seasonal tasks.
Format: "🌱 Spring reminder: Have you scheduled gutter cleaning and AC tune-up? Reply 'yes' to create these tasks."
If user replies "yes" → create the tasks in Notion.

## Notion API Configuration
- API Key: (set in OpenClaw environment)
- Database ID: 1e670ce0-a955-804c-959e-d2d96602f4dd
- Data Source ID: 1e670ce0-a955-8086-932c-000bb3aa423f

## Notion Schema
| Property | Type | Values |
|---|---|---|
| Task | title | required |
| Status | status | Not Started, In Progress, On Hold, Completed |
| Priority | select | High, Medium, Low |
| Area | select | Kitchen, Bathroom, Bedroom, Living Room, Garage, Exterior, Garden, Roof, Laundry, Basement/Attic, Driveway/Walkway, Fence |
| Type | multi_select | Plumbing, Electrical, Painting, Carpentry, Cleaning, Landscaping, HVAC, General Repair |
| Frequency | select | One-time, Monthly, Quarterly, Semi-annually, Annually |
| Due Date | date | supports ranges |
| Cost Estimate | number | USD |
