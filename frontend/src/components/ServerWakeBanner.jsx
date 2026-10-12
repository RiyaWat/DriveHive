import { useEffect, useState } from "react";
import { Spinner } from "@phosphor-icons/react";
import { isServerWaking } from "../lib/api";

// The free backend sleeps when nobody has used it for a while. The first request
// after that takes ~30 s while it boots, so say so instead of looking broken.
export function ServerWakeBanner() {
  const [waking, setWaking] = useState(isServerWaking());

  useEffect(() => {
    const on = () => setWaking(true);
    const off = () => setWaking(false);
    window.addEventListener("drivehive:waking", on);
    window.addEventListener("drivehive:awake", off);
    return () => {
      window.removeEventListener("drivehive:waking", on);
      window.removeEventListener("drivehive:awake", off);
    };
  }, []);

  if (!waking) return null;
  return (
    <div
      role="status"
      data-testid="server-waking"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-md bg-black text-white border-2 border-[#FACC15] rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3"
    >
      <Spinner size={18} className="animate-spin text-[#FACC15] mt-0.5 shrink-0" />
      <div className="text-sm leading-snug">
        <p className="font-bold">Waking up the server (~30s)…</p>
        <p className="text-zinc-300 text-xs mt-0.5">
          DriveHive runs on a free server that naps when nobody's around. Hang tight, it'll load on its own.
        </p>
      </div>
    </div>
  );
}
