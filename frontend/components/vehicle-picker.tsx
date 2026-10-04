"use client";

import { cn } from "cn";
import { Car, Check, ChevronRight } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { create } from "zustand";

import { chooseVehicle, clearVehicle } from "@/app/actions/vehicle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { vehicleGenerationLabel, yearRange } from "@/lib/catalog/labels";
import type { Make, Vehicle } from "@/lib/catalog/types";

const usePicker = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export function useOpenVehiclePicker() {
  const setOpen = usePicker((s) => s.setOpen);
  return () => setOpen(true);
}

/** Mounted once in the layout; any trigger opens it. */
export function VehiclePickerSheet({
  vehicles,
  selectedId,
}: {
  vehicles: Vehicle[];
  selectedId: string | null;
}) {
  const open = usePicker((s) => s.open);
  const setOpen = usePicker((s) => s.setOpen);
  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const [make, setMake] = useState<Make>(selected?.make ?? "toyota");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const models = [...new Set(vehicles.filter((v) => v.make === make).map((v) => v.model))];

  function pick(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await chooseVehicle(id);
      setOpen(false);
      setPendingId(null);
    });
  }

  function clear() {
    startTransition(async () => {
      await clearVehicle();
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="gap-0 overflow-y-auto">
        <SheetHeader className="border-b border-bay px-4 pt-5 pb-4">
          <SheetTitle>Choose your car</SheetTitle>
          <SheetDescription className="max-w-[34ch] text-[15px] text-graphite">
            We only show parts confirmed to fit it. Facelift and pre-facelift parts are different,
            so pick the years on your vehicle papers.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pt-4">
          <div role="group" aria-label="Make" className="grid grid-cols-2 gap-1 rounded-md bg-bay p-1">
            {(["toyota", "lexus"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={make === m}
                onClick={() => setMake(m)}
                className={cn(
                  "h-10 rounded-[4px] font-display text-lg font-semibold transition-colors",
                  make === m ? "bg-paper shadow-[0_1px_0_var(--color-primer)]" : "hover:bg-paper/60",
                )}
              >
                {m === "toyota" ? "Toyota" : "Lexus"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5 px-4 pt-5 pb-6">
          {models.map((model) => (
            <section key={model} aria-labelledby={`model-${model}`}>
              <h3 id={`model-${model}`} className="text-xl">
                {model}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {vehicles
                  .filter((v) => v.make === make && v.model === model)
                  .map((v) => {
                    const isSelected = v.id === selectedId;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => pick(v.id)}
                          disabled={isPending}
                          aria-current={isSelected ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                            isSelected
                              ? "border-amber bg-amber"
                              : "border-primer bg-paper hover:border-graphite",
                          )}
                        >
                          <span>
                            <span className="block font-display text-xl leading-tight font-bold tabular">
                              {yearRange(v)}
                            </span>
                            <span className="block text-sm">{vehicleGenerationLabel(v)}</span>
                          </span>
                          {pendingId === v.id ? (
                            <span className="text-sm font-semibold">Saving…</span>
                          ) : isSelected ? (
                            <Check aria-label="Selected" className="size-5" />
                          ) : (
                            <ChevronRight aria-hidden className="size-5 text-primer" />
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>

        {selected ? (
          <div className="mt-auto border-t border-bay px-4 py-4">
            <Button variant="ghost" className="w-full" onClick={clear} disabled={isPending}>
              Clear my car and show every part
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Header chip. Amber when a car is selected; a dashed empty slot when not. */
export function VehicleChip({ label, className }: { label: string | null; className?: string }) {
  const openPicker = useOpenVehiclePicker();
  return (
    <button
      type="button"
      onClick={openPicker}
      className={cn(
        "inline-flex h-11 min-w-0 items-center gap-2 rounded-md px-3 text-left text-[15px] font-semibold transition-colors",
        label
          ? "bg-amber text-graphite hover:shadow-[inset_0_0_0_2px_var(--color-graphite)]"
          : "border-[1.5px] border-dashed border-graphite hover:bg-paper",
        className,
      )}
    >
      <Car aria-hidden className="size-[18px] shrink-0" />
      {label ? (
        <span className="min-w-0 truncate">
          <span className="sr-only">Your car: </span>
          {label}
          <span className="ml-2 font-medium underline underline-offset-2">Change</span>
        </span>
      ) : (
        "Choose your car"
      )}
    </button>
  );
}

export function ChooseCarButton({
  children = "Choose your car",
  className,
  variant = "default",
}: {
  children?: ReactNode;
  className?: string;
  variant?: "default" | "outline";
}) {
  const openPicker = useOpenVehiclePicker();
  return (
    <Button variant={variant} className={className} onClick={openPicker}>
      <Car aria-hidden />
      {children}
    </Button>
  );
}
