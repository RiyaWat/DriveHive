/**
 * DriveHive brand mark.
 *
 * Variants:
 *   - "horizontal" (default): yellow car icon + wordmark, fits the topbar
 *   - "stacked":              centered icon over wordmark, for hero/login
 *   - "mark":                 icon-only (no wordmark), for tight spaces
 *   - "white":                white wordmark + yellow car (for dark surfaces)
 */
export function HiveLogo({ variant = "horizontal", className = "" }) {
  if (variant === "mark") {
    return (
      <img
        src="/brand/drivehive-mark.png"
        alt="DriveHive"
        className={`h-8 w-auto select-none ${className}`}
        draggable={false}
      />
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <img
          src="/brand/drivehive-mark.png"
          alt=""
          className="h-20 w-auto select-none"
          draggable={false}
        />
        <div className="text-center">
          <p className="font-display text-3xl font-bold tracking-tight">
            Drive<span className="bg-[#FACC15] text-black px-1 -mx-0.5 rounded-sm">Hive</span>
          </p>
          <p className="text-[11px] font-mono-tight uppercase tracking-[0.2em] text-zinc-500 mt-1">
            Join the hive · Share the drive
          </p>
        </div>
      </div>
    );
  }

  if (variant === "white") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <img
          src="/brand/drivehive-mark.png"
          alt=""
          className="h-7 sm:h-8 w-auto max-w-[110px] sm:max-w-[140px] object-contain select-none"
          draggable={false}
        />
        <span className="font-display text-xl sm:text-2xl font-bold tracking-tight uppercase text-white">
          Drive<span className="bg-[#FACC15] text-black px-1 -mx-0.5 rounded-sm">Hive</span>
        </span>
      </div>
    );
  }

  // Horizontal (default) — compact for topbar
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/brand/drivehive-mark.png"
        alt=""
        className="h-6 sm:h-7 w-auto max-w-[90px] sm:max-w-[120px] object-contain select-none"
        draggable={false}
      />
      <span className="hidden sm:inline font-display text-lg sm:text-xl font-bold tracking-tight uppercase">
        Drive<span className="bg-[#FACC15] text-black px-1 -mx-0.5 rounded-sm">Hive</span>
      </span>
    </div>
  );
}
