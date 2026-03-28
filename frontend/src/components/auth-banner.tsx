"use client";

import { useState, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { getHealth } from "@/lib/api";

export function AuthBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getHealth()
      .then(({ claude }) => {
        if (!claude?.authenticated) setShow(true);
      })
      .catch(() => {
        // API not reachable — don't show banner (separate problem)
      });
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          Claude is not authenticated. AI features (content generation, pipelines) will not work.
          Set <code className="bg-red-700 px-1 rounded">ANTHROPIC_API_KEY</code> in .env or run setup.
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="p-1 hover:bg-red-700 rounded">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
