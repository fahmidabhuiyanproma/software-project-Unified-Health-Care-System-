/** Placeholder for pages not yet ported from the old app — replaced module by module. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="card p-6">
      <h1 className="text-xl font-bold text-gray-800 font-heading mb-2">{title}</h1>
      <p className="text-gray-500 text-sm">This page is being migrated and will be available shortly.</p>
    </div>
  );
}
