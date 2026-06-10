import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobile(): boolean {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.matchMedia("(max-width: 639px)").matches;
}

export function usePwaInstall() {
  const [installed, setInstalled] = useState(isStandalone);
  const [canPrompt, setCanPrompt] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setCanPrompt(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setCanPrompt(false);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return false;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setCanPrompt(false);
        setPromptEvent(null);
        return true;
      }
      return false;
    } finally {
      setInstalling(false);
    }
  }, [promptEvent]);

  const showIosGuide = !installed && isIos() && isMobile();
  const showInstallButton = !installed && canPrompt;
  const showManualGuide = !installed && !canPrompt && !isIos() && isMobile();

  return {
    installed,
    installing,
    canPrompt,
    showInstallButton,
    showIosGuide,
    showManualGuide,
    install,
    isMobile: isMobile(),
  };
}
