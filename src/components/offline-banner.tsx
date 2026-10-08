"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div className="no-print sticky top-0 z-50 bg-orange-500 px-4 py-2 text-center text-sm font-medium text-white">
      Connexion Internet interrompue. Vos saisies ne seront pas envoyées tant que la connexion n&apos;est pas revenue.
    </div>
  );
}
