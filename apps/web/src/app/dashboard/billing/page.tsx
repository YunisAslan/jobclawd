"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Sparkles, Loader2, CreditCard, Search, FileText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import TopBar from "@/components/layout/TopBar";
import { creditsService, type CreditPlan } from "@/services/credits.service";
import { useCredits } from "@/contexts/CreditsContext";
import { cn } from "@/lib/utils";

// What a given credit count translates to per operation
function planCapabilities(credits: number) {
  return [
    { icon: Search, label: "Fresh searches", count: Math.floor(credits / 1) },
    { icon: FileText, label: "CV analyses", count: Math.floor(credits / 2) },
    { icon: TrendingUp, label: "Suggestion runs", count: Math.floor(credits / 3) },
  ];
}

function CreditBar({ credits, maxCredits }: { credits: number; maxCredits: number }) {
  const pct = maxCredits > 0 ? Math.min(100, Math.round((credits / maxCredits) * 100)) : 0;
  const isLow = pct <= 20;
  const isMid = pct > 20 && pct <= 50;

  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
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

function PlanCard({
  plan,
  onSelect,
  purchasing,
}: {
  plan: CreditPlan;
  onSelect: (id: string) => void;
  purchasing: string | null;
}) {
  const perCredit = (plan.price_usd / plan.credits).toFixed(3);
  const isBuying = purchasing === plan.id;
  const capabilities = planCapabilities(plan.credits);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-6 transition-all duration-200",
        plan.popular
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold shadow-sm">
            Most Popular
          </Badge>
        </div>
      )}

      <div className="mb-5">
        <p className="text-base font-semibold text-foreground">{plan.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold text-foreground">${plan.price_usd.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Zap className="size-3.5 text-primary" />
          <span className="text-sm font-semibold text-foreground">{plan.credits} credits</span>
          <span className="text-xs text-muted-foreground">· ${perCredit} each</span>
        </div>
      </div>

      {/* What you can do */}
      <ul className="space-y-2.5 mb-6 flex-1">
        {capabilities.map(({ icon: Icon, label, count }) => (
          <li key={label} className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-5 rounded-md bg-primary/10 shrink-0">
              <Icon className="size-3 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">
              Up to{" "}
              <span className="font-semibold text-foreground">{count}</span>{" "}
              {label.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>

      <Button
        onClick={() => onSelect(plan.id)}
        disabled={!!purchasing}
        variant={plan.popular ? "default" : "outline"}
        className={cn("w-full h-10 text-sm font-medium", plan.popular && "shadow-sm")}
      >
        {isBuying ? (
          <>
            <Loader2 className="size-3.5 mr-2 animate-spin" />
            Processing…
          </>
        ) : (
          "Get credits"
        )}
      </Button>
    </div>
  );
}

export default function BillingPage() {
  const { credits, maxCredits, isLoading: creditsLoading, refetch } = useCredits();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["credit-plans"],
    queryFn: () => creditsService.getPlans(),
    staleTime: Infinity,
  });

  const plans = plansData?.plans ?? [];
  const hasCredits = credits !== null;
  const pct = hasCredits && maxCredits ? Math.min(100, Math.round((credits! / maxCredits) * 100)) : 0;
  const isLow = pct <= 20 && hasCredits;

  async function handlePurchase(planId: string) {
    setPurchasing(planId);
    try {
      const result = await creditsService.purchase(planId);
      toast.success(`${result.added} credits added — you now have ${result.credits} credits.`);
      refetch();
    } catch {
      toast.error("Purchase failed. Please try again.");
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Billing & Credits" />
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">

      {/* Current plan */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Current Plan
        </h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 shrink-0">
                <CreditCard className="size-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Free Plan</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  10 starter credits included on sign-up
                </p>
              </div>
            </div>

            {!creditsLoading && hasCredits && (
              <div className="text-right shrink-0">
                <p className={cn("text-2xl font-bold tabular-nums", isLow ? "text-destructive" : "text-foreground")}>
                  {credits}
                  {maxCredits ? (
                    <span className="text-sm font-normal text-muted-foreground"> / {maxCredits}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">credits remaining</p>
              </div>
            )}
          </div>

          {!creditsLoading && hasCredits && (
            <div className="mt-4 space-y-1.5">
              <CreditBar credits={credits!} maxCredits={maxCredits ?? credits!} />
              {isLow && (
                <p className="text-xs text-destructive font-medium">
                  Running low — top up to continue using AI features.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Top-up plans */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Top Up Credits
        </h2>

        {plansLoading ? (
          <div className="grid grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl border border-border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5 pt-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelect={handlePurchase}
                purchasing={purchasing}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-5">
          This is a demo — no real payment is processed.
        </p>
      </section>

      {/* Callout */}
      <section className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0 mt-0.5">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">What can you do with credits?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Credits unlock AI-powered features: match your CV against any job, generate tailored
              improvement suggestions, check the impact of your edits, and always get fresh search
              results when you need them.
            </p>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
