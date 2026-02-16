import { useParams, useNavigate, Link } from "react-router-dom";
import { useProject, useUpdateProject } from "@/api/hooks/useProjects";
import { useJobs } from "@/api/hooks/useJobs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { formatDate, formatBytes } from "@/lib/utils";
import { Loader2, Plus, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import type { Job } from "@/api/hooks/useProjects";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id!);
  const { data: jobs } = useJobs(id);
  const updateProject = useUpdateProject();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editAddress, setEditAddress] = useState("");

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function startEdit() {
    setEditName(project!.name);
    setEditClient(project!.clientName ?? "");
    setEditAddress(project!.address ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    await updateProject.mutateAsync({
      id: project!.id,
      name: editName,
      clientName: editClient || undefined,
      address: editAddress || undefined,
    });
    setEditing(false);
  }

  const jobColumns: Column<Job>[] = [
    {
      key: "id",
      header: "Job ID",
      render: (row) => (
        <span className="font-mono text-xs">{row.id.slice(0, 8)}...</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "originalFileName",
      header: "File",
      render: (row) => (
        <span className="text-sm">{row.originalFileName ?? "—"}</span>
      ),
    },
    {
      key: "originalFileSize",
      header: "Size",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.originalFileSize ? formatBytes(row.originalFileSize) : "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div className="rounded-lg border border-border bg-card p-6">
        {editing ? (
          <div className="space-y-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={editClient}
              onChange={(e) => setEditClient(e.target.value)}
              placeholder="Client name"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="Address"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Check size={14} /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              {project.clientName && (
                <p className="mt-1 text-sm text-muted-foreground">{project.clientName}</p>
              )}
              {project.address && (
                <p className="text-sm text-muted-foreground">{project.address}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Created {formatDate(project.createdAt)}
              </p>
            </div>
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Pencil size={14} /> Edit
            </button>
          </div>
        )}
      </div>

      {/* Jobs */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Jobs</h2>
        <Link
          to="/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus size={14} /> Upload New PDF
        </Link>
      </div>

      <DataTable
        data={(jobs ?? []) as unknown as Record<string, unknown>[]}
        columns={jobColumns as unknown as Column<Record<string, unknown>>[]}
        keyExtractor={(row) => String(row.id)}
        onRowClick={(row) => navigate(`/jobs/${row.id}`)}
        emptyMessage="No jobs yet. Upload a PDF to create one."
      />
    </div>
  );
}
