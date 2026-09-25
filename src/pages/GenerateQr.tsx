import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Hexagon, QrCode, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import QRCode from "qrcode";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * QR GENERATOR — the "beekeeper prints a jar label" step of Module 1.
 * Encodes `${origin}/verify/{batch_id}` so any phone camera opens the
 * public verification page. In production this PNG would be printed on the
 * jar label at packaging time (see README scaling notes).
 */
export default function GenerateQrPage() {
  const batchIds = useQuery(api.traceability.listBatchIds, {});
  const [params] = useSearchParams();
  const [batchId, setBatchId] = useState(params.get("batch") ?? "");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Encode an absolute URL so the QR works from any phone on the network.
  const verifyUrl = useMemo(
    () => `${window.location.origin}/verify/${encodeURIComponent(batchId.trim().toUpperCase())}`,
    [batchId],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!batchId.trim()) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(verifyUrl, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#3a2a12", light: "#00000000" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError("Could not generate QR for this batch ID.");
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl, batchId]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `honey-chain-qr-${batchId.trim().toUpperCase() || "batch"}.png`;
    a.click();
  };

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="size-5 text-primary" />
              Generate jar QR code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="batch-id"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Batch ID
                </label>
                <Input
                  id="batch-id"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="HC-2026-0001"
                  className="font-mono uppercase placeholder:normal-case"
                />
              </div>
              {batchIds && batchIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {batchIds.slice(0, 3).map((id) => (
                    <Button
                      key={id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="font-mono text-xs"
                      onClick={() => setBatchId(id)}
                    >
                      {id}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <motion.div
              key={verifyUrl}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-primary/30 bg-secondary/50 p-6"
            >
              {dataUrl ? (
                <>
                  <img
                    src={dataUrl}
                    alt={`QR code for batch ${batchId}`}
                    className="h-56 w-56 rounded-lg"
                  />
                  <div className="text-center">
                    <Badge variant="secondary" className="font-mono">
                      {batchId.trim().toUpperCase()}
                    </Badge>
                    <p className="mt-2 max-w-xs break-all font-mono text-[11px] text-muted-foreground">
                      {verifyUrl}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={download} className="gap-2">
                      <Download className="size-4" />
                      Download PNG
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                      <a href={`/verify/${encodeURIComponent(batchId.trim().toUpperCase())}`}>
                        <RefreshCw className="size-4" />
                        Test the scan
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground">
                  <p className="px-6 text-center text-xs">
                    Enter a batch ID to render its jar label QR
                  </p>
                </div>
              )}
            </motion.div>

            <p className="text-xs leading-5 text-muted-foreground">
              The QR encodes the public verification URL for this batch. Scanning
              it opens <code className="font-mono">/verify/{"{batch_id}"}</code>,
              where the server recomputes the SHA-256 content hash against the
              ledger before showing the "Blockchain Verified ✓" badge.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
