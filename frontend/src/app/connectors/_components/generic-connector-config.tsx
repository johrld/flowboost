"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Save } from "lucide-react";
import type { ConnectorDef, SaveStatus } from "../_lib/types";

// ── Save Button ──────────────────────────────────────────────────

export function SaveButton({ status, onClick }: { status: SaveStatus; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={status === "saving"}>
      {status === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {status === "saved" && <Check className="mr-2 h-4 w-4" />}
      {status === "error" && <AlertCircle className="mr-2 h-4 w-4" />}
      {status === "idle" && <Save className="mr-2 h-4 w-4" />}
      {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Error — Retry" : "Save"}
    </Button>
  );
}

export async function withSave(setStatus: (s: SaveStatus) => void, fn: () => Promise<void>) {
  setStatus("saving");
  try {
    await fn();
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  } catch {
    setStatus("error");
  }
}

// ── Generic Connector Config ─────────────────────────────────────

export function GenericConnectorConfig({
  connector,
  values,
  onValueChange,
  testStatus,
  testError,
  testInfo,
  onTest,
  saveStatus,
  onSave,
  isConnected,
  enabledStreams,
  onStreamToggle,
}: {
  connector: ConnectorDef;
  values: Record<string, string>;
  onValueChange: (key: string, val: string) => void;
  testStatus: "idle" | "testing" | "success" | "error";
  testError: string;
  testInfo: string;
  onTest: () => void;
  saveStatus: SaveStatus;
  onSave: () => void;
  isConnected: boolean;
  enabledStreams?: string[];
  onStreamToggle?: (streamId: string, enabled: boolean) => void;
}) {
  if (!connector.fields) return null;
  const allFilled = connector.fields.every((f) => !!values[f.key]);

  return (
    <div className="flex gap-8">
      <div className="flex-1 max-w-lg space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Connection</h2>
          <p className="text-sm text-muted-foreground">{connector.name} credentials</p>
        </div>

        <div className="space-y-4">
          {connector.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <Input
                type={field.type === "password" ? "password" : "text"}
                value={values[field.key] ?? ""}
                onChange={(e) => onValueChange(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onTest} disabled={testStatus === "testing" || !allFilled}>
            {testStatus === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {testStatus === "success" && <Check className="mr-2 h-4 w-4 text-green-600" />}
            {testStatus === "error" && <AlertCircle className="mr-2 h-4 w-4 text-destructive" />}
            Test Connection
          </Button>
          <SaveButton status={saveStatus} onClick={onSave} />
        </div>

        {testStatus === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-300">{testError}</p>
          </div>
        )}

        {(testStatus === "success" || isConnected) && testStatus !== "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              Connected{testInfo ? ` — ${testInfo}` : ""}
            </p>
          </div>
        )}

        {/* Source Streams */}
        {isConnected && connector.streams && connector.streams.length > 0 && onStreamToggle && (
          <div className="border-t pt-6 space-y-3">
            <div>
              <p className="text-sm font-medium">Source Streams</p>
              <p className="text-xs text-muted-foreground">
                Enable data streams to use as input sources
              </p>
            </div>
            {connector.streams.map((stream) => {
              const isEnabled = enabledStreams
                ? enabledStreams.includes(stream.id)
                : stream.defaultEnabled;
              return (
                <label key={stream.id} className="flex items-center justify-between gap-4 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{stream.label}</span>
                    <Badge variant="secondary" className="text-[10px] font-normal">{stream.dataType}</Badge>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => onStreamToggle(stream.id, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Setup guide */}
      {connector.setupGuide && (
        <div className="w-72 shrink-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Setup Guide</h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                {connector.setupGuide.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
