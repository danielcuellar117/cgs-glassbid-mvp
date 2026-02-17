import { Outlet, useLocation, Link } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return <span className="text-sm text-muted-foreground">Dashboard</span>;
  }

  const crumbs: { label: string; path: string }[] = [];
  let path = "";
  for (const part of parts) {
    path += `/${part}`;
    const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
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
