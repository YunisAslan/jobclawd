"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Inbox, User, Settings } from "lucide-react";
import { useProfile } from "@/contexts/ProfileContext";
import { useSidebarShell } from "@/contexts/SidebarShellContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard",    icon: <LayoutDashboard className="size-4.5 shrink-0" /> },
  { href: "/feed",        label: "Job Feed",    icon: <Search          className="size-4.5 shrink-0" /> },
  { href: "/applications",label: "Applications",icon: <Inbox           className="size-4.5 shrink-0" /> },
  { href: "/profile",     label: "Profile",     icon: <User            className="size-4.5 shrink-0" /> },
  { href: "/settings",    label: "Settings",    icon: <Settings        className="size-4.5 shrink-0" /> },
];

function NavItem({ href, label, icon, collapsed }: {
  href: string; label: string; icon: React.ReactNode; collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  const inner = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 w-full",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span
        className={cn(
          "whitespace-nowrap overflow-hidden transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {label}
      </span>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

export default function AppSidebar() {
  const { open } = useSidebarShell();
  const { profile } = useProfile();

  const initials =
    `${profile.name?.[0] ?? ""}${profile.surname?.[0] ?? ""}`.toUpperCase() || "?";
  const displayName =
    [profile.name, profile.surname].filter(Boolean).join(" ") || "Guest";

  const collapsed = !open;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 shrink-0 border-r border-border overflow-hidden transition-[width] duration-200 ease-in-out",
        "bg-sidebar",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-14.25 shrink-0 border-b border-border/20 px-3 gap-3",
      )}>
        <div className="size-8 rounded-lg flex items-center justify-center bg-primary text-primary-foreground font-bold text-xs shrink-0">
          JC
        </div>
        <span
          className={cn(
            "font-bold text-base tracking-tight text-white whitespace-nowrap overflow-hidden transition-all duration-200",
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          Job<span className="text-primary">Clawd</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Profile */}
      <div className="border-t border-border/20 p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/profile"
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
            >
              <div className="size-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-[11px] font-bold shrink-0">
                {initials}
              </div>
              <div
                className={cn(
                  "flex flex-col min-w-0 overflow-hidden transition-all duration-200",
                  collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}
              >
                <span className="text-sm font-medium text-white truncate leading-none mb-0.5">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {profile.email || "Fill your profile"}
                </span>
              </div>
            </Link>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" sideOffset={8}>{displayName}</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
