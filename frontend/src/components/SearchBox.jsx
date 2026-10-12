import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { api, fileUrl } from "../lib/api";
import { Avatar } from "./Avatar";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState({ users: [], posts: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!q.trim()) {
      setRes({ users: [], posts: [] });
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/search", { params: { q } });
        setRes(data);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const goUser = (id) => {
    setOpen(false);
    setQ("");
    nav(`/profile/${id}`);
  };

  return (
    <div ref={ref} className="relative w-full max-w-sm hidden md:block">
      <div className="relative">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          data-testid="search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search riders, mechanics, builds…"
          className="w-full bg-[#FAFAFA] border border-[#E4E4E7] rounded-full pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-black transition-colors"
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              setRes({ users: [], posts: [] });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black"
          >
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      {open && q.trim() && (res.users.length > 0 || res.posts.length > 0) && (
        <div className="absolute left-0 right-0 mt-2 bg-white border-2 border-black rounded-2xl shadow-2xl overflow-hidden z-50 hive-rise">
          {res.users.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                People
              </p>
              {res.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => goUser(u.id)}
                  data-testid={`search-user-${u.id}`}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#FAFAFA] text-left"
                >
                  <Avatar user={u} size={32} ringYellow />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {u.role === "mechanic" ? `Mechanic · ${u.specialty || "General"}` : "Enthusiast"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {res.posts.length > 0 && (
            <div className="border-t border-[#E4E4E7]">
              <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                Posts
              </p>
              {res.posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => goUser(p.user_id)}
                  data-testid={`search-post-${p.id}`}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#FAFAFA] text-left"
                >
                  {p.image_path ? (
                    <img src={fileUrl(p.image_path)} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-zinc-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.caption || "(no caption)"}</p>
                    <p className="text-xs text-zinc-500 truncate">by {p.author?.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
