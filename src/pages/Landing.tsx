import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  Hexagon,
  Link2,
  Loader2,
  QrCode,
  ScanLine,
  Sparkles,
  Sprout,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Home screen (v1 scope): the scan-a-QR box is the first thing a user sees.
 * Demo data (hives, sensor stream, one verified batch) is auto-seeded on the
 * first visit so a reviewer immediately has a batch to verify.
 */
export default function Landing() {
  const navigate = useNavigate();
  const seedDemo = useMutation(api.demo.seedDemoData);
  const batchIds = useQuery(api.traceability.listBatchIds, {});
  const [code, setCode] = useState("");
  const seedTriggered = useRef(false);

  // One-click demo: seed the full end-to-end chain when DB is empty.
  useEffect(() => {
    if (batchIds !== undefined && batchIds.length === 0 && !seedTriggered.current) {
      seedTriggered.current = true;
      void seedDemo();
    }
  }, [batchIds, seedDemo]);

  const go = (raw: string) => {
    const id = raw.trim().toUpperCase();
    if (id) navigate(`/verify/${encodeURIComponent(id)}`);
  };

  return (
    <div className="honeycomb-bg min-h-screen">
      {/* Navbar */}
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12">
              <Hexagon className="size-5 text-primary" />
            </span>
            <span className="text-sm font-bold tracking-tight">Honey Chain</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/generate-qr">Jar QR</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">Beekeeper portal</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Announcement strip */}
      <div className="border-b border-primary/15 bg-primary/10">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-foreground/80">
          <Sparkles className="size-3.5 text-primary" />
          KVIC Honey Mission · blockchain honey traceability prototype
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col px-4">
        {/* ---- Hero with scan-a-QR box ---- */}
        <section className="flex flex-col items-center pt-16 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            <Badge variant="secondary" className="mb-5 gap-1.5 px-3 py-1">
              <Hexagon className="size-3.5 text-primary" />
              Traceable from hive to jar
            </Badge>
            <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Every jar tells the truth.
              <span className="block text-primary">Prove it in one scan.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Honey Chain seals each honey batch's harvest, processing, and
              packaging record on a tamper-evident hash-chain ledger. Scan the
              QR on any jar to verify it — no app, no login.
            </p>
          </motion.div>

          {/* Scan-a-QR box */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-8 w-full max-w-md"
          >
            <Card className="border-primary/25">
              <CardContent className="p-6">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/12">
                  <QrCode className="size-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Verify a jar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scan the QR code on your Honey Chain jar, or enter the batch
                  ID printed under it.
                </p>
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(code);
                  }}
                >
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. HC-2026-0001"
                    className="font-mono text-sm uppercase placeholder:normal-case"
                    aria-label="Batch ID"
                  />
                  <Button type="submit" className="gap-2">
                    <ScanLine className="size-4" />
                    Verify
                  </Button>
                </form>

                {batchIds === undefined ? (
                  <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Preparing demo batches…
                  </p>
                ) : batchIds.length > 0 ? (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Try a live verified batch:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {batchIds.slice(0, 4).map((id) => (
                        <Button
                          key={id}
                          variant="secondary"
                          size="sm"
                          className="font-mono text-xs"
                          onClick={() => go(id)}
                        >
                          <BadgeCheck className="size-3.5 text-primary" />
                          {id}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
                      <Link
                        to="/generate-qr"
                        className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
                      >
                        <QrCode className="size-3.5" />
                        Generate a jar QR code
                      </Link>
                      <span className="text-border">|</span>
                      <Link
                        to="/marketplace"
                        className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
                      >
                        <BadgeCheck className="size-3.5" />
                        Marketplace
                      </Link>
                      <span className="text-border">|</span>
                      <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
                      >
                        <Sprout className="size-3.5" />
                        Beekeeper sign-in
                      </Link>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>

          <Button asChild variant="ghost" className="mt-6 gap-2 text-muted-foreground">
            <Link to="/verify/HC-2026-0001">
              See a sample verification report
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>

        {/* ---- How it works ---- */}
        <section className="grid gap-4 pb-12 sm:grid-cols-3">
          {[
            {
              icon: <Hexagon className="size-5" />,
              title: "Sealed at the apiary",
              body: "Beekeepers register hives and log harvest → processing → packaging. Batch metadata is hashed onto the ledger as an immutable block.",
            },
            {
              icon: <Link2 className="size-5" />,
              title: "Hash-chained ledger",
              body: "Each block embeds the previous block's hash. Editing any historical record breaks every later hash — tampering becomes detectable.",
            },
            {
              icon: <Eye className="size-5" />,
              title: "Open to every customer",
              body: "The QR opens a public page that recomputes the SHA-256 content hash live and shows the full product history. Trust without trusting us.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
            >
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-2.5 p-5">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="text-xs leading-5 text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        {/* ---- Footer ---- */}
        <footer className="flex flex-col items-center gap-1 border-t border-border/70 py-6 text-center">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Hexagon className="size-4 text-primary" />
            Honey Chain
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            Prototype for KVIC's Honey Mission — simulated IoT hive sensors, an
            explainable AI colony-health layer, and hash-chained batch
            traceability. Blockchain-principles simulation; not a live chain.
          </p>
        </footer>
      </div>
    </div>
  );
}
