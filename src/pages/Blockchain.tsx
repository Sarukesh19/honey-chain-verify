import { motion } from "framer-motion";
import { ArrowLeft, Blocks, Hexagon, Link2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Link as LinkIcon } from "lucide-react";

import { useBatchBlocks, useBatchIds } from "@/lib/dataLayer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BlockRow {
  block_number: number;
  stage: string;
  tx_hash: string;
  prev_hash: string;
  content_hash: string;
  payload: Record<string, unknown>;
  created_at: number;
}

/**
 * BLOCKCHAIN TRACEABILITY (Module 6) — visual block timeline per batch.
 * PROTOTYPE BLOCKCHAIN RECORD: this is the hash-chained simulation
 * (ledger.ts), not a live chain — labeled as such throughout the UI.
 */
export default function Blockchain() {
  const [params] = useSearchParams();
  const batches = useBatchIds();
  const [selected, setSelected] = useState(params.get("batch") ?? "");
  const activeId = selected || batches?.[0] || "";
  const blocks = useBatchBlocks(activeId);

  const stageIcons: Record<string, string> = {
    batch_created: "📦",
    harvested: "🍯",
    processed: "🏭",
    packaged: "🫙",
    distributed: "🚚",
  };

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
            Prototype Blockchain Record
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <div>
          <Badge variant="secondary" className="mb-3 gap-1.5">
            <Blocks className="size-3.5 text-primary" />
            Prototype Blockchain Record — Not Yet Connected to a Live Chain
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">
            Blockchain traceability
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every lifecycle event of a batch is sealed as a block whose hash
            commits to the previous block — any historical edit would break the
            chain and be flagged on the customer verification page. This
            prototype uses a SHA-256 hash-chain simulation, not a live
            blockchain network.
          </p>
        </div>

        {/* Batch selector */}
        <div className="flex flex-wrap gap-2">
          {(batches ?? []).map((id) => (
            <Button
              key={id}
              size="sm"
              variant={id === activeId ? "default" : "secondary"}
              className="font-mono text-xs"
              onClick={() => setSelected(id)}
            >
              {id}
            </Button>
          ))}
        </div>

        {/* Block timeline */}
        {blocks === undefined ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Loading blocks…
            </CardContent>
          </Card>
        ) : blocks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No blocks for this batch yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col">
            {blocks.map((b, i) => (
              <motion.div
                key={b.tx_hash}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.07 }}
                className="flex gap-3"
              >
                <div className="flex flex-col items-center">
                  <div className="flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-lg">
                    {stageIcons[b.stage] ?? "📦"}
                  </div>
                  {i < blocks.length - 1 && (
                    <div className="my-1 w-px flex-1 bg-gradient-to-b from-primary/40 to-border" />
                  )}
                </div>
                <Card className="mb-4 flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono">
                        Block #{String(b.block_number).padStart(3, "0")}
                      </span>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {b.stage.replace("_", " ")}
                      </Badge>
                      {i === 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          genesis-linked
                        </Badge>
                      )}
                      <ShieldCheck className="ml-auto size-4 text-primary" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-xs">
                    <div className="grid gap-1.5">
                      <HashLine label="tx_hash" hash={b.tx_hash} />
                      <HashLine label="prev_hash" hash={b.prev_hash} />
                      <HashLine label="content_hash" hash={b.content_hash} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Sealed{" "}
                      {new Date(b.created_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          <LinkIcon className="mr-1 inline size-3.5" />
          How the chain works: tx_hash = SHA-256(block content + prev_hash), so
          each block cryptographically commits to the one before it. Only batch
          metadata and hashes are stored on the ledger — raw IoT sensor data
          never goes on-chain.
        </p>
      </div>
    </main>
  );
}

function HashLine({ label, hash }: { label: string; hash: string }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase text-muted-foreground">
        {label}
      </span>
      <code className="block break-all rounded bg-muted/60 px-2 py-1 font-mono text-[10px] text-foreground/80">
        {hash}
      </code>
    </div>
  );
}
