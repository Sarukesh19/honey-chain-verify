import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Droplets,
  Gauge,
  Hexagon,
  LogOut,
  Mic,
  Plus,
  Scale,
  Sprout,
  Thermometer,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { api } from "@/convex/_generated/api";
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

const BK = { id: "BK-001", name: "Ramesh Patil" };

/** Sensor-metric row used inside hive cards. */
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
    label: "Disease Risk",
    cls: "bg-destructive/12 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const dashboard = useQuery(api.apiary.getDashboard, {
    beekeeper_id: BK.id,
  });
  const alerts = useQuery(api.apiary.getAlerts, {});
  const pushReading = useMutation(api.apiary.pushSimulatedReading);

  // --- Simulated IoT stream: every 5s push a fresh reading for each hive ---
  const liveRef = useRef(true);
  const [live, setLive] = useState(true);
  const hiveIds = useMemo(
    () => dashboard?.hives.map((h) => h.hive_id) ?? [],
    [dashboard],
  );

  useEffect(() => {
    if (!live) return;
    const jitter = (base: number, amp: number) =>
      Math.round((base + (Math.random() - 0.5) * 2 * amp) * 10) / 10;
    const timer = setInterval(() => {
      for (const id of hiveIds) {
        void pushReading({
          hive_id: id,
          temperature: jitter(34, 1.2),
          humidity: jitter(62, 5),
          weight: 35 + Math.random() * 5,
          sound: jitter(43, 3),
        });
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
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/marketplace">Marketplace</Link>
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
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Welcome back, {user?.name ?? BK.name}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              Apiary overview
            </h1>
          </div>
          <div className="flex gap-2">
            {/* Add Hive */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="size-4" />
                  Add hive
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Register a hive</DialogTitle>
                </DialogHeader>
                <AddHiveForm />
              </DialogContent>
            </Dialog>
            {/* Add Batch */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" />
                  Create batch
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create honey batch</DialogTitle>
                </DialogHeader>
                <AddBatchForm />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Totals */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Hexagon className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hives</p>
                <p className="text-xl font-bold">
                  {dashboard?.totals.hive_count ?? "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Droplets className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Predicted yield (7d)
                </p>
                <p className="text-xl font-bold">
                  {dashboard ? `${dashboard.totals.predicted_yield_kg} kg` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Bell className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Needs attention</p>
                <p className="text-xl font-bold">
                  {dashboard?.totals.needs_attention ?? "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {alerts && alerts.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-yellow-600" />
                Active alerts
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
                    {a.severity}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Hive cards */}
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
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Sprout className="size-4 text-primary" />
                          {hive.hive_id}
                        </CardTitle>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
                        >
                          <span className={`size-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Gauge className="size-3" />
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

                      {/* AI verdict */}
                      {p && (
                        <div
                          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                            p.health_status === "healthy"
                              ? "border-primary/25 bg-primary/5"
                              : "border-destructive/25 bg-destructive/5"
                          }`}
                        >
                          {p.health_status === "healthy" ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                          ) : (
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                          )}
                          <div className="text-xs leading-5">
                            <p className="font-semibold">
                              AI: {p.health_status.replace("_", " ")} · risk {p.risk_level}
                              · predicted yield {p.predicted_yield_kg} kg / 7d
                            </p>
                            <p className="text-muted-foreground">
                              {p.recommended_action}
                            </p>
                          </div>
                        </div>
                      )}
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

/** Add Hive form (Module 2). */
function AddHiveForm() {
  const createHive = useMutation(api.apiary.createHive);
  const [hiveId, setHiveId] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
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
          });
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
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="gap-2">
        {busy ? "Registering…" : "Register hive"}
      </Button>
    </form>
  );
}

/** Add Batch form (Module 1) → seals to ledger → returns QR link. */
function AddBatchForm() {
  const createBatch = useMutation(api.traceability.createBatch);
  const navigate = useNavigate();
  const dashboard = useQuery(api.apiary.getDashboard, { beekeeper_id: BK.id });
  const [hiveId, setHiveId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [harvest, setHarvest] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
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
            processing_date: harvest, // v1: same-day processing/packaging
            packaging_date: harvest,
            quantity_kg: Number(quantity),
            floral_source: "Wildflower",
            beekeeper_id: BK.id,
            beekeeper_name: BK.name,
          });
          navigate(`/generate-qr?batch=${res.batch_id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create batch.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="batch-hive">Hive</Label>
        <select
          id="batch-hive"
          value={hiveId}
          onChange={(e) => setHiveId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
          <Label htmlFor="batch-qty">Quantity (kg)</Label>
          <Input
            id="batch-qty"
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
          <Label htmlFor="batch-date">Harvest date</Label>
          <Input
            id="batch-date"
            type="date"
            value={harvest}
            onChange={(e) => setHarvest(e.target.value)}
            required
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="gap-2">
        {busy ? "Sealing to ledger…" : "Create & seal batch"}
      </Button>
    </form>
  );
}
