-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('CREATED', 'UPLOADING', 'UPLOADED', 'INDEXING', 'INDEXED', 'ROUTING', 'ROUTED', 'EXTRACTING', 'EXTRACTED', 'NEEDS_REVIEW', 'REVIEWED', 'PRICING', 'PRICED', 'GENERATING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "MeasurementTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RenderRequestKind" AS ENUM ('THUMB', 'MEASURE');

-- CreateEnum
CREATE TYPE "RenderRequestStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('IDLE', 'PROCESSING', 'PAUSED');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "project_id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'CREATED',
    "ssot" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "error_code" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "idempotency_key" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "next_run_at" TIMESTAMP(3),
    "stage_progress" JSONB,
    "upload_token" TEXT,
    "upload_token_exp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_tasks" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "dimension_key" TEXT NOT NULL,
    "status" "MeasurementTaskStatus" NOT NULL DEFAULT 'PENDING',
    "page_num" INTEGER NOT NULL,
    "calibration_json" JSONB,
    "measured_value" DOUBLE PRECISION,
    "measured_by" TEXT,
    "measured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricebook_versions" (
    "id" TEXT NOT NULL,
    "version" SERIAL NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricebook_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "pricebook_version_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "formula_json" JSONB NOT NULL,
    "applies_to" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "job_id" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "diff_json" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_objects" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "sha256" TEXT,
    "content_type" TEXT,
    "ttl_policy" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_requests" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "page_num" INTEGER NOT NULL,
    "kind" "RenderRequestKind" NOT NULL,
    "dpi" INTEGER NOT NULL DEFAULT 72,
    "status" "RenderRequestStatus" NOT NULL DEFAULT 'PENDING',
    "output_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "render_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_template_map" (
    "id" TEXT NOT NULL,
    "configuration" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "configuration_template_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "worker_id" TEXT NOT NULL,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'IDLE',
    "current_job_id" TEXT,
    "memory_usage_mb" DOUBLE PRECISION,
    "disk_usage_pct" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("worker_id")
);

-- CreateIndex
CREATE INDEX "idx_jobs_claimable" ON "jobs"("status", "next_run_at", "locked_at", "created_at");

-- CreateIndex
CREATE INDEX "idx_jobs_project" ON "jobs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_storage_objects_expiry" ON "storage_objects"("expires_at");

-- CreateIndex
CREATE INDEX "idx_render_requests_pending" ON "render_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "render_requests_job_id_page_num_kind_key" ON "render_requests"("job_id", "page_num", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_template_map_configuration_key" ON "configuration_template_map"("configuration");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_tasks" ADD CONSTRAINT "measurement_tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_pricebook_version_id_fkey" FOREIGN KEY ("pricebook_version_id") REFERENCES "pricebook_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_requests" ADD CONSTRAINT "render_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

