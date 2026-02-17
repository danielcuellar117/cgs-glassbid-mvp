import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderPlus,
  Shield,
  BookOpen,
  Layers,
  Activity,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const operatorLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/projects/new", icon: FolderPlus, label: "New Project" },
];

const adminLinks = [
  { to: "/admin", icon: Shield, label: "Admin Overview" },
  { to: "/admin/pricebook", icon: BookOpen, label: "Pricebook" },
  { to: "/admin/templates", icon: Layers, label: "Templates" },
  { to: "/admin/system", icon: Activity, label: "System Health" },
  { to: "/admin/audit", icon: FileText, label: "Audit Log" },
  { to: "/admin/users", icon: Users, label: "Users" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight">Luxurius Glass</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Operator section */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        <SectionLabel collapsed={collapsed}>Operator</SectionLabel>
        {operatorLinks.map((link) => (
          <SidebarLink key={link.to} {...link} collapsed={collapsed} />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            <SectionLabel collapsed={collapsed}>Admin</SectionLabel>
            {adminLinks.map((link) => (
              <SidebarLink key={link.to} {...link} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Footer: user info + logout */}
      <div className="border-t border-sidebar-border px-3 py-2">
        {user && (
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2")}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {user.role}
                </p>
              </div>
            )}
            <button
              onClick={logout}
              title="Sign out"
              className={cn(
                "rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                collapsed && "mt-2",
              )}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        {!user && !collapsed && (
          <span className="text-xs text-muted-foreground">MVP v0.1</span>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  if (collapsed) return null;
  return (
    <span className="mb-1 block px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/" || to === "/admin"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed && "justify-center",
        )
      }
    >
      <Icon size={18} />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
