/** Indeterminate progress only: never implies that access has been granted. */
export function LoadingScreen({ label = "Загрузка…", fullPage = false }: {
  label?: string;
  fullPage?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      className={`flex w-full flex-col items-center justify-center gap-4 px-6 py-8 text-center text-text ${fullPage ? "min-h-dvh bg-bg" : "min-h-[16rem]"}`}
    >
      <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-full border-4 border-border border-t-current motion-safe:animate-spin motion-reduce:animate-none" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
