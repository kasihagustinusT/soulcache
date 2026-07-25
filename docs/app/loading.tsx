export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background" aria-live="polite">
      <span className="sr-only">Loading...</span>
      <div className="relative mb-8">
        <img
          src="https://res.cloudinary.com/vaslp5ww/image/upload/v1784809523/soulcache-logo_isux6t.svg"
          alt=""
          className="h-16 w-16 animate-spin-slow dark:brightness-0 dark:invert pointer-events-none select-none"
          draggable={false}
        />
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
      </div>
    </div>
  );
}
