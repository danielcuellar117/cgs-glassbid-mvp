import { useNavigate, Link } from "react-router-dom";
import { useProjects } from "@/api/hooks/useProjects";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { Plus, FolderOpen, Loader2, Search, X, Upload, ScanSearch, ClipboardCheck, DollarSign, FileDown } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

const WELCOME_DISMISSED_KEY = "glassbid_welcome_dismissed";

const WORKFLOW_STEPS = [
  { icon: Upload, label: "Upload", desc: "Upload your architectural PDF drawings" },
  { icon: ScanSearch, label: "Extract", desc: "AI automatically finds glass items, dimensions & specs" },
  { icon: ClipboardCheck, label: "Review", desc: "Verify extracted data and measure any missing dimensions" },
  { icon: DollarSign, label: "Price", desc: "System calculates pricing using your pricebook rules" },
  { icon: FileDown, label: "Download", desc: "Get your Bid Proposal and Shop Drawings PDFs" },
];

export function Dashboard() {
  const { data: projects, isLoading, error } = useProjects();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem(WELCOME_DISMISSED_KEY) !== "true",
  );

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)),
    );
  }, [projects, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Failed to load projects. Is the API running?</p>
        <p className="mt-1 text-xs text-muted-foreground">{String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      {showWelcome && (
        <div className="relative rounded-lg border border-primary/20 bg-primary/5 p-5">
          <button
            onClick={dismissWelcome}
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
          <h2 className="text-lg font-semibold text-foreground">Welcome to GlassBid!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's how the system works in 5 simple steps:
          </p>
          <div className="mt-4 grid grid-cols-5 gap-3">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center text-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    {i + 1}. {step.label}
                  </span>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <Plus size={16} /> Get Started &mdash; New Project
            </Link>
            <button
              onClick={dismissWelcome}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Got it, don't show again
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage glass proposal projects and track their pipeline status.
          </p>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, client, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Project grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FolderOpen size={40} className="mb-3 text-muted-foreground" />
          <h3 className="text-lg font-medium">No projects yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to get started.
          </p>
          <Link
            to="/projects/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus size={16} />
            New Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const latestJob = project.jobs?.[0];
            return (
              <div
                key={project.id}
                className="group cursor-pointer rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  {latestJob && <StatusBadge status={latestJob.status} />}
                </div>
                {project.clientName && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.clientName}
                  </p>
                )}
                {project.address && (
                  <p className="text-xs text-muted-foreground">{project.address}</p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{project.jobs?.length ?? 0} job(s)</span>
                  <span>{formatDate(project.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
