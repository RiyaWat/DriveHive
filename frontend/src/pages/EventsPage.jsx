import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Calendar, Plus, Trash, Lightning, Star, Spinner } from "@phosphor-icons/react";
import { api, fileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import { BoostModal } from "../components/BoostModal";

function dateBadge(iso) {
  const d = new Date(iso);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    mon: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    time: d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function countdown(untilIso) {
  if (!untilIso) return null;
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `${d}d left`;
  const h = Math.floor(ms / 3600000);
  return `${h}h left`;
}

function EventCard({ e, currentUserId, onBoost, onDelete }) {
  const b = dateBadge(e.starts_at);
  const mine = currentUserId === e.user_id;
  return (
    <article
      data-testid={`event-${e.id}`}
      className={`group bg-white rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all relative ${
        e.is_featured ? "border-2 border-black ring-2 ring-[#FACC15]" : "border border-[#E4E4E7]"
      }`}
    >
      <div className="relative h-48 overflow-hidden bg-zinc-100">
        {e.image_path ? (
          <img
            src={fileUrl(e.image_path)}
            alt={e.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full hive-stripes opacity-30" />
        )}
        <div className="absolute top-3 left-3 bg-white border-2 border-black rounded-lg px-3 py-1.5 text-center leading-tight">
          <p className="font-display text-2xl font-bold">{b.day}</p>
          <p className="text-[10px] font-bold tracking-wider">{b.mon}</p>
        </div>
        {e.is_featured && (
          <span
            data-testid={`featured-badge-${e.id}`}
            className="absolute top-3 right-3 bg-[#FACC15] text-black font-bold px-2.5 py-1 rounded text-[11px] uppercase tracking-wider inline-flex items-center gap-1 border-2 border-black"
          >
            <Star size={12} weight="fill" /> Featured
          </span>
        )}
        {mine && !e.is_featured && (
          <button
            onClick={() => onDelete(e.id)}
            className="absolute top-3 right-3 bg-black/80 text-white rounded-full p-2 hover:bg-red-600"
            data-testid={`event-delete-${e.id}`}
          >
            <Trash size={14} weight="bold" />
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-xl font-bold tracking-tight">{e.title}</h3>
        <div className="flex items-center gap-4 mt-2 text-sm text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} /> {e.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar size={14} /> {b.time}
          </span>
        </div>
        {e.description && <p className="text-sm text-zinc-700 mt-3 line-clamp-2">{e.description}</p>}
        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-[#E4E4E7]">
          <div className="flex items-center gap-2">
            <Avatar user={e.author} size={28} />
            <p className="text-xs text-zinc-600">
              Hosted by <span className="font-bold text-black">{e.author?.name}</span>
            </p>
          </div>
          {mine && (
            <button
              onClick={() => onBoost(e)}
              data-testid={`boost-btn-${e.id}`}
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full border-2 transition-colors ${
                e.is_featured
                  ? "bg-black text-[#FACC15] border-black"
                  : "bg-white text-black border-black hover:bg-[#FACC15]"
              }`}
            >
              <Lightning size={12} weight="fill" />
              {e.is_featured ? `${countdown(e.featured_until) || "Active"}` : "Boost"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function FeaturedStrip({ events, currentUserId, onBoost, onDelete }) {
  if (events.length === 0) return null;
  return (
    <section className="mb-8" data-testid="featured-strip">
      <div className="flex items-center gap-2 mb-3">
        <Star size={18} weight="fill" className="text-[#FACC15]" />
        <p className="text-xs uppercase tracking-[0.2em] font-bold">Featured by the hive</p>
      </div>
      <div className="relative bg-black rounded-2xl p-5 overflow-hidden">
        <div className="absolute inset-0 hive-stripes opacity-20" />
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.slice(0, 2).map((e) => (
            <EventCard
              key={e.id}
              e={e}
              currentUserId={currentUserId}
              onBoost={onBoost}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function EventsPage({ openEvent }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boostEvent, setBoostEvent] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const polledRef = useRef(false);

  const load = async () => {
    try {
      const { data } = await api.get("/events");
      setEvents(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Handle Stripe return
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || polledRef.current) return;
    polledRef.current = true;

    const toastId = toast.loading("Confirming your boost…");
    let attempts = 0;
    const max = 8;

    const poll = async () => {
      attempts += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid" && data.fulfilled) {
          toast.success("Boost is live! Your meet is now featured.", { id: toastId });
          setSearchParams({});
          load();
          return;
        }
        if (data.status === "expired") {
          toast.error("Checkout expired. Please try again.", { id: toastId });
          setSearchParams({});
          return;
        }
        if (attempts >= max) {
          toast("Still processing… we'll update the page when it lands.", { id: toastId });
          setSearchParams({});
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        toast.error("Could not verify payment.", { id: toastId });
        setSearchParams({});
      }
    };
    poll();
  }, [searchParams, setSearchParams]);

  const remove = async (id) => {
    await api.delete(`/events/${id}`);
    setEvents((p) => p.filter((e) => e.id !== id));
  };

  const featured = events.filter((e) => e.is_featured);
  const regular = events.filter((e) => !e.is_featured);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24" data-testid="events-page">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Live & upcoming</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Car meets <span className="bg-[#FACC15] px-2">near you</span>
          </h1>
          <p className="text-zinc-600 mt-2 max-w-xl">
            Cars & coffee, track days, midnight runs. Only what the hive is actually rolling to.
          </p>
        </div>
        <button
          onClick={openEvent}
          className="btn-yellow inline-flex items-center gap-1.5"
          data-testid="host-meet-btn"
        >
          <Plus size={16} weight="bold" /> Host a meet
        </button>
      </div>

      {loading && (
        <p className="text-zinc-500 inline-flex items-center gap-2">
          <Spinner size={16} className="animate-spin" /> Loading meets…
        </p>
      )}

      {!loading && events.length === 0 && (
        <div className="border-2 border-dashed border-zinc-200 rounded-xl p-10 text-center">
          <p className="font-display text-2xl font-bold">No meets posted yet.</p>
          <p className="text-zinc-600 mt-1">Be the first to host one.</p>
        </div>
      )}

      <FeaturedStrip
        events={featured}
        currentUserId={user?.id}
        onBoost={setBoostEvent}
        onDelete={remove}
      />

      {regular.length > 0 && (
        <>
          {featured.length > 0 && (
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-3">
              All meets
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regular.map((e) => (
              <EventCard
                key={e.id}
                e={e}
                currentUserId={user?.id}
                onBoost={setBoostEvent}
                onDelete={remove}
              />
            ))}
          </div>
        </>
      )}

      <BoostModal event={boostEvent} open={!!boostEvent} onClose={() => setBoostEvent(null)} />
    </div>
  );
}
