import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Link } from "react-router-dom";
import { isPushSupported, isSubscribedToPush } from "../lib/push-notifications";

const DISMISSED_KEY = "push-promo-dismissed";

export function PushPromoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    isSubscribedToPush().then((subscribed) => {
      if (!subscribed) setShow(true);
    });
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Nowość:</span> włącz powiadomienia push w{" "}
        <Link to="/ustawienia" className="underline underline-offset-2 hover:text-amber-100">
          ustawieniach
        </Link>{" "}
        — dostaniesz alert gdy nie masz typu na mecz i info o zdobytych punktach po meczu.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 text-amber-400/50 hover:text-amber-200"
        aria-label="Zamknij"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
