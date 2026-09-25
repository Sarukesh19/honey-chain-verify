import { motion } from "framer-motion";
import { ArrowLeft, Hexagon, MapPin, Sprout } from "lucide-react";
import { Link } from "react-router";

import { useDashboard } from "@/lib/dataLayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const statusMeta: Record<string, { label: string; cls: string }> = {
  healthy: { label: "🟢 Healthy", cls: "bg-primary/12 text-primary border-primary/30" },
  warning: { label: "🟡 Warning", cls: "bg-yellow-500/12 text-yellow-700 border-yellow-500/30" },
  disease_risk: { label: "🔴 Critical", cls: "bg-destructive/12 text-destructive border-destructive/30" },
};

/** HIVE MANAGEMENT (Module 2) — registered hives with status. */
export default function Hives() {
  const dashboard = useDashboard();

  return (
    <main className="honeycomb-bg min-h-screen">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Hexagon className="size-3.5 text-primary" />
            Hive management
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My hives</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registered hives with live sensor status — tap a hive for full IoT
            history and AI analysis.
          </p>
        </div>

        {dashboard === undefined ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Loading hives…
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboard.hives.map((hive, i) => {
              const meta = statusMeta[hive.status] ?? statusMeta.healthy;
              return (
                <motion.div
                  key={hive.hive_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Link to={`/hives/${hive.hive_id}`} className="block">
                    <Card className="h-full transition-colors hover:border-primary/40">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Sprout className="size-4 text-primary" />
                            {hive.hive_id}
                          </CardTitle>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {hive.location}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Temp:{" "}
                            <span className="font-medium text-foreground">
                              {hive.reading ? `${hive.reading.temperature}°C` : "—"}
                            </span>
                          </span>
                          <span>
                            Humidity:{" "}
                            <span className="font-medium text-foreground">
                              {hive.reading ? `${hive.reading.humidity}%` : "—"}
                            </span>
                          </span>
                          <span>
                            Weight:{" "}
                            <span className="font-medium text-foreground">
                              {hive.reading ? `${hive.reading.weight} kg` : "—"}
                            </span>
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            Demo IoT Data
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
