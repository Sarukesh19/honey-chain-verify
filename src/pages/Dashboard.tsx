import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Hexagon,
  Link2,
  LogOut,
  Mic,
  Package,
  PieChart as PieChartIcon,
  Plus,
  QrCode,
  Scale,
  Sprout,
  Thermometer,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RoleSwitcher } from "@/components/RoleSwitcher";
import {
  CURRENT_BEEKEEPER,
  useAlerts,
  useAnalytics,
  useCreateBatch,
  useCreateHive,
  useDashboard,
  useSimulatedSensorStream,
} from "@/lib/dataLayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

const BK = CURRENT_BEEKEEPER;

const statusMeta: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  healthy: {
    label: "Healthy",
    cls: "bg-primary/12 text-primary border-primary/30",
    dot: "bg-primary",
  },
  warning: {
    label: "Warning",
    cls: "bg-yellow-500/12 text-yellow-700 border-yellow-500/30",
    dot: "bg-yellow-500",
  },
  disease_risk: {
    label: "Critical",
    cls: "bg-destructive/12 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
};

function Metric({
  icon,
  label,
  value,
  unit,
  ok,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
        <span className={ok ? "text-primary" : "text-destructive"}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold">
          {value}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
            {unit}
          </span>
        </p>
      </div>
    </div>
  );
}

function TotalsCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const dashboard = useDashboard(BK.id);
  const alerts = useAlerts();
  const analytics = useAnalytics();
  const pushReading = useSimulatedSensorStream();

  // --- Simulated IoT stream ("Demo IoT Data"): 5s cadence per hive ---------
  const [live, setLive] = useState(true);
  const liveRef = useRef(true);
  const hiveIds = useMemo(
    () => dashboard?.hives.map((h) => h.hive_id) ?? [],
    [dashboard],
  );

  useEffect(() => {
    if (!live) return;
    // Demo IoT Data: simulated 5-second sensor cadence per hive.
    const timer = setInterval(() => {
      for (const id of hiveIds) {
        void pushReading(id);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [live, hiveIds, pushReading]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="honeycomb-bg min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border/70 bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12">
              <Hexagon className="size-5 text-primary" />
            </span>
            <span className="text-sm font-bold tracking-tight">Honey Chain</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              Beekeeper portal
            </Badge>
          </div>
          <div className="hidden sm:block">
            <RoleSwitcher current="beekeeper" />
          </div>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/marketplace">Marketplace</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/blockchain">Blockchain</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/roadmap">Roadmap</Link>
            </Button>
            <Button
              variant={live ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                liveRef.current = !live;
                setLive(liveRef.current);
              }}
              className="gap-2"
            >
              <Activity className="size-4" />
              {live ? "IoT live" : "IoT paused"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="size-4" />
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {/* Header + quick actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Welcome back, {user?.name ?? BK.name}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">Apiary overview</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddHiveDialog />
            <AddBatchDialog />
            <Button asChild variant="outline" className="gap-2">
              <Link to="/hives">
                <Sprout className="size-4" />
                View hives
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/generate-qr">
                <QrCode className="size-4" />
                Generate QR
              </Link>
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <TotalsCard
            icon={<Hexagon className="size-5" />}
            label="Total hives"
            value={String(dashboard?.totals.hive_count ?? "—")}
          />
          <TotalsCard
            icon={<CheckCircle2 className="size-5" />}
            label="Healthy hives"
            value={String(dashboard?.totals.healthy_count ?? "—")}
          />
          <TotalsCard
            icon={<AlertTriangle className="size-5" />}
            label="Needs attention"
            value={String(dashboard?.totals.needs_attention ?? "—")}
          />
          <TotalsCard
            icon={<Droplets className="size-5" />}
            label="Honey produced"
            value={
              dashboard ? `${dashboard.totals.total_produced_kg} kg` : "—"
            }
          />
          <TotalsCard
            icon={<TrendingUp className="size-5" />}
            label="Predicted (7d)"
            value={
              dashboard ? `${dashboard.totals.predicted_yield_kg} kg` : "—"
            }
          />
        </div>

        {/* Alerts */}
        {alerts && alerts.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bell className="size-4 text-yellow-600" />
                Recent alerts
                <span className="text-[10px] font-normal text-muted-foreground">
                  (Demo IoT Data · AI Prototype Analysis, Rule-Based Demo Model)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {alerts.slice(0, 4).map((a) => (
                <div
                  key={a._id}
                  className="flex items-center justify-between rounded-md bg-card px-3 py-2"
                >
                  <span className="text-sm">{a.message}</span>
                  <Badge
                    variant={a.severity === "critical" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {a.severity === "critical" ? "🔴 Critical" : "🟡 Warning"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Analytics (Module 9): health distribution + predicted vs actual */}
        {analytics && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PieChartIcon className="size-4 text-primary" />
                  Hive health distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "Healthy",
                            value: analytics.healthCounts.healthy,
                          },
                          {
                            name: "Warning",
                            value: analytics.healthCounts.warning,
                          },
                          {
                            name: "Critical",
                            value: analytics.healthCounts.disease_risk,
                          },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                      >
                        <Cell fill="var(--chart-1)" />
                        <Cell fill="var(--chart-4)" />
                        <Cell fill="var(--destructive)" />
                      </Pie>
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="size-4 text-primary" />
                  Predicted vs actual production (kg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.production}
                      margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="hive_id"
                        tick={{ fontSize: 10 }}
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="var(--muted-foreground)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="predicted"
                        name="AI predicted (7d)"
                        fill="var(--chart-3)"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="actual"
                        name="Actual harvested"
                        fill="var(--chart-1)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>                            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                              AI Prototype Analysis (Rule-Based Demo Model) · Demo IoT Data
                            </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hive cards with live readings + AI panel */}
        {dashboard === undefined ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading apiary…
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.hives.map((hive, i) => {
              const meta = statusMeta[hive.status] ?? statusMeta.healthy;
              const p = hive.prediction;
              return (
                <motion.div
                  key={hive.hive_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sprout className="size-4 text-primary" />
                          <Link
                            to={`/hives/${hive.hive_id}`}
                            className="hover:underline"
                          >
                            {hive.hive_id}
                          </Link>
                        </CardTitle>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
                        >
                          <span className={`size-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hive.location}
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Metric
                          icon={<Thermometer className="size-4" />}
                          label="Temp"
                          value={hive.reading ? String(hive.reading.temperature) : "—"}
                          unit="°C"
                          ok={!hive.reading || hive.reading.temperature <= 36}
                        />
                        <Metric
                          icon={<Droplets className="size-4" />}
                          label="Humidity"
                          value={hive.reading ? String(hive.reading.humidity) : "—"}
                          unit="%"
                          ok={!hive.reading || hive.reading.humidity <= 70}
                        />
                        <Metric
                          icon={<Scale className="size-4" />}
                          label="Weight"
                          value={hive.reading ? String(hive.reading.weight) : "—"}
                          unit="kg"
                          ok={true}
                        />
                        <Metric
                          icon={<Mic className="size-4" />}
                          label="Sound"
                          value={hive.reading ? String(hive.reading.sound) : "—"}
                          unit="dB"
                          ok={!hive.reading || hive.reading.sound <= 50}
                        />
                      </div>

                      {/* AI SMART ANALYTICS panel */}
                      {p && (
                        <div
                          className={`rounded-lg border px-3 py-2.5 ${
                            p.health_status === "healthy"
                              ? "border-primary/25 bg-primary/5"
                              : "border-destructive/25 bg-destructive/5"
                          }`}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold">
                            <span>
                              Colony: {p.health_status.replace("_", " ")}
                            </span>
                            {p.disease_risk_pct !== null && (
                              <span>Disease risk: {p.disease_risk_pct}%</span>
                            )}
                            <span>Yield: {p.predicted_yield_kg} kg/7d</span>
                            {p.env_risk && <span>Env: {p.env_risk}</span>}
                          </div>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {p.recommended_action}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                            AI Prototype Analysis · Demo IoT Data
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Recent batches */}
        {dashboard && dashboard.recentBatches.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="size-4 text-primary" />
                Recent honey batches
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {dashboard.recentBatches.map((b) => (
                <div
                  key={b.batch_id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{b.batch_id}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.hive_id} · {b.quantity_kg} kg {b.floral_source} ·{" "}
                      {b.harvest_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {b.status}
                    </Badge>
                    <Button asChild variant="ghost" size="sm" className="gap-1.5">
                      <Link to={`/batches?batch=${b.batch_id}`}>
                        <Link2 className="size-3.5" />
                        Trace
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              <Button asChild variant="outline" size="sm" className="mt-1 gap-2 self-start">
                <Link to="/batches">
                  <FlaskConical className="size-4" />
                  Manage all batches
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

/** Add Hive dialog (Module 2). */
function AddHiveDialog() {
  const createHive = useCreateHive();
  const [open, setOpen] = useState(false);
  const [hiveId, setHiveId] = useState("");
  const [location, setLocation] = useState("");
  const [strength, setStrength] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Add hive
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register a hive</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await createHive({
                hive_id: hiveId.trim().toUpperCase(),
                location,
                beekeeper_id: BK.id,
                beekeeper_name: BK.name,
                hive_age_days: 0,
                colony_strength: strength,
              });
              setOpen(false);
              setHiveId("");
              setLocation("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create hive.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hive-id">Hive ID</Label>
            <Input
              id="hive-id"
              value={hiveId}
              onChange={(e) => setHiveId(e.target.value)}
              placeholder="HIVE-007"
              className="font-mono uppercase"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hive-loc">Location</Label>
            <Input
              id="hive-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Madurai, Tamil Nadu"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hive-strength">Colony strength</Label>
            <select
              id="hive-strength"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="strong">Strong</option>
              <option value="medium">Medium</option>
              <option value="weak">Weak</option>
            </select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Registering…" : "Register hive"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Add Batch dialog (Module 4) → creates + seals → navigates to batches. */
function AddBatchDialog() {
  const createBatch = useCreateBatch();
  const navigate = useNavigate();
  const dashboard = useDashboard(BK.id);
  const [open, setOpen] = useState(false);
  const [hiveId, setHiveId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [honeyType, setHoneyType] = useState("Wildflower");
  const [harvest, setHarvest] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="size-4" />
          Add honey batch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create honey batch</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const res = await createBatch({
                hive_id: hiveId.trim().toUpperCase(),
                harvest_date: harvest,
                harvest_location:
                  dashboard?.hives.find(
                    (h) => h.hive_id === hiveId.trim().toUpperCase(),
                  )?.location ?? undefined,
                quantity_kg: Number(quantity),
                floral_source: honeyType,
                beekeeper_id: BK.id,
                beekeeper_name: BK.name,
              });
              setOpen(false);
              navigate(`/batches?created=${res.batch_id}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create batch.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-hive">Hive</Label>
            <select
              id="b-hive"
              value={hiveId}
              onChange={(e) => setHiveId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              required
            >
              <option value="">Select hive…</option>
              {(dashboard?.hives ?? []).map((h) => (
                <option key={h.hive_id} value={h.hive_id}>
                  {h.hive_id} — {h.location}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-qty">Quantity (kg)</Label>
              <Input
                id="b-qty"
                type="number"
                step="0.1"
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="12.5"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-date">Harvest date</Label>
              <Input
                id="b-date"
                type="date"
                value={harvest}
                onChange={(e) => setHarvest(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="b-type">Honey type</Label>
            <Input
              id="b-type"
              value={honeyType}
              onChange={(e) => setHoneyType(e.target.value)}
              placeholder="Wildflower"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Sealing to ledger…" : "Create batch"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
