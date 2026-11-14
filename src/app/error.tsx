"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-critical/40 bg-card p-6">
      <h1 className="text-lg font-medium">This view hit an error</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The scenario state is still in this browser session. Retry the view. If a data source other
        than the mock catalog was configured, set it back to mock.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
