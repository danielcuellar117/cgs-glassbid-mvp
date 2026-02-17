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

/** Human-friendly labels for each pipeline step */
export const STEP_LABELS: Record<string, string> = {
  CREATED: "Created",
  UPLOADING: "Uploading",
  UPLOADED: "Uploaded",
  INDEXING: "Scanning Pages",
  ROUTING: "Classifying",
  EXTRACTING: "Extracting Items",
  NEEDS_REVIEW: "Needs Your Review",
  PRICING: "Calculating Prices",
  GENERATING: "Generating PDFs",
  DONE: "Complete",
  FAILED: "Failed",
};

/** Tooltip descriptions for each pipeline step */
export const STEP_DESCRIPTIONS: Record<string, string> = {
  CREATED: "Project created, ready to upload your PDF.",
  UPLOADING: "Your PDF is being uploaded to the server.",
  UPLOADED: "Upload complete. Queued for processing.",
  INDEXING: "AI is scanning each page of your PDF to understand the content.",
  ROUTING: "Identifying which pages contain glass specifications vs. other content.",
  EXTRACTING: "AI is reading dimensions, glass types, hardware, and quantities from the drawings.",
  NEEDS_REVIEW: "Items found! Please review and manually measure any missing dimensions.",
  PRICING: "Applying pricebook rules to calculate costs for each item.",
  GENERATING: "Creating your Bid Proposal and Shop Drawings PDFs.",
  DONE: "Your documents are ready to download!",
  FAILED: "Something went wrong. Check the error details below.",
};
