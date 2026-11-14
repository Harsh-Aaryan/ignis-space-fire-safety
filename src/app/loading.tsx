export default function Loading() {
  return (
    <div className="grid gap-3">
      <div className="h-8 w-48 rounded-md bg-card" />
      <div className="h-36 rounded-xl bg-card" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-24 rounded-xl bg-card" />
        <div className="h-24 rounded-xl bg-card" />
        <div className="h-24 rounded-xl bg-card" />
      </div>
    </div>
  );
}
