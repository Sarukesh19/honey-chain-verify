/**
 * HONEY CHAIN — Shared hive CRUD dialogs + demo beekeeper switcher.
 * Used by Dashboard, Hives list, and HiveDetails so every surface has the
 * same add/edit/remove behavior. All writes go through the data layer and
 * reflect everywhere instantly (Convex reactive queries).
 */

import {
  useCreateHive,
  useDeleteHive,
  useDashboard,
  useDemoProfile,
  useHiveAssociations,
  useUpdateHive,
  type Hive,
} from "@/lib/dataLayer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const strengthOptions = ["strong", "medium", "weak"];
const statusOptions = ["healthy", "warning", "disease_risk"];

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm capitalize"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Register a new hive for the active beekeeper profile. */
export function AddHiveDialog({ trigger }: { trigger?: React.ReactNode }) {
  const createHive = useCreateHive();
  const { profile } = useDemoProfile();
  const [open, setOpen] = useState(false);
  const [hiveId, setHiveId] = useState("");
  const [location, setLocation] = useState("");
  const [strength, setStrength] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="size-4" />
            Add hive
          </Button>
        )}
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
                beekeeper_id: profile.id,
                beekeeper_name: profile.name,
                hive_age_days: 0,
                colony_strength: strength,
              });
              setOpen(false);
              setHiveId("");
              setLocation("");
              setStrength("medium");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to create hive.",
              );
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
          <SelectField
            id="hive-strength"
            label="Colony strength"
            value={strength}
            onChange={setStrength}
            options={strengthOptions.map((s) => ({ value: s, label: s }))}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Registering…" : "Register hive"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Edit an existing hive's location / colony strength / status. */
export function EditHiveDialog({
  hive,
  trigger,
}: {
  hive: Pick<Hive, "hive_id" | "location" | "colony_strength" | "status">;
  trigger?: React.ReactNode;
}) {
  const updateHive = useUpdateHive();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState(hive.location);
  const [strength, setStrength] = useState(hive.colony_strength);
  const [status, setStatus] = useState(hive.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${hive.hive_id}`}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit hive {hive.hive_id}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await updateHive({
                hive_id: hive.hive_id,
                location,
                colony_strength: strength,
                status,
              });
              setOpen(false);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to update hive.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-hive-loc">Location</Label>
            <Input
              id="edit-hive-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>
          <SelectField
            id="edit-hive-strength"
            label="Colony strength"
            value={strength}
            onChange={setStrength}
            options={strengthOptions.map((s) => ({ value: s, label: s }))}
          />
          <SelectField
            id="edit-hive-status"
            label="Status"
            value={status}
            onChange={setStatus}
            options={statusOptions.map((s) => ({
              value: s,
              label: s.replace("_", " "),
            }))}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Remove-hive confirmation with associated-data warning. Deleting clears the
 * hive's sensor/AI/alert history immediately; ledger-sealed honey batches are
 * kept for traceability (their hive reference remains for provenance).
 */
export function DeleteHiveDialog({
  hiveId,
  trigger,
  onDeleted,
}: {
  hiveId: string;
  trigger?: React.ReactNode;
  onDeleted?: () => void;
}) {
  const deleteHive = useDeleteHive();
  const associations = useHiveAssociations(hiveId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            aria-label={`Remove ${hiveId}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove hive {hiveId}?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Are you sure you want to remove Hive{" "}
            <span className="font-mono font-medium text-foreground">
              {hiveId}
            </span>
            ? This cannot be undone.
          </p>
          {associations && (
            <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <p>
                This hive has{" "}
                <span className="font-semibold text-foreground">
                  {associations.honey_batches} associated honey batch
                  {associations.honey_batches === 1 ? "" : "es"}
                </span>{" "}
                and {associations.sensor_readings} sensor reading
                {associations.sensor_readings === 1 ? "" : "s"}.
              </p>
              <p className="mt-1">
                Removing it deletes the sensor history and alerts
                {associations.honey_batches > 0
                  ? ", while their ledger-sealed honey batches remain traceable on the chain (hive reference kept for provenance)"
                  : ""}
                .
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await deleteHive({ hive_id: hiveId });
                setOpen(false);
                onDeleted?.();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Removing…" : "Yes, remove hive"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * DEMO LOGIN — switch the active beekeeper profile (no password, prototype
 * only). Switching re-scopes every dashboard stat, hive and batch list.
 */
export function BeekeeperSwitcher() {
  const { profile, setProfile, profiles } = useDemoProfile();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus className="size-3.5" />
        <span className="max-w-28 truncate">{profile.name}</span>
        <ChevronsUpDown className="size-3.5 opacity-60" />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Close profile menu"
          />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-card p-2 shadow-lg">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Demo beekeeper (no real auth)
            </p>
            {profiles.map((p) => (
              <button
                key={p.id}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                  p.id === profile.id ? "bg-primary/10" : "hover:bg-muted"
                }`}
                onClick={() => {
                  setProfile(p);
                  setOpen(false);
                }}
              >
                <span>
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    {p.id}
                  </span>
                </span>
                {p.id === profile.id && (
                  <Check className="size-4 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
