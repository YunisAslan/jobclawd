"use client";

import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Search, Bookmark, User, Settings, LogOut, BarChart2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarShell } from "@/contexts/SidebarShellContext";
import { useFeedUrl } from "@/contexts/FeedUrlContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  {
    href: "/dashboard/feed",
    label: "Job Feed",
    icon: <Search className="size-4.5 shrink-0" />,
  },
  {
    href: "/dashboard/saved",
    label: "Saved Jobs",
    icon: <Bookmark className="size-4.5 shrink-0" />,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: <BarChart2 className="size-4.5 shrink-0" />,
  },
  {
    href: "/dashboard/profile",
    label: "Profile",
    icon: <User className="size-4.5 shrink-0" />,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: <Settings className="size-4.5 shrink-0" />,
  },
];

function NavItem({
  href,
  label,
  icon,
  collapsed,
  "data-tour": dataTour,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  "data-tour"?: string;
}) {
  const pathname = usePathname();
  const { feedUrl } = useFeedUrl();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const resolvedHref = href === "/dashboard/feed" ? feedUrl : href;

  const inner = (
    <Link
      href={resolvedHref}
      data-tour={dataTour}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 w-full",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-sidebar-foreground dark:text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span
        className={cn(
          "whitespace-nowrap overflow-hidden transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
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
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

export default function AppSidebar() {
  const { open } = useSidebarShell();
  const { resolved: theme } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();
  const collapsed = !open;

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  const logoutBtn = (
    <Button
      onClick={handleLogout}
      variant="ghost"
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full justify-start h-auto",
        "text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150",
      )}
    >
      <LogOut className="size-4.5 shrink-0" />
      <span
        className={cn(
          "whitespace-nowrap overflow-hidden transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
        )}
      >
        Log out
      </span>
    </Button>
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 shrink-0 border-r border-sidebar-border overflow-hidden transition-[width] duration-200 ease-in-out bg-sidebar",
        collapsed ? "w-15" : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14.25 shrink-0 border-b border-sidebar-border px-3 gap-3">
        <Image
          src={logo}
          alt="JobClawd"
          width={34}
          height={34}
          className={cn("shrink-0", theme === "dark" ? "brightness-0 invert" : "")}
        />
        <span
          className={cn(
            "font-bold text-lg tracking-tight text-sidebar-foreground dark:text-foreground whitespace-nowrap overflow-hidden transition-all duration-200",
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
          )}
        >
          Job<span className="text-sidebar-primary">Clawd</span>
        </span>
      </div>

      {/* Nav */}
      <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
            data-tour={item.href.includes("profile") ? "nav-profile" : undefined}
          />
        ))}
      </nav>

      {/* Logout footer */}
      <div className="border-t border-sidebar-border p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{logoutBtn}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Log out
            </TooltipContent>
          </Tooltip>
        ) : (
          logoutBtn
        )}
      </div>
    </aside>
  );
}
