export default function Loading() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading">
      <div className="h-8 w-56 rounded-md bg-card" />
      <div className="h-5 w-96 max-w-full rounded-md bg-card" />
      <div className="h-40 rounded-md bg-card" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 rounded-md bg-card" />
        <div className="h-28 rounded-md bg-card" />
        <div className="h-28 rounded-md bg-card" />
      </div>
    </div>
  );
}
