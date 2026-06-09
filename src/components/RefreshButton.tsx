import { RefreshCw } from "lucide-react";

type Props = {
  onClick: () => void | Promise<void>;
  loading?: boolean;
  label?: string;
};

export function RefreshButton({ onClick, loading, label = "Odśwież" }: Props) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={loading}
      className="btn-ghost text-sm disabled:opacity-50"
      title={label}
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "wc-spin" : ""}`} />
      <span className="hidden sm:inline">{loading ? "Odświeżanie…" : label}</span>
    </button>
  );
}
