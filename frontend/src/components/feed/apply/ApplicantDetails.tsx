import { LucideIcon } from "lucide-react";
import { UserProfile } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import {
  UserRound, Mail, Phone, Linkedin, Globe, FileText,
  RotateCcw, ArrowRight, PenLine,
} from "lucide-react";
import { ApplyFormValues } from "../types";

function DetailRow({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="size-3 shrink-0 opacity-50" />
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}

interface Props {
  form: ApplyFormValues;
  profile: UserProfile;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  isEdited: boolean;
  fillFromProfile: () => void;
  updateField: <K extends keyof ApplyFormValues>(key: K, value: ApplyFormValues[K]) => void;
}

export default function ApplicantDetails({
  form,
  profile,
  showDetails,
  setShowDetails,
  isEdited,
  fillFromProfile,
  updateField,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground hover:bg-transparent"
          onClick={() => setShowDetails(!showDetails)}
        >
          <ArrowRight className={cn("size-3 transition-transform duration-200", showDetails && "rotate-90")} />
          Your details
        </Button>
        <div className="flex items-center gap-1.5">
          {isEdited && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] gap-1 text-primary hover:text-primary px-2"
              onClick={fillFromProfile}
            >
              <RotateCcw className="size-2.5" />
              Reset
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1 text-muted-foreground px-2"
            onClick={() => setShowDetails(!showDetails)}
          >
            <PenLine className="size-2.5" />
            {showDetails ? "Collapse" : "Edit"}
          </Button>
        </div>
      </div>

      {!showDetails && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs px-1">
          <DetailRow icon={UserRound} value={form.fullName} />
          <DetailRow icon={Mail} value={form.email} />
          <DetailRow icon={Phone} value={form.phone} />
          <DetailRow icon={FileText} value={form.selectedCV?.name ?? ""} />
          <DetailRow icon={Linkedin} value={form.linkedin_url} />
          <DetailRow icon={Globe} value={form.portfolio_url} />
        </div>
      )}

      {showDetails && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <UserRound className="size-3" /> Full name
              </Label>
              <Input
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                placeholder="Alex Johnson"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3" /> Email
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="you@email.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone className="size-3" /> Phone
              </Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+994 50 123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Linkedin className="size-3" /> LinkedIn
              </Label>
              <Input
                value={form.linkedin_url}
                onChange={(e) => updateField("linkedin_url", e.target.value)}
                placeholder="linkedin.com/in/you"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Globe className="size-3" /> Portfolio
              </Label>
              <Input
                value={form.portfolio_url}
                onChange={(e) => updateField("portfolio_url", e.target.value)}
                placeholder="yoursite.com"
              />
            </div>
            <div className="space-y-1.5" />
          </div>

          {profile.cv_links.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3" /> Resume / CV
              </Label>
              <RadioGroup
                value={form.selectedCV?.url ?? ""}
                onValueChange={(url) =>
                  updateField("selectedCV", profile.cv_links.find((c) => c.url === url) ?? null)
                }
                className="space-y-1"
              >
                {profile.cv_links.map((cv) => (
                  <div
                    key={cv.url}
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer",
                      form.selectedCV?.url === cv.url
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/50 hover:border-border",
                    )}
                  >
                    <RadioGroupItem value={cv.url} id={`apply-cv-${cv.url}`} />
                    <Label
                      htmlFor={`apply-cv-${cv.url}`}
                      className="font-normal cursor-pointer text-sm flex-1 truncate"
                    >
                      {cv.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/40 text-xs text-muted-foreground text-center">
              No CV uploaded yet — add one in your{" "}
              <span className="font-medium text-foreground">Profile</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
