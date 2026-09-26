import { useBatchVerification } from "@/lib/dataLayer";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Droplets,
  FlaskConical,
  Download,
  Hexagon,
  Link2,
  Loader2,
  Share2,
  MapPin,
  Package,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/** Public, no-login page opened by scanning a batch QR code (/verify/{batch_id}). */
export default function VerifyPage() {
  const { batchId = "" } = useParams();
  const result = useBatchVerification(batchId);

  return (
    <main className="honeycomb-bg min-h-screen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Hexagon className="size-3.5 text-primary" />
            Honey Chain · KVIC Honey Mission
          </div>
        </div>

        {result === undefined ? (
          <LoadingState />
        ) : result === null ? (
          <NotFoundState batchId={batchId} />
        ) : (
          <VerifiedReport result={result} />
        )}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
      <Loader2 className="size-7 animate-spin text-primary" />
      <p className="text-sm">Recomputing batch hash against the ledger…</p>
    </div>
  );
}

function NotFoundState({ batchId }: { batchId: string }) {
  return (
    <Card className="border-destructive/30 bg-card">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="size-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold">Batch not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          No honey batch exists with ID{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {batchId}
          </code>
          . Check the QR code or batch label and try again.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link to="/">Back to verification home</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface IntegrityReport {
  batch_id: string;
  computed_content_hash: string;
  on_chain_content_hash: string;
  hash_match: boolean;
  tx_hash: string;
  tx_hash_valid: boolean;
  prev_hash_valid: boolean;
  chain_intact: boolean;
  block_number: number;
  recorded_at: number;
  anomaly: string | null;
}

interface TimelineEntry {
  stage: string;
  actor: string;
  note: string | null;
  block_number: number;
  tx_hash: string;
  recorded_at: number;
}

interface VerifyResult {
  batch: {
    batch_id: string;
    hive_id: string;
    beekeeper_id: string;
    beekeeper_name: string;
    harvest_date: string;
    harvest_location: string | null;
    processing_date: string | null;
    packaging_date: string | null;
    distributed_date: string | null;
    quantity_kg: number;
    floral_source: string;
    status: string;
    content_hash: string;
    tx_hash: string;
    block_number: number;
    created_at: number;
  };
  hive: { hive_id: string; location: string; status: string } | null;
  timeline: TimelineEntry[];
  integrity: IntegrityReport | null;
}

function VerifiedReport({ result }: { result: VerifyResult }) {
  const { batch, hive, integrity, timeline } = result;
  const verified = integrity?.chain_intact ?? false;
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  /**
   * EXPORT / SHARE — render the verdict card to a PNG certificate via snapdom
   * (same library the preview toolbar uses), then download it and offer Web
   * Share on mobile. Prototype feature: the image is generated client-side
   * from the live verification data.
   */
  const exportCertificate = async (share: boolean) => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const { snapdom } = await import("@zumer/snapdom");
      const canvas = await snapdom.toCanvas(cardRef.current, {
        fast: false,
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      if (share && typeof navigator.share === "function") {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `honey-chain-certificate-${batch.batch_id}.png`, {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `Honey Chain Certificate — ${batch.batch_id}`,
            text: `Batch ${batch.batch_id} verified on the Honey Chain ledger.`,
            files: [file],
          });
          return;
        }
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `honey-chain-certificate-${batch.batch_id}.png`;
      a.click();
    } catch (err) {
      console.error("Certificate export failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Export / share actions ---- */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => void exportCertificate(true)}
        >
          <Share2 className="size-4" />
          Share certificate
        </Button>
        <Button
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => void exportCertificate(false)}
        >
          <Download className="size-4" />
          Download certificate (PNG)
        </Button>
      </div>

      {/* ---- Verification verdict (captured as the certificate) ---- */}
      <div ref={cardRef}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card
          className={
            verified
              ? "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card"
              : "border-destructive/40 bg-gradient-to-br from-destructive/10 via-card to-card"
          }
        >
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 16 }}
              className={
                verified
                  ? "flex size-16 items-center justify-center rounded-full bg-primary/15 ring-4 ring-primary/20"
                  : "flex size-16 items-center justify-center rounded-full bg-destructive/15 ring-4 ring-destructive/20"
              }
            >
              {verified ? (
                <ShieldCheck className="size-9 text-primary" />
              ) : (
                <ShieldAlert className="size-9 text-destructive" />
              )}
            </motion.div>
            <div className="flex items-center gap-2">
              {verified ? (
                <BadgeCheck className="size-5 text-primary" />
              ) : (
                <X className="size-5 text-destructive" />
              )}
              <h1 className="text-2xl font-bold tracking-tight">
                {verified ? "Blockchain Verified ✓" : "Verification Failed"}
              </h1>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              {verified
                ? `Hash recomputed from this batch's sealed record matches the ledger — batch ${batch.batch_id} has not been tampered with since recording.`
                : (integrity?.anomaly ??
                  "This batch has no ledger record; its authenticity cannot be proven.")}
            </p>
            <Badge
              variant={verified ? "default" : "destructive"}
              className="mt-1 gap-1.5"
            >
              {verified ? "Authentic · Tamper-proof" : "Do not trust this batch"}
            </Badge>
          </CardContent>
        </Card>
      </motion.div>
      </div>

      {/* ---- Product details ---- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Droplets className="size-5 text-primary" />
              Product history
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Detail
                icon={<Package className="size-4" />}
                label="Batch ID"
                value={batch.batch_id}
              />
              <Detail
                icon={<Hexagon className="size-4" />}
                label="Hive"
                value={batch.hive_id}
              />
              <Detail
                icon={<User className="size-4" />}
                label="Beekeeper"
                value={`${batch.beekeeper_name} (${batch.beekeeper_id})`}
              />
              <Detail
                icon={<Droplets className="size-4" />}
                label="Floral source"
                value={batch.floral_source}
              />
              <Detail
                icon={<MapPin className="size-4" />}
                label="Harvest location"
                value={batch.harvest_location ?? hive?.location ?? "—"}
              />
              <Detail
                icon={<Package className="size-4" />}
                label="Quantity"
                value={`${batch.quantity_kg} kg`}
              />
            </div>

            <Separator />

            {/* Supply-chain timeline: harvest → processing → packaging → distribution */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Supply chain timeline
              </p>
              <ol className="flex flex-col gap-0">
                {[
                  { label: "Harvested", date: batch.harvest_date, icon: <Droplets className="size-4" /> },
                  { label: "Processed", date: batch.processing_date, icon: <FlaskConical className="size-4" /> },
                  { label: "Packaged", date: batch.packaging_date, icon: <Package className="size-4" /> },
                  { label: "Distributed", date: batch.distributed_date, icon: <Truck className="size-4" /> },
                ].map((step, i, arr) => (
                  <li key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex size-8 items-center justify-center rounded-full ${
                          step.date
                            ? "bg-primary/12 text-primary"
                            : "bg-muted text-muted-foreground/50"
                        }`}
                      >
                        {step.icon}
                      </div>
                      {i < arr.length - 1 && (
                        <div className="my-1 w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className={`text-sm font-medium ${step.date ? "" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        {step.date ?? "Pending"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Traceability checklist ---- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BadgeCheck className="size-5 text-primary" />
              Traceability
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              {
                ok: true,
                label: "Source Verified",
                detail: `Hive ${batch.hive_id}${hive ? ` · ${hive.location}` : ""}`,
              },
              {
                ok: Boolean(timeline.some((t) => t.stage === "created")),
                label: "Batch Verified",
                detail: `Sealed as block #${batch.block_number}`,
              },
              {
                ok: Boolean(timeline.some((t) => t.stage === "processed")),
                label: "Processing Recorded",
                detail: batch.processing_date ?? "Not yet processed",
              },
              {
                ok: Boolean(timeline.some((t) => t.stage === "packaged")),
                label: "Packaging Recorded",
                detail: batch.packaging_date ?? "Not yet packaged",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
              >
                {item.ok ? (
                  <BadgeCheck className="size-5 shrink-0 text-primary" />
                ) : (
                  <ShieldAlert className="size-5 shrink-0 text-muted-foreground/50" />
                )}
                <div>
                  <p className={`text-sm font-medium ${item.ok ? "" : "text-muted-foreground"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Verified on Blockchain (prominent) ---- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14 }}
      >
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="size-5 text-primary" />
              Verified on Blockchain
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <CheckItem ok={integrity?.hash_match ?? false} label="Content hash match" />
              <CheckItem ok={integrity?.tx_hash_valid ?? false} label="Block signature valid" />
              <CheckItem ok={integrity?.prev_hash_valid ?? false} label="Chain link intact" />
            </div>
            <HashRow label="Content hash (SHA-256)" hash={batch.content_hash} />
            <HashRow label="Transaction hash (block ID)" hash={batch.tx_hash} />
            <p className="text-xs leading-5 text-muted-foreground">
              Batch metadata was sealed as block #{batch.block_number} at{" "}
              {new Date(batch.created_at).toLocaleString()}. Hashes are
              recomputed on every scan; any tampering would break the chain and
              flag this batch. Prototype Blockchain Record — Not Yet Connected
              to a Live Chain (SHA-256 hash-chain simulation). Raw IoT sensor
              data is never stored on-chain.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---- Ledger proof (technical detail) ---- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="size-5 text-primary" />
              Ledger proof
              <span className="text-xs font-normal text-muted-foreground">
                (hash-chain record, block #{batch.block_number})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <CheckItem
                ok={integrity?.hash_match ?? false}
                label="Content hash match"
              />
              <CheckItem
                ok={integrity?.tx_hash_valid ?? false}
                label="Block signature valid"
              />
              <CheckItem
                ok={integrity?.prev_hash_valid ?? false}
                label="Chain link intact"
              />
            </div>
            <HashRow label="Content hash (SHA-256)" hash={batch.content_hash} />
            <HashRow label="Transaction hash (block ID)" hash={batch.tx_hash} />
            <p className="text-xs leading-5 text-muted-foreground">
              Batch metadata was sealed on the Honey Chain ledger at{" "}
              {new Date(batch.created_at).toLocaleString()} as block{" "}
              #{batch.block_number}. The hash above is recomputed from the stored
              record on every scan — any edit to harvest, processing, or
              packaging data would break the chain and flag this batch.
              Raw IoT sensor data is deliberately kept off-chain and is never
              part of this proof.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
      {ok ? (
        <BadgeCheck className="size-4 shrink-0 text-primary" />
      ) : (
        <ShieldAlert className="size-4 shrink-0 text-destructive" />
      )}
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function HashRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <code className="block break-all rounded-md bg-muted/60 px-3 py-2 font-mono text-[11px] leading-4 text-foreground/80">
        {hash}
      </code>
    </div>
  );
}
