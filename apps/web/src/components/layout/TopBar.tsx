"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/Separator";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/endpoints";
import { useSidebarShell } from "@/contexts/SidebarShellContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Moon,
  Monitor,
  User,
  Settings,
  LogOut,
  CreditCard,
} from "lucide-react";

interface TopBarProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export default function TopBar({ title, action, className }: TopBarProps) {
  const { open, toggle } = useSidebarShell();
  const { user, logout } = useAuth();
  const { profile } = useProfile();
  const { resolved: theme, preference, setTheme } = useTheme();
  const router = useRouter();

  const avatarUrl = profile.avatar_url
    ? profile.avatar_url.startsWith("http")
      ? profile.avatar_url
      : `${API_BASE_URL}${profile.avatar_url}`
    : null;

  const initials =
    `${profile.name?.[0] ?? ""}${profile.surname?.[0] ?? ""}`.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  const displayName =
    [profile.name, profile.surname].filter(Boolean).join(" ") ||
    user?.name ||
    user?.email ||
    "Guest";

  const email = profile.email || user?.email || "";

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between px-4 py-0 h-14 bg-background sticky top-0 z-50",
          className,
        )}
      >
        {/* Left: sidebar toggle + page title */}
        <div className="flex items-center gap-3">
          <Button
            onClick={toggle}
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
            aria-label="Toggle sidebar"
          >
            {open ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>

          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        </div>

        {/* Right: action slot + theme toggle + avatar menu */}
        <div className="flex items-center gap-1.5">
          {action && <div className="pr-1">{action}</div>}

          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground hover:bg-accent"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
                <Sun className="size-3.5" /> Light
                {preference === "light" && (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
                <Moon className="size-3.5" /> Dark
                {preference === "dark" && (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
                <Monitor className="size-3.5" /> System
                {preference === "system" && (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Avatar context menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full hover:bg-accent p-0 size-8"
                aria-label="User menu"
              >
                <div className="size-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-[11px] font-bold overflow-hidden relative">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    initials
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={8} className="w-52">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{email}</span>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="cursor-pointer">
                  <User className="size-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/dashboard/billing" className="cursor-pointer">
                  <CreditCard className="size-4 mr-2" />
                  Billing & Credits
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer">
                  <Settings className="size-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="size-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Separator />
    </>
  );
}
