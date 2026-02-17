import { Outlet, useLocation, Link } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ROUTE_LABELS: Record<string, string> = {
  jobs: "Jobs",
  projects: "Projects",
  pages: "Pages",
  review: "Review",
  measure: "Measure",
  pricing: "Pricing",
  results: "Results",
  new: "New Project",
  admin: "Admin",
  pricebook: "Pricebook",
  templates: "Templates",
  system: "System Health",
  audit: "Audit Log",
  users: "Users",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return <span className="text-sm text-muted-foreground">Dashboard</span>;
  }

  const crumbs: { label: string; path: string }[] = [];
  let path = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    path += `/${part}`;

    let label: string;
    if (isUuid(part)) {
      // Show truncated ID with context from previous segment
      const prev = parts[i - 1];
      const prefix = prev === "jobs" ? "Job" : prev === "projects" ? "Project" : "";
      label = prefix ? `${prefix} ${part.slice(0, 8)}...` : `${part.slice(0, 8)}...`;
    } else if (/^\d+$/.test(part)) {
      // Page numbers
      label = `Page ${part}`;
    } else {
      label = ROUTE_LABELS[part] ?? part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
    }

    crumbs.push({ label, path });
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link to="/" className="text-muted-foreground hover:text-foreground">
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight size={14} className="text-muted-foreground" />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="text-muted-foreground hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function AppShell() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
          <Breadcrumbs />
          {user && (
            <span className="text-xs text-muted-foreground">
              {user.name} ({user.role})
            </span>
          )}
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-muted/30 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
