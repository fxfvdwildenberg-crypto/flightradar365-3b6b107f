import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const KEY = "atc365-tutorial-v1";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Pick a region",
    body: "Open the menu and choose an island. Pinch or scroll to zoom — the map fades into the high-resolution in-game imagery as you get closer.",
  },
  {
    title: "Airports and ATIS",
    body: "Every airport pill shows the online controllers (G, T, C) and the current ATIS letter. Tap it for the full ATIS report, in-game info and the departure and arrival boards.",
  },
  {
    title: "File a flight plan",
    body: "Use Flight plan in the bottom dock. Give a callsign, aircraft, departure and arrival airport plus times — your aircraft then appears on the radar automatically at the right time.",
  },
  {
    title: "Track and follow",
    body: "Tap any aircraft for live altitude, speed, squawk and route. Star it to keep it in your favourites widget, and watch for red aircraft — those are emergency squawks.",
  },
  {
    title: "Controllers",
    body: "Claim ATC to go online at an airport, publish an ATIS, and review filed flight plans on the ATC page where you can approve, deny and assign squawks.",
  },
];

export function Tutorial() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(KEY) !== "1") setOpen(true);
  }, []);

  const finish = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  const current = STEPS[step]!;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : finish())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
            <Logo className="h-7" />
          </DialogTitle>
        </DialogHeader>
        <div>
          <h3 className="font-display text-lg text-foreground">{current.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>
          <div className="mt-4 flex justify-center gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={i === step ? "size-1.5 rounded-full bg-primary" : "size-1.5 rounded-full bg-border"}
              />
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={finish}>Start tracking</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lets the sidebar re-open the walkthrough. */
export function resetTutorial() {
  localStorage.removeItem(KEY);
  window.location.reload();
}
