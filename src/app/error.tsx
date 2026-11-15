"use client";

import { actionClass } from "@/components/design/kit";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-[26px] leading-8 font-medium text-foreground">This view could not be shown</h1>
      <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
        Something went wrong while drawing this page. Your cabin scenario is still saved in this browser session.
      </p>
      <button type="button" onClick={reset} className={`${actionClass("primary")} mt-6`}>
        Try again
      </button>
    </div>
  );
}
