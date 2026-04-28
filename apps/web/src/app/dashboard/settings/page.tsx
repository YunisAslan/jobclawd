import TopBar from "@/components/layout/TopBar";
import ChangeEmailSection from "@/components/settings/ChangeEmailSection";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import TourSettingsSection from "@/components/settings/TourSettingsSection";
import { Mail, ShieldAlert, Compass } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
          {/* Page intro */}
          <div className="mb-8">
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your account preferences and integrations.
            </p>
          </div>

          {/* ── Guided tour ── */}
          <SettingsSection
            icon={<Compass className="size-4" />}
            title="Guided tour"
            description="Take the interactive walkthrough to learn how JobClawd works."
          >
            <TourSettingsSection />
          </SettingsSection>

          {/* ── Email address ── */}
          <SettingsSection
            icon={<Mail className="size-4" />}
            title="Email address"
            description="Change the email address linked to your account."
          >
            <ChangeEmailSection />
          </SettingsSection>

          {/* ── Danger zone ── */}
          <SettingsSection
            icon={<ShieldAlert className="size-4" />}
            title="Danger zone"
            description="Irreversible actions that affect your account and data."
          >
            <DeleteAccountSection />
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

// ── Reusable section shell ────────────────────────────────────────────────────

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-muted/20">
        <div className="size-8 rounded-lg bg-background border border-border/60 flex items-center justify-center text-muted-foreground shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-px">{description}</p>
        </div>
      </div>
      {/* Section content */}
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}
