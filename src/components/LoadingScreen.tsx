import { Trophy } from "lucide-react";

type Props = {
  label?: string;
  compact?: boolean;
};

export function LoadingScreen({ label = "Ładowanie…", compact }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${
        compact ? "py-16" : "min-h-[50vh] py-24"
      }`}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="wc-loader-ring absolute inset-0 rounded-full border-2 border-[var(--wc-gold)]/20" />
        <div className="wc-loader-spin absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--wc-gold)]" />
        <Trophy className="relative h-9 w-9 text-[var(--wc-gold)]" strokeWidth={1.5} />
      </div>

      <div className="text-center">
        <p className="font-display text-4xl font-bold tracking-wider text-white/90">26</p>
        <p className="mt-2 text-sm text-white/50">{label}</p>
      </div>

      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
        <div className="wc-loader-bar h-full w-1/2 rounded-full bg-[var(--wc-gold)]" />
      </div>
    </div>
  );
}
