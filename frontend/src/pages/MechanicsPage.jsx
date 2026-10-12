import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wrench, ChatCircleText } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { Avatar } from "../components/Avatar";

export default function MechanicsPage() {
  const [mechs, setMechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/mechanics");
        setMechs(data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24" data-testid="mechanics-page">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Ask a pro</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
          Talk to <span className="bg-[#FACC15] px-2">real mechanics</span>
        </h1>
        <p className="text-zinc-600 mt-2 max-w-xl">
          Quick questions about that misfire, weird idle, or build path? Get straight answers, no
          dealership runaround.
        </p>
      </div>

      {loading && <p className="text-zinc-500">Loading mechanics…</p>}
      {!loading && mechs.length === 0 && (
        <p className="text-zinc-500">No mechanics on the platform yet.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mechs.map((m) => (
          <article
            key={m.id}
            data-testid={`mechanic-${m.id}`}
            className="bg-white border border-[#E4E4E7] rounded-2xl p-5 hover:border-black transition-colors"
          >
            <div className="flex items-center gap-4">
              <Avatar user={m} size={56} ringYellow />
              <div>
                <p className="font-bold text-lg">{m.name}</p>
                <p className="text-xs uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1">
                  <Wrench size={12} weight="bold" /> {m.specialty || "General"}
                </p>
              </div>
            </div>
            {m.bio && <p className="text-sm text-zinc-700 mt-4 line-clamp-3">{m.bio}</p>}
            <button
              onClick={() => nav(`/messages/${m.id}`)}
              className="btn-black w-full mt-4 inline-flex items-center justify-center gap-1.5"
              data-testid={`message-mechanic-${m.id}`}
            >
              <ChatCircleText size={16} weight="bold" /> Send a question
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
