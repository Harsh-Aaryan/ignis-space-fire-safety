import { ActionLink } from "@/components/design/kit";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="micro text-ember-text">Page not found</p>
      <h1 className="mt-2 text-[26px] leading-8 font-medium text-foreground">This page is not part of IGNIS</h1>
      <p className="mt-3 text-[15px] leading-6 text-muted-foreground">
        The address may be out of date. The site has four sections: Overview, Simulation, Research and Results.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ActionLink href={ROUTES.overview} variant="primary">
          Go to the overview
        </ActionLink>
        <ActionLink href={ROUTES.research}>Browse the research</ActionLink>
      </div>
    </div>
  );
}
