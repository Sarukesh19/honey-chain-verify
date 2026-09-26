import { motion } from "framer-motion";
import {
  ArrowLeft,
  Columns3,
  Hexagon,
  MapPin,
  Search,
  Sprout,
  Thermometer,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import {
  DeleteHiveDialog,
  EditHiveDialog,
  AddHiveDialog,
} from "@/components/hiveDialogs";
import { useDashboard, useDemoProfile } from "@/lib/dataLayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusMeta: Record<string, { label: string; cls: string }> = {
  healthy: { label: "🟢 Healthy", cls: "bg-primary/12 text-primary border-primary/30" },
  warning: { label: "🟡 Warning", cls: "bg-yellow-500/12 text-yellow-700 border-yellow-500/30" },
  disease_risk: { label: "🔴 Critical", cls: "bg-destructive/12 text-destructive border-destructive/30" },
};

/** HIVE MANAGEMENT (Module 2) — registered hives with status, search/filter,
 *  edit/remove actions, and a multi-hive comparison view. */
export default function Hives() {
  const { profile } = useDemoProfile();
  const dashboard = useDashboard(profile.id);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCompare, setShowCompare] = useState(false);

  const hives = dashboard?.hives ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hives.filter((h) => {
      const matchesQuery =
        q === "" ||
        h.hive_id.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || h.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [hives, query, statusFilter]);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My hives</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registered hives with live sensor status — tap a hive for full IoT
              history and AI analysis.
            </p>
          </div>
          <AddHiveDialog />
        </div>

        {/* Search / filter / compare toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by hive ID or location…"
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm capitalize"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="disease_risk">Critical</option>
          </select>
          <Button
            variant={showCompare ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setShowCompare((s) => !s)}
          >
            <Columns3 className="size-4" />
            {showCompare ? "Hide comparison" : "Compare hives"}
          </Button>
        </div>

        {/* MULTI-HIVE COMPARISON VIEW — health, temp, humidity, yield at a glance */}
        {showCompare && hives.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Columns3 className="size-4 text-primary" />
                Side-by-side comparison
                <span className="text-[10px] font-normal text-muted-foreground">
                  (Demo IoT Data · AI Prototype Analysis)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hive</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Temp (°C)</TableHead>
                      <TableHead>Humidity (%)</TableHead>
                      <TableHead>Weight (kg)</TableHead>
                      <TableHead>Predicted yield (7d)</TableHead>
                      <TableHead>Colony</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hives.map((h) => {
                      const meta = statusMeta[h.status] ?? statusMeta.healthy;
                      return (
                        <TableRow key={h.hive_id}>
                          <TableCell className="font-mono text-xs font-medium">
                            <Link
                              to={`/hives/${h.hive_id}`}
                              className="hover:underline"
                            >
                              {h.hive_id}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}
                            >
                              {meta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {h.reading ? `${h.reading.temperature}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {h.reading ? `${h.reading.humidity}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {h.reading ? `${h.reading.weight}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {h.prediction
                              ? `${h.prediction.predicted_yield_kg} kg`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {h.colony_strength}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {dashboard === undefined ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Loading hives…
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          /* Friendly empty state — distinguishes "none at all" from "no
             search/filter matches". */
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/12">
                {hives.length === 0 ? (
                  <Sprout className="size-7 text-primary" />
                ) : (
                  <Search className="size-7 text-muted-foreground" />
                )}
              </div>
              {hives.length === 0 ? (
                <>
                  <div>
                    <p className="text-sm font-semibold">
                      No hives yet — add your first hive to get started
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Each registered hive streams simulated IoT readings and
                      receives AI health analysis.
                    </p>
                  </div>
                  <AddHiveDialog
                    trigger={
                      <Button size="sm" className="gap-2">
                        <Sprout className="size-4" />
                        Add your first hive
                      </Button>
                    }
                  />
                </>
              ) : (
                <div>
                  <p className="text-sm font-semibold">No hives match your search</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a different hive ID, location, or clear the status filter.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((hive, i) => {
              const meta = statusMeta[hive.status] ?? statusMeta.healthy;
              return (
                <motion.div
                  key={hive.hive_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className="h-full transition-colors hover:border-primary/40">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sprout className="size-4 text-primary" />
                          <Link to={`/hives/${hive.hive_id}`} className="hover:underline">
                            {hive.hive_id}
                          </Link>
                        </CardTitle>
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                          <EditHiveDialog hive={hive} />
                          <DeleteHiveDialog hiveId={hive.hive_id} />
                        </div>
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {hive.location}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Thermometer className="size-3" />
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
