"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, Bookmark, User, Settings, LogOut, BarChart2, Zap, Sparkles, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarShell } from "@/contexts/SidebarShellContext";
import { useFeedUrl } from "@/contexts/FeedUrlContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";
import { JobClawdLogo } from "@/assets/JobClawdLogo";
import { JobClawdMiniLogo } from "@/assets/JobClawdMiniLogo";

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

  // Tooltip only shown when collapsed (desktop narrow mode). On mobile drawer, labels are visible.
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

function CreditBar({ credits, maxCredits }: { credits: number; maxCredits: number }) {
  const pct = maxCredits > 0 ? Math.min(100, Math.round((credits / maxCredits) * 100)) : 0;
  const isLow = pct <= 20;
  const isMid = pct > 20 && pct <= 50;

  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          isLow ? "bg-destructive" : isMid ? "bg-amber-500" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function AppSidebar() {
  const { open, close } = useSidebarShell();
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const collapsed = !open;
  const { credits, maxCredits, isLoading } = useCredits();

  const hasCredits = credits !== null;
  const pct = hasCredits && maxCredits ? Math.min(100, Math.round((credits! / maxCredits) * 100)) : 0;
  const isLow = pct <= 20 && hasCredits;

  // Auto-close drawer on route change (mobile only)
  useEffect(() => {
    if (isMobile && open) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
    <>
      {/* Mobile backdrop — click to close */}
      {isMobile && open && (
        <div
          className="fixed inset-0 bg-black/40 z-80 md:hidden animate-in fade-in duration-150"
          onClick={close}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "flex flex-col h-screen shrink-0 border-r border-sidebar-border overflow-hidden bg-sidebar",
          // Mobile: fixed drawer that slides in/out — top interactive layer (above TopBar z-50,
          // tour z-60/70, and the cookie banner) so the close button is never intercepted.
          "fixed inset-y-0 left-0 z-90 w-64 transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: sticky, transitions width instead of transform
          "md:sticky md:top-0 md:z-auto md:translate-x-0 md:transition-[width] md:duration-200",
          collapsed ? "md:w-15" : "md:w-60",
        )}
      >
        {/* Logo + mobile close button */}
        <div className="flex items-center justify-between h-14.25 shrink-0 border-b border-sidebar-border px-3 gap-2">
          <div className="flex-1 flex items-center justify-center min-w-0">
            {collapsed ? (
              <JobClawdMiniLogo size={21} className="text-sidebar-foreground dark:text-foreground" />
            ) : (
              <JobClawdLogo size={20} className="ml-2.5 text-sidebar-foreground dark:text-foreground w-full" />
            )}
          </div>
          {/* Close button — mobile only */}
          <Button
            onClick={close}
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </Button>
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

        {/* Credits + Upgrade */}
        <div className="px-2 pb-2 space-y-1">
          {/* Credit widget — expanded */}
          {!collapsed && !isLoading && hasCredits && (
            <div className="px-3 py-2.5 rounded-lg bg-muted/40">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className={cn("size-3.5 shrink-0", isLow ? "text-destructive" : "text-primary")} />
                  <span className="text-xs font-medium text-foreground">Credits</span>
                </div>
                <span className={cn("text-xs font-semibold tabular-nums", isLow ? "text-destructive" : "text-foreground")}>
                  {credits}
                  {maxCredits ? <span className="text-muted-foreground font-normal"> / {maxCredits}</span> : null}
                </span>
              </div>
              <CreditBar credits={credits!} maxCredits={maxCredits ?? credits!} />
              {isLow && <p className="text-xs text-destructive mt-1.5 font-medium">Running low</p>}
            </div>
          )}

          {/* Credit icon — collapsed */}
          {collapsed && hasCredits && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/billing"
                  className={cn(
                    "flex items-center justify-center w-full px-3 py-2.5 rounded-lg transition-colors duration-150",
                    isLow
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Zap className="size-4.5 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {credits} credits remaining
              </TooltipContent>
            </Tooltip>
          )}

          {/* Upgrade button */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/billing"
                  className="flex items-center justify-center w-full px-3 py-2.5 rounded-lg text-primary/70 hover:text-primary transition-colors duration-150"
                >
                  <Sparkles className="size-4.5 shrink-0" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Get more credits
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard/billing"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full border border-dashed border-primary/30 text-primary/70 hover:border-primary/60 hover:text-primary transition-colors duration-150"
            >
              <Sparkles className="size-4 shrink-0" />
              <span className="whitespace-nowrap overflow-hidden">Get more credits</span>
            </Link>
          )}
        </div>

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
    </>
  );
}
