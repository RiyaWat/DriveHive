import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BellRinging, Heart, ChatCircle, UserPlus, PaperPlaneTilt, ShareFat } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { Avatar } from "./Avatar";

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const ICONS = {
  like: Heart,
  comment: ChatCircle,
  follow: UserPlus,
  message: PaperPlaneTilt,
  share: ShareFat,
};

const COPY = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
  message: "messaged you",
  share: "shared your post",
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api.post("/notifications/read");
      setItems((p) => p.map((n) => ({ ...n, read: true })));
    }
  };

  const linkFor = (n) => {
    if (n.type === "follow") return `/profile/${n.from_user_id}`;
    if (n.type === "message") return `/messages/${n.from_user_id}`;
    return `/`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        data-testid="notifications-bell"
        className="relative w-10 h-10 rounded-full border border-[#E4E4E7] hover:bg-zinc-100 flex items-center justify-center transition-colors"
      >
        <BellRinging size={18} weight={unread > 0 ? "fill" : "regular"} />
        {unread > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -top-1 -right-1 bg-[#FACC15] border-2 border-white text-black text-[10px] font-bold rounded-full min-w-[20px] h-[20px] px-1 flex items-center justify-center live-dot"
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          data-testid="notifications-panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border-2 border-black rounded-2xl shadow-2xl overflow-hidden z-50 hive-rise"
        >
          <div className="px-4 py-3 border-b border-[#E4E4E7] flex items-center justify-between">
            <h4 className="font-display text-lg font-bold uppercase tracking-tight">The buzz</h4>
            <span className="text-xs text-zinc-500">{items.length} total</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {items.length === 0 && (
              <div className="p-6 text-center text-sm text-zinc-500">
                <BellRinging size={28} className="mx-auto mb-2 opacity-40" />
                No notifications yet. Go make some noise in the hive.
              </div>
            )}
            {items.map((n) => {
              const Icon = ICONS[n.type] || BellRinging;
              return (
                <Link
                  key={n.id}
                  to={linkFor(n)}
                  onClick={() => setOpen(false)}
                  data-testid={`notif-${n.id}`}
                  className="flex items-start gap-3 p-3 hover:bg-[#FAFAFA] border-b border-[#E4E4E7]"
                >
                  <div className="relative">
                    <Avatar user={n.from_user} size={36} />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FACC15] border-2 border-white flex items-center justify-center">
                      <Icon size={10} weight="fill" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-bold">{n.from_user?.name || "Someone"}</span>{" "}
                      <span className="text-zinc-700">{COPY[n.type] || n.type}</span>
                    </p>
                    {n.text && <p className="text-xs text-zinc-500 truncate mt-0.5">"{n.text}"</p>}
                    <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider font-mono-tight">
                      {timeAgo(n.created_at)} ago
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
