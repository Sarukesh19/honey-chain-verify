import { motion } from "framer-motion";
import {
  ArrowLeft,
  Cpu,
  Hexagon,
  Layers,
  Link2,
  MapPin,
  Radio,
  Server,
  Users,
} from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Module 12 — Scalability & Deployment ("Scale to Production").
 * Addresses the problem statement's requirement for a scalable deployment
 * framework: real IoT hardware, a live blockchain network, and multi-cluster
 * KVIC rollout.
 */
export default function Roadmap() {
  return (
    <main className="honeycomb-bg min-h-screen">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Hexagon className="size-3.5 text-primary" />
            Scale to Production
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <div>
          <Badge variant="secondary" className="mb-3 gap-1.5">
            <Layers className="size-3.5 text-primary" />
            Scalable deployment framework
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">
            From prototype to production
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Honey Chain is a working prototype. Everything simulated today has a
            defined production replacement — the data layer, AI function
            signatures, and ledger swap points were designed so each upgrade
            below changes one module without touching the UI.
          </p>
        </div>

        {/* 1 — Real IoT hardware */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="size-5 text-primary" />
                1 · Real IoT hardware (ESP32 sensors)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm leading-6 text-muted-foreground">
              <p>
                Today's readings come from the Demo IoT Data generator. In
                production each hive gets an ESP32 node with a DHT22
                (temperature/humidity), a load-cell HX711 (hive weight), and a
                MEMS microphone (sound/vibration).
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  Nodes POST the same JSON payload shape as
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
                    pushSimulatedReading
                  </code>
                  over Wi-Fi/LoRaWAN to the ingestion endpoint — the
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
                    sensor_data
                  </code>
                  schema is already device-shaped.
                </li>
                <li>
                  Per-device auth keys issued at KVIC cluster level; readings
                  signed at the edge to prevent spoofed ingest.
                </li>
                <li>
                  10-second sampling with on-node averaging; alerts fire on the
                  same rule thresholds (documented in
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
                    aiRules.ts
                  </code>
                  ).
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2 — Live blockchain */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-5 text-primary" />
                2 · Live blockchain network replaces the mock ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm leading-6 text-muted-foreground">
              <p>
                Today's ledger is a SHA-256 hash-chain simulation, labeled
                "Prototype Blockchain Record — Not Yet Connected to a Live
                Chain." The production swap:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  A permissioned network (Hyperledger Besu or Fabric) operated
                  by KVIC + regional co-ops — no public gas costs, known
                  validators.
                </li>
                <li>
                  <code className="rounded bg-muted px-1 font-mono text-[11px]">
                    BatchMetadataPayload
                  </code>{" "}
                  maps 1:1 to a Solidity struct; only
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
                    appendBatchBlock
                  </code>{" "}
                  /
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
                    appendStageBlock
                  </code>{" "}
                  change (one file), keeping the hashing scheme byte-identical
                  so every existing batch ID stays verifiable.
                </li>
                <li>
                  The customer verify page keeps working unchanged — it only
                  needs the recomputed hash comparison, whichever backend
                  produces it.
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3 — Multi-cluster rollout */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-5 text-primary" />
                3 · Rolling out across KVIC clusters & regions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm leading-6 text-muted-foreground">
              <p>
                The prototype runs one beekeeper (BK-001). The schema already
                carries
                <code className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
                  beekeeper_id
                </code>
                on every row — multi-tenancy is a query filter, not a redesign:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  <Users className="mr-1 inline size-3.5" />
                  <b>Beekeeper accounts</b> — Convex Auth (already wired) gains a
                  role claim; every query scopes by the authenticated
                  beekeeper's cluster.
                </li>
                <li>
                  <Server className="mr-1 inline size-3.5" />
                  <b>Regional processing units</b> — processor/admin role
                  (already implemented via
                  <code className="mx-1 rounded bg-muted px-1 font-mono text-[11px]">
                    recordStage
                  </code>
                  ) maps to KVIC unit logins with region-scoped batch queues.
                </li>
                <li>
                  <Radio className="mr-1 inline size-3.5" />
                  <b>State-level dashboards</b> — the analytics queries
                  aggregate by cluster; a read-only KVIC headquarters view rolls
                  up all regions for scheme monitoring.
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-xs leading-5 text-muted-foreground">
            <b className="text-foreground">Honest labeling:</b> this prototype
            uses Demo IoT Data, a rule-based demo AI model, and a hash-chain
            ledger simulation. No live blockchain network, real sensor
            hardware, or trained ML model is connected at this stage — each is
            a designed swap point, not a claim.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
