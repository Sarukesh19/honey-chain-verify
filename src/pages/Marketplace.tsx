import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Droplets,
  Hexagon,
  QrCode,
  ScanLine,
} from "lucide-react";
import { Link } from "react-router";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * MARKET LINKAGE (Module 4) — verified batches listed for sale.
 * Every product links to its public verification page, telling the
 * "verified product → market trust" story.
 */
export default function Marketplace() {
  const batches = useQuery(api.apiary.listVerifiedBatches, {});

  return (
    <main className="honeycomb-bg min-h-screen">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </Button>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Hexagon className="size-3.5 text-primary" />
            Honey Chain · Verified marketplace
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="text-center">
          <Badge variant="secondary" className="mb-3 gap-1.5">
            <BadgeCheck className="size-3.5 text-primary" />
            Every listing is ledger-verified
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">
            Traceable honey, direct from the apiary
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Each jar below belongs to a batch sealed on the Honey Chain ledger.
            Scan or tap to see its full harvest → packaging history before you
            buy.
          </p>
        </div>

        {batches === undefined ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Loading verified batches…
            </CardContent>
          </Card>
        ) : batches.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No verified batches yet — create one from the beekeeper portal.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((b, i) => (
              <motion.div
                key={b.batch_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                        <Droplets className="size-5" />
                      </div>
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <BadgeCheck className="size-3 text-primary" />
                        Verified
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{b.floral_source}</h3>
                      <p className="text-xs text-muted-foreground">
                        {b.beekeeper_name} · Hive {b.hive_id}
                      </p>
                    </div>
                    <div className="mt-auto flex items-end justify-between">
                      <div>
                        <p className="text-lg font-bold">₹{Math.round(b.quantity_kg * 28)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {b.quantity_kg} kg batch · harvested {b.harvest_date}
                        </p>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {b.batch_id}
                      </p>
                    </div>
                    <Button asChild size="sm" className="w-full gap-2">
                      <Link to={`/verify/${b.batch_id}`}>
                        <ScanLine className="size-4" />
                        View traceability
                      </Link>
                    </Button>
                    <Link
                      to={`/generate-qr?batch=${b.batch_id}`}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <QrCode className="size-3.5" />
                      Jar label QR
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
