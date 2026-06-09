import { Trophy } from "lucide-react";

type Props = {
  size?: "sm" | "lg";
};

/** Znak turniejowy inspirowany brandingiem FIFA World Cup 26 */
export function WcBrandMark({ size = "lg" }: Props) {
  const large = size === "lg";

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <div
          className={`wc-brand-glow absolute inset-0 rounded-full blur-2xl ${
            large ? "scale-150" : "scale-125"
          }`}
        />
        <div
          className={`relative flex items-center justify-center rounded-2xl border border-[var(--wc-gold)]/30 bg-gradient-to-br from-white/10 to-white/5 shadow-lg backdrop-blur-md ${
            large ? "h-24 w-24 sm:h-28 sm:w-28" : "h-14 w-14"
          }`}
        >
          <Trophy
            className={`text-[var(--wc-gold)] drop-shadow-[0_0_12px_rgba(212,175,55,0.5)] ${
              large ? "h-12 w-12 sm:h-14 sm:w-14" : "h-7 w-7"
            }`}
            strokeWidth={1.5}
          />
        </div>
      </div>

      <div>
        <p
          className={`font-display font-bold tracking-[0.2em] text-[var(--wc-gold)] ${
            large ? "text-xs sm:text-sm" : "text-[10px]"
          }`}
        >
          FIFA WORLD CUP
        </p>
        <div className={`font-display font-black leading-none text-white ${large ? "text-6xl sm:text-7xl" : "text-4xl"}`}>
          <span className="wc-text-26 inline-block">26</span>
        </div>
        {large && (
          <p className="mt-2 font-display text-sm font-semibold tracking-[0.35em] text-white/60 sm:text-base">
            WE ARE 26
          </p>
        )}
      </div>
    </div>
  );
}
