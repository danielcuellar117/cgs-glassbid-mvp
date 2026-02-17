import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProject } from "@/api/hooks/useProjects";
import { useCreateJob } from "@/api/hooks/useJobs";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { Upload as TusUpload } from "tus-js-client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { formatBytes } from "@/lib/utils";

type Step = "form" | "uploading" | "done" | "error";

export function NewProject() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const createJob = useCreateJob();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !file) return;

      try {
        // 1. Create project
        const project = await createProject.mutateAsync({
          name: name.trim(),
          clientName: clientName.trim() || undefined,
          address: address.trim() || undefined,
        });

        // 2. Create job (gets upload token)
        const job = await createJob.mutateAsync({
          projectId: project.id,
          originalFileName: file.name,
          originalFileSize: file.size,
        });

        setJobId(job.id);
        setStep("uploading");

        // 3. Upload via TUS
        const tusUpload = new TusUpload(file, {
          endpoint: "/files/",
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 50 * 1024 * 1024, // 50MB chunks
          metadata: {
            filename: file.name,
            filetype: file.type || "application/pdf",
            jobId: job.id,
            token: job.uploadToken ?? "",
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            setUploadedBytes(bytesUploaded);
            setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess: () => {
            setStep("done");
            setTimeout(() => navigate(`/jobs/${job.id}`), 1500);
          },
          onError: (err) => {
            setErrorMsg(err.message || "Upload failed");
            setStep("error");
          },
        });

        tusUpload.start();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to create project");
        setStep("error");
      }
    },
    [name, clientName, address, file, createProject, createJob, navigate],
  );

  if (step === "uploading") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Uploading PDF</h1>
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={40} className="animate-spin text-primary" />
            <p className="text-sm font-medium">{file?.name}</p>
            <div className="w-full">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{formatBytes(uploadedBytes)} uploaded</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Using TUS protocol. Upload will resume if interrupted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-600" />
          <h2 className="text-lg font-semibold text-green-900">Upload Complete!</h2>
          <p className="mt-1 text-sm text-green-700">Redirecting to pipeline status...</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle size={48} className="mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-semibold">Upload Failed</h2>
          <p className="mt-1 text-sm text-destructive">{errorMsg}</p>
          <button
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setStep("form");
              setErrorMsg("");
            }}
          >
            Try Again
          </button>
          {jobId && (
            <button
              className="ml-2 mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              onClick={() => navigate(`/jobs/${jobId}`)}
            >
              View Job
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-sm text-muted-foreground">
          Create a project and upload a PDF for processing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Project Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Oceanview Tower - Unit 42A"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Acme Construction"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Ocean Drive, Miami FL"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <label className="mb-3 block text-sm font-medium">
            Upload PDF <span className="text-destructive">*</span>
          </label>
          <FileDropzone
            onFileSelect={setFile}
            accept=".pdf"
            maxSize={10 * 1024 * 1024 * 1024}
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim() || !file || createProject.isPending}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createProject.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Creating...
            </span>
          ) : (
            "Create Project & Upload"
          )}
        </button>
      </form>
    </div>
  );
}
