export const API_BASE = "/api";
export const TUS_ENDPOINT = "/files/";

export const JOB_STATES = [
  "CREATED",
  "UPLOADING",
  "UPLOADED",
  "INDEXING",
  "ROUTING",
  "EXTRACTING",
  "NEEDS_REVIEW",
  "PRICING",
  "GENERATING",
  "DONE",
  "FAILED",
] as const;

export type JobState = (typeof JOB_STATES)[number];

export const JOB_STATE_COLORS: Record<JobState, string> = {
  CREATED: "bg-gray-100 text-gray-800",
  UPLOADING: "bg-blue-100 text-blue-800",
  UPLOADED: "bg-blue-100 text-blue-800",
  INDEXING: "bg-sky-100 text-sky-800",
  ROUTING: "bg-cyan-100 text-cyan-800",
  EXTRACTING: "bg-indigo-100 text-indigo-800",
  NEEDS_REVIEW: "bg-orange-100 text-orange-800",
  PRICING: "bg-violet-100 text-violet-800",
  GENERATING: "bg-purple-100 text-purple-800",
  DONE: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export const PIPELINE_STEPS: JobState[] = [
  "CREATED",
  "UPLOADING",
  "UPLOADED",
  "INDEXING",
  "ROUTING",
  "EXTRACTING",
  "NEEDS_REVIEW",
  "PRICING",
  "GENERATING",
  "DONE",
];
