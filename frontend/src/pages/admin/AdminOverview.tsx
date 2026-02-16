import { useHealth } from "@/api/hooks/useHealth";
import { useProjects } from "@/api/hooks/useProjects";
import { useJobs } from "@/api/hooks/useJobs";
import { Link } from "react-router-dom";
import {
  Loader2,
  FolderOpen,
  Briefcase,
  HardDrive,
  AlertTriangle,
  BookOpen,
  Layers,
  Activity,
  FileText,
} from "lucide-react";

export function AdminOverview() {
  const { data: health, isLoading: healthLoading } = useHealth(10000);
  const { data: projects } = useProjects();
  const { data: jobs } = useJobs();

  const failedJobs = (jobs ?? []).filter((j) => j.status === "FAILED").length;
  const activeJobs = (jobs ?? []).filter(
    (j) => !["DONE", "FAILED", "CREATED"].includes(j.status),
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">
          System status and quick links.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Total Projects"
          value={String(projects?.length ?? 0)}
          loading={!projects}
        />
        <StatCard
          icon={Briefcase}
          label="Active Jobs"
          value={String(activeJobs)}
          accent={activeJobs > 0 ? "blue" : undefined}
        />
        <StatCard
          icon={AlertTriangle}
          label="Failed Jobs"
          value={String(failedJobs)}
          accent={failedJobs > 0 ? "red" : undefined}
        />
        <StatCard
          icon={HardDrive}
          label="Disk Usage"
          value={
            health
              ? `${health.disk.usedPercent.toFixed(1)}%`
              : "—"
          }
          loading={healthLoading}
          accent={health && health.disk.usedPercent > 80 ? "red" : undefined}
        />
      </div>

      {/* Health status */}
      {health && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">System Health</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <HealthItem
              label="Database"
              ok={health.db.connected}
              detail={health.db.connected ? "Connected" : "Disconnected"}
            />
            <HealthItem
              label="Worker"
              ok={!health.worker.stale}
              detail={
                health.worker.lastHeartbeat
                  ? `Last heartbeat: ${new Date(health.worker.lastHeartbeat).toLocaleTimeString()}`
                  : "No heartbeat"
              }
            />
            <HealthItem
              label="Disk"
              ok={health.disk.usedPercent < 80}
              detail={`${health.disk.freeGB.toFixed(1)} GB free of ${health.disk.totalGB.toFixed(1)} GB`}
            />
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/admin/pricebook", icon: BookOpen, label: "Pricebook", desc: "Manage pricing rules" },
          { to: "/admin/templates", icon: Layers, label: "Templates", desc: "Configuration mappings" },
          { to: "/admin/system", icon: Activity, label: "System Health", desc: "Real-time monitoring" },
          { to: "/admin/audit", icon: FileText, label: "Audit Log", desc: "Activity history" },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group rounded-lg border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30"
          >
            <link.icon size={24} className="mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
            <h3 className="font-semibold group-hover:text-primary transition-colors">{link.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  loading?: boolean;
  accent?: "red" | "blue";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          ) : (
            <p
              className={`text-xl font-bold ${
                accent === "red"
                  ? "text-red-600"
                  : accent === "blue"
                    ? "text-blue-600"
                    : ""
              }`}
            >
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthItem({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-3 w-3 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`}
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
