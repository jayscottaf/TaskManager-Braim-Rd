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
  assignedTo: string[];
  contractorVendor: string | null;
  costEstimate: number | null;
  actualCost: number | null;
  notes: string | null;
  createdTime: string;
}

export interface CreateTaskInput {
  task: string;
  status?: Status;
  priority?: Priority;
  area?: Area;
  subLocation?: string;
  type?: TaskType[];
  frequency?: Frequency;
  dueDate?: { start: string; end?: string };
  contractorVendor?: string;
  costEstimate?: number;
  notes?: string;
}

export interface UpdateTaskInput {
  task?: string;
  status?: Status;
  priority?: Priority;
  area?: Area;
  subLocation?: string;
  type?: TaskType[];
  frequency?: Frequency;
  dueDate?: { start: string; end?: string } | null;
  dateCompleted?: { start: string; end?: string } | null;
  contractorVendor?: string;
  costEstimate?: number;
  actualCost?: number;
  notes?: string;
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
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low: "bg-green-100 text-green-700 border-green-200",
};

export const STATUS_COLORS: Record<Status, string> = {
  "Not Started": "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "On Hold": "bg-orange-100 text-orange-700",
  "Completed": "bg-green-100 text-green-700",
};
