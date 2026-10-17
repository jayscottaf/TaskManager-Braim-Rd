export type Priority = "High" | "Medium" | "Low";
export type Status = "Not Started" | "In Progress" | "On Hold" | "Completed";
export type Area =
  | "Kitchen"
  | "Bathroom"
  | "Bedroom"
  | "Living Room"
  | "Garage"
  | "Exterior"
  | "Garden"
  | "Roof"
  | "Laundry"
  | "Basement/Attic"
  | "Driveway/Walkway"
  | "Fence";
export type TaskType =
  | "Plumbing"
  | "Electrical"
  | "Painting"
  | "Carpentry"
  | "Cleaning"
  | "Landscaping"
  | "HVAC"
  | "General Repair";
export type Frequency =
  | "One-time"
  | "Monthly"
  | "Quarterly"
  | "Semi-annually"
  | "Annually";

export interface Task {
  id: string;
  task: string;
  status: Status;
  priority: Priority | null;
  area: Area | null;
  subLocation: string | null;
  type: TaskType[];
  frequency: Frequency | null;
  dueDate: { start: string; end?: string } | null;
  dateCompleted: { start: string; end?: string } | null;
  isDeadline?: boolean;
  /** Internal recurrence metadata; never a user-facing classification. */
  recurrenceAnchor?: { start: string; end?: string } | null;
  nextOccurrencePending?: boolean;
  assignedTo: string[];
  contractorVendor: string | null;
  costEstimate: number | null;
  actualCost: number | null;
  notes: string | null;
  tags: string[];
  workMode: "DIY" | "Contractor" | null;
  createdTime: string;
}

export interface CreateTaskInput {
  task: string;
  status?: Status;
  priority?: Priority | null;
  area?: Area | null;
  subLocation?: string | null;
  type?: TaskType[];
  frequency?: Frequency | null;
  dueDate?: { start: string; end?: string } | null;
  isDeadline?: boolean;
  contractorVendor?: string | null;
  costEstimate?: number | null;
  notes?: string | null;
  tags?: string[];
  workMode?: "DIY" | "Contractor" | null;
}

export interface UpdateTaskInput {
  task?: string;
  status?: Status;
  priority?: Priority | null;
  area?: Area | null;
  subLocation?: string | null;
  type?: TaskType[];
  frequency?: Frequency | null;
  dueDate?: { start: string; end?: string } | null;
  isDeadline?: boolean;
  dateCompleted?: { start: string; end?: string } | null;
  contractorVendor?: string | null;
  costEstimate?: number | null;
  actualCost?: number | null;
  notes?: string | null;
  tags?: string[];
  workMode?: "DIY" | "Contractor" | null;
}

// Constant arrays for form dropdowns
export const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
export const STATUSES: Status[] = ["Not Started", "In Progress", "On Hold", "Completed"];
export const AREAS: Area[] = [
  "Kitchen", "Bathroom", "Bedroom", "Living Room", "Garage",
  "Exterior", "Garden", "Roof", "Laundry", "Basement/Attic",
  "Driveway/Walkway", "Fence",
];
export const TASK_TYPES: TaskType[] = [
  "Plumbing", "Electrical", "Painting", "Carpentry",
  "Cleaning", "Landscaping", "HVAC", "General Repair",
];
export const FREQUENCIES: Frequency[] = [
  "One-time", "Monthly", "Quarterly", "Semi-annually", "Annually",
];

export const PRIORITY_COLORS: Record<Priority, string> = {
  High: "bg-gray-100 text-gray-700 border-gray-200",
  Medium: "bg-gray-100 text-gray-600 border-gray-200",
  Low: "bg-gray-100 text-gray-600 border-gray-200",
};

export const STATUS_COLORS: Record<Status, string> = {
  "Not Started": "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "On Hold": "bg-gray-100 text-gray-600",
  "Completed": "bg-blue-100 text-blue-700",
};
