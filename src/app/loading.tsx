export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-36 animate-pulse rounded-md border border-stroke bg-panel" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-md border border-stroke bg-panel" />
        ))}
      </div>
    </div>
  );
}
