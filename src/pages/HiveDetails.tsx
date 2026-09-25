import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Hexagon,
  MapPin,
  Thermometer,
} from "lucide-react";
import { Link, useParams } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "@/convex/_generated/api";
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

/** HIVE DETAILS (Module 2 + 3): IoT charts + AI Smart Analytics. */
export default function HiveDetails() {
  const { hiveId = "" } = useParams();
  const details = useQuery(api.apiary.getHiveDetails, { hive_id: hiveId });

  if (details === undefined) {
    return (
      <main className="honeycomb-bg min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-muted-foreground">
          Loading hive…
        </div>
      </main>
    );
  }

  if (details === null) {
    return (
      <main className="honeycomb-bg min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Hive not found</h1>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/hives">Back to hives</Link>
          </Button>
        </div>
      </main>
    );
  }

  const { hive, readings, prediction } = details;
  const meta = statusMeta[hive.status] ?? statusMeta.healthy;

  // Chart data: timestamps → readable hour labels.
  const chartData = readings.map((r) => ({
    ...r,
    label: new Date(r.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <main className="honeycomb-bg min-h-screen">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/hives">
              <ArrowLeft className="size-4" />
              Hives
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Hexagon className="size-3.5 text-primary" />
            {hive.hive_id} · Demo IoT Data
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        {/* Header + status */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              {hive.hive_id}
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
              >
                {meta.label}
              </span>
            </h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {hive.location}
            </p>
          </div>
        </div>

        {/* Hive info */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Beekeeper", value: hive.beekeeper_name },
            {
              label: "Hive age",
              value:
                hive.hive_age_days !== null
                  ? `${Math.round(hive.hive_age_days / 30)} months`
                  : "—",
            },
            { label: "Colony strength", value: hive.colony_strength },
            {
              label: "Registered",
              value: new Date(hive.installed_at).toLocaleDateString(),
            },
          ].map((d) => (
            <Card key={d.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{d.label}</p>
                <p className="text-sm font-semibold capitalize">{d.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI SMART ANALYTICS (Module 3) */}
        {prediction && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              className={
                prediction.health_status === "healthy"
                  ? "border-primary/30 bg-primary/5"
                  : "border-destructive/30 bg-destructive/5"
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {prediction.health_status === "healthy" ? (
                    <CheckCircle2 className="size-5 text-primary" />
                  ) : (
                    <AlertTriangle className="size-5 text-destructive" />
                  )}
                  AI Smart Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Colony health</p>
                    <p className="text-sm font-bold capitalize">
                      {prediction.health_status.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Disease risk</p>
                    <p className="text-sm font-bold">
                      {prediction.disease_risk_pct !== null
                        ? `${prediction.disease_risk_pct}%`
                        : prediction.risk_level}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Predicted production
                    </p>
                    <p className="text-sm font-bold">
                      {prediction.predicted_yield_kg} kg / 7 days
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Environmental risk
                    </p>
                    <p className="text-sm font-bold capitalize">{prediction.env_risk ?? "—"}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-card px-3 py-2.5">
                  <p className="text-xs font-semibold">Recommended action</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {prediction.recommended_action}
                  </p>
                </div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  AI Prototype Analysis · derived from Demo IoT Data
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Sensor charts (Module 9) */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SensorChart
            title="Temperature (°C)"
            icon={<Thermometer className="size-4 text-primary" />}
            data={chartData}
            dataKey="temperature"
            color="var(--chart-1)"
          />
          <SensorChart
            title="Humidity (%)"
            icon={<Activity className="size-4 text-primary" />}
            data={chartData}
            dataKey="humidity"
            color="var(--chart-2)"
          />
          <SensorChart
            title="Hive weight (kg)"
            icon={<Activity className="size-4 text-primary" />}
            data={chartData}
            dataKey="weight"
            color="var(--chart-3)"
          />
          <SensorChart
            title="Sound level (dB)"
            icon={<Activity className="size-4 text-primary" />}
            data={chartData}
            dataKey="sound"
            color="var(--chart-4)"
          />
        </div>
      </div>
    </main>
  );
}

function SensorChart({
  title,
  icon,
  data,
  dataKey,
  color,
}: {
  title: string;
  icon: React.ReactNode;
  data: Array<Record<string, number | string>>;
  dataKey: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="var(--muted-foreground)"
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="var(--muted-foreground)"
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
