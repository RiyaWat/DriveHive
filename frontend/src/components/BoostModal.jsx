import { useEffect, useState } from "react";
import { X, Lightning, Check, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "../lib/api";

export function BoostModal({ event, open, onClose, onBoosted }) {
  const [packages, setPackages] = useState([]);
  // null = unknown yet, true = real Stripe (test mode) checkout, false = demo mode
  const [paymentsLive, setPaymentsLive] = useState(null);
  const [selected, setSelected] = useState("boost_7d");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    api
      .get("/payments/packages")
      .then((r) => setPackages(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    api
      .get("/payments/config")
      .then((r) => setPaymentsLive(!!r.data?.enabled))
      .catch(() => setPaymentsLive(false));
  }, [open]);

  if (!open || !event) return null;

  const demoBoost = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.post(`/events/${event.id}/boost/demo`, { package_id: selected, origin_url: window.location.origin });
      toast.success("Boosted! (demo mode, nothing was charged)");
      setBusy(false);
      onClose?.();
      onBoosted?.();
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setBusy(false);
    }
  };

  const buy = async () => {
    if (paymentsLive === false) return demoBoost();
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post(`/events/${event.id}/boost/checkout`, {
        package_id: selected,
        origin_url: window.location.origin,
      });
      // Hard redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="boost-modal"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl border-2 border-black overflow-hidden hive-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative hive-stripes h-20 flex items-center px-5">
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
          <div className="relative flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Lightning size={22} weight="fill" className="text-black" />
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight">Boost this meet</h3>
            </div>
            <button onClick={onClose} data-testid="boost-close">
              <X size={22} weight="bold" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm text-zinc-600">
            Pin <span className="font-bold text-black">{event.title}</span> to the top of the events
            grid with a featured badge and hive-stripe accent.
          </p>

          <div className="mt-5 grid gap-3">
            {packages.map((p) => {
              const active = selected === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  data-testid={`pkg-${p.id}`}
                  className={`text-left p-4 rounded-xl border-2 flex items-center justify-between transition-colors ${
                    active ? "border-black bg-[#FACC15]/20" : "border-[#E4E4E7] hover:border-zinc-400"
                  }`}
                >
                  <div>
                    <p className="font-display text-xl font-bold">{p.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Top-of-grid + FEATURED badge for {p.days} {p.days === 1 ? "day" : "days"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tight text-lg font-bold">
                      ${p.amount.toFixed(2)}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 ${
                        active ? "bg-black border-black" : "border-zinc-300"
                      } flex items-center justify-center`}
                    >
                      {active && <Check size={12} weight="bold" className="text-[#FACC15]" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {paymentsLive === false && (
            <div
              className="mt-4 p-3 rounded-xl bg-[#FACC15]/15 border-2 border-[#FACC15] text-sm"
              data-testid="boost-demo-mode"
            >
              <p className="font-bold">Payments are in demo mode</p>
              <p className="text-zinc-700 mt-0.5">
                No card needed and nothing gets charged. Tap below to see how a boosted meet looks.
              </p>
            </div>
          )}

          {err && <p className="text-sm text-red-600 mt-3" data-testid="boost-error">{err}</p>}

          <div className="flex items-center justify-between mt-5">
            <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
              {paymentsLive === false ? "Demo mode · no charge" : "Secured by Stripe · test mode"}
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost" data-testid="boost-cancel">Cancel</button>
              <button
                onClick={buy}
                disabled={busy}
                data-testid="boost-pay"
                className="btn-yellow inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {busy ? <Spinner size={14} className="animate-spin" /> : <Lightning size={14} weight="fill" />}
                {paymentsLive === false ? "Boost (demo)" : "Pay & boost"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
