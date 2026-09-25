import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Blocks,
  FlaskConical,
  Hexagon,
  Package,
  QrCode,
  ScanLine,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAllBatches, useBatchTimeline, useRecordStage } from "@/lib/dataLayer";
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
import { Separator } from "@/components/ui/separator";

interface TimelineEntry {
  stage: string;
  actor: string;
  note: string | null;
  block_number: number;
  tx_hash: string;
  recorded_at: number;
}

interface Batch {
  batch_id: string;
  hive_id: string;
  beekeeper_name: string;
  harvest_date: string;
  harvest_location: string | null;
  processing_date: string | null;
  packaging_date: string | null;
  distributed_date: string | null;
  quantity_kg: number;
  floral_source: string;
  status: string;
  block_number: number;
  tx_hash: string;
}

const stageOrder = ["created", "processed", "packaged", "distributed"];

/** HONEY BATCH MANAGEMENT (Module 4) + traceability timeline. */
export default function Batches() {
  const [params] = useSearchParams();
  const selectedId = params.get("batch") ?? params.get("created") ?? "";

  const allBatches = useAllBatches();
  const timeline = useBatchTimeline(selectedId);
  const recordStage = useRecordStage();

  const list: Batch[] = allBatches ?? [];

  const [busyStage, setBusyStage] = useState<string | null>(null);
  const selected = list.find((b) => b.batch_id === selectedId) ?? null;

  const nextStage = selected
    ? stageOrder[stageOrder.indexOf(selected.status) + 1]
    : undefined;

  const advance = async (stage: "processed" | "packaged" | "distributed") => {
    if (!selected) return;
    setBusyStage(stage);
    try {
      await recordStage({
        batch_id: selected.batch_id,
        stage,
        actor: stage === "processed" ? "KVIC Processing Unit" : stage === "packaged" ? "KVIC Packaging Unit" : "KVIC Distribution",
        date: new Date().toISOString().slice(0, 10),
        note: `Recorded via prototype by ${stage} role`,
      });
    } finally {
      setBusyStage(null);
    }
  };

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
            Batch & traceability management
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Honey batches</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Each batch is sealed on the hash-chain ledger at creation and at
              every lifecycle stage.
            </p>
          </div>
          <AddBatchButton />
        </div>

        {/* Batch list */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list === undefined ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                Loading batches…
              </CardContent>
            </Card>
          ) : list.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                No batches yet — create one to start a traceability chain.
              </CardContent>
            </Card>
          ) : (
            list.map((b, i) => (
              <motion.div
                key={b.batch_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Link to={`/batches?batch=${b.batch_id}`} className="block">
                  <Card
                    className={`h-full transition-colors ${
                      b.batch_id === selectedId
                        ? "border-primary/50"
                        : "hover:border-primary/30"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-semibold">
                          {b.batch_id}
                        </p>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {b.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.hive_id} · {b.quantity_kg} kg · {b.floral_source}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}
        </div>

        {/* Selected batch detail */}
        {selected && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FlaskConical className="size-5 text-primary" />
                  {selected.batch_id}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="gap-2">
                    <Link to={`/generate-qr?batch=${selected.batch_id}`}>
                      <QrCode className="size-4" />
                      Generate QR
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to={`/blockchain?batch=${selected.batch_id}`}>
                      <Blocks className="size-4" />
                      Blockchain trace
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to={`/verify/${selected.batch_id}`}>
                      <ScanLine className="size-4" />
                      Customer view
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Details grid */}
              <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Batch ID", selected.batch_id],
                  ["Hive ID", selected.hive_id],
                  ["Beekeeper", selected.beekeeper_name],
                  ["Harvest date", selected.harvest_date],
                  ["Harvest location", selected.harvest_location ?? "—"],
                  ["Quantity", `${selected.quantity_kg} kg`],
                  ["Honey type", selected.floral_source],
                  ["Processing date", selected.processing_date ?? "Pending"],
                  ["Packaging date", selected.packaging_date ?? "Pending"],
                  ["Status", selected.status],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-medium capitalize">{v}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* PROCESSOR / ADMIN ROLE — stage recording (Module 10) */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Processor / admin actions
                </p>
                {nextStage ? (
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={busyStage !== null}
                    onClick={() =>
                      advance(nextStage as "processed" | "packaged" | "distributed")
                    }
                  >
                    {nextStage === "processed" && (
                      <FlaskConical className="size-4" />
                    )}
                    {nextStage === "packaged" && <Package className="size-4" />}
                    {nextStage === "distributed" && <Truck className="size-4" />}
                    {busyStage === nextStage
                      ? "Sealing to ledger…"
                      : `Record ${nextStage}`}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    ✓ Lifecycle complete — batch fully traced.
                  </p>
                )}
              </div>

              <Separator />

              {/* Traceability timeline (Module 4/6) */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Traceability timeline
                </p>
                {timeline === undefined ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No records yet.</p>
                ) : (
                  <ol className="flex flex-col">
                    {timeline.map((t, i) => (
                      <li key={t.tx_hash} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
                            <BadgeCheck className="size-4" />
                          </div>
                          {i < timeline.length - 1 && (
                            <div className="my-1 w-px flex-1 bg-border" />
                          )}
                        </div>
                        <div className="pb-5">
                          <p className="text-sm font-medium capitalize">
                            {t.stage}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                              Block #{String(t.block_number).padStart(3, "0")}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">{t.note}</p>
                          <p className="text-[10px] text-muted-foreground/70">
                            {t.actor} ·{" "}
                            {new Date(t.recorded_at).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

/** Add-batch entry (reuses the dashboard's flow via navigation). */
function AddBatchButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Package className="size-4" />
          Add honey batch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create honey batch</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use the{" "}
          <Link to="/dashboard" className="font-medium text-primary hover:underline">
            beekeeper dashboard
          </Link>{" "}
          to create a batch — it needs a hive selection, and after creation you
          land right back here with the new batch selected.
        </p>
      </DialogContent>
    </Dialog>
  );
}
