"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/Button";

/** The print styles in globals.css strip shadows and hide `.no-print` chrome. */
export function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      Print / Save as PDF
    </Button>
  );
}

export default PrintButton;
