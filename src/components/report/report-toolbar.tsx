"use client";

import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Report actions. "Download" uses the browser's print-to-PDF (window.print)
 * against a print-optimized stylesheet — zero server dependency and works
 * everywhere. TODO(production): server-side PDF (e.g. @react-pdf/renderer or a
 * headless-Chromium render) for pixel-perfect branded exports + emailing.
 */
export function ReportToolbar() {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Download className="h-4 w-4" /> Download PDF
      </Button>
    </div>
  );
}
