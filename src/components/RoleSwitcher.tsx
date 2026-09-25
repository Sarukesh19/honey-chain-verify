import { api } from "@/convex/_generated/api";
import { CURRENT_BEEKEEPER } from "@/lib/dataLayer";
import { useMutation } from "convex/react";
import { Bot, LogOut, ScanLine, ShieldCheck, Sprout, UserCog } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DemoRole = "beekeeper" | "processor" | "consumer";

const roles: Array<{
  id: DemoRole;
  label: string;
  icon: typeof Sprout;
  description: string;
}> = [
  {
    id: "beekeeper",
    label: "Beekeeper",
    icon: Sprout,
    description: "Manage hives, sensor data, batches and QR codes.",
  },
  {
    id: "processor",
    label: "Processor / Admin",
    icon: UserCog,
    description: "Record processing, packaging and distribution stages.",
  },
  {
    id: "consumer",
    label: "Consumer",
    icon: ScanLine,
    description: "Scan a jar QR and verify honey information.",
  },
];

/**
 * Demo role switcher (Module 10) — conceptual roles only, no real auth.
 * For the prototype, switching roles simply navigates to that role's home:
 * beekeeper → dashboard, processor → batch stage recording, consumer →
 * the public scan-a-QR page.
 */
export function RoleSwitcher({ current }: { current: DemoRole }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        <UserCog className="size-4" />
        {roles.find((r) => r.id === current)?.label ?? "Role"}
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Close role menu"
          />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Demo role (no real auth)
            </p>
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                    r.id === current ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  onClick={() => {
                    setOpen(false);
                    if (r.id === "beekeeper") navigate("/dashboard");
                    if (r.id === "processor") navigate("/batches");
                    if (r.id === "consumer") navigate("/");
                  }}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
