import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-lg font-medium">That page is not part of IGNIS</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The modules are Mission Overview, FireTwin, Research Explorer, GravityBridge, FireLab AI,
        and Reports.
      </p>
      <Button className="mt-4" nativeButton={false} render={<Link href="/" />}>
        Return to the mission
      </Button>
    </div>
  );
}
