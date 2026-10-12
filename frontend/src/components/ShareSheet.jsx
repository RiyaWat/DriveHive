import { useEffect, useState } from "react";
import { X, LinkSimple, PaperPlaneTilt, Check, MagnifyingGlass, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, fileUrl } from "../lib/api";
import { Avatar } from "./Avatar";

export function ShareSheet({ post, open, onClose, onShared }) {
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSentTo(new Set());
    setQ("");
    api.get("/users/me/connections").then((r) => setConnections(r.data)).catch(() => {});
  }, [open]);

  if (!open || !post) return null;

  const shareUrl = `${window.location.origin}/profile/${post.user_id}`;
  const filtered = connections.filter(
    (c) => !q || c.name?.toLowerCase().includes(q.toLowerCase())
  );

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard");
      } else {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success("Link copied");
      }
    } catch {
      toast(shareUrl);
    }
    // Count the share
    try {
      const { data } = await api.post(`/posts/${post.id}/share`);
      onShared && onShared(data.shares);
    } catch {}
  };

  const sendToSelected = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const message = `${post.author?.name || "Someone"} on DriveHive: ${
        post.caption || "check this build"
      }\n${shareUrl}`;
      const results = await Promise.allSettled(
        [...selected].map((uid) => api.post("/messages", { to_user_id: uid, text: message }))
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      if (ok > 0) {
        // Count one share on the post (not one per recipient — feels right)
        try {
          const { data } = await api.post(`/posts/${post.id}/share`);
          onShared && onShared(data.shares);
        } catch {}
        setSentTo(new Set(selected));
        toast.success(`Sent to ${ok} ${ok === 1 ? "person" : "people"}`);
        setTimeout(() => {
          onClose();
        }, 900);
      } else {
        toast.error("Couldn't send the share");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      data-testid="share-sheet"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border-2 border-black overflow-hidden max-h-[85vh] flex flex-col hive-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7]">
          <h3 className="font-display text-xl font-bold uppercase tracking-tight">Share post</h3>
          <button onClick={onClose} data-testid="share-close-btn">
            <X size={22} weight="bold" />
          </button>
        </div>

        {/* Post preview */}
        <div className="flex items-center gap-3 px-5 py-3 bg-[#FAFAFA] border-b border-[#E4E4E7]">
          {post.media_type === "video" && (post.media_path || post.image_path) ? (
            <video
              src={fileUrl(post.media_path || post.image_path)}
              className="w-12 h-12 rounded object-cover bg-black"
              muted
              playsInline
              preload="metadata"
            />
          ) : (post.media_path || post.image_path) ? (
            <img
              src={fileUrl(post.media_path || post.image_path)}
              alt=""
              className="w-12 h-12 rounded object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-zinc-200" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{post.author?.name}</p>
            <p className="text-xs text-zinc-500 truncate">{post.caption || "(no caption)"}</p>
          </div>
        </div>

        {/* Copy link pill */}
        <div className="px-5 py-3 border-b border-[#E4E4E7]">
          <button
            onClick={copyLink}
            data-testid="share-copy-link"
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-[#FACC15] text-black rounded-full border-2 border-black font-bold hover:bg-[#EAB308] transition-colors"
          >
            <span className="flex items-center gap-2">
              <LinkSimple size={16} weight="bold" /> Copy link
            </span>
            <span className="text-[11px] font-mono-tight opacity-70 truncate max-w-[50%]">
              {shareUrl.replace(/^https?:\/\//, "")}
            </span>
          </button>
        </div>

        {/* Connections picker */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
            Send to your crew
          </p>
          <div className="relative flex-1 max-w-[180px]">
            <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              data-testid="share-search"
              className="w-full bg-[#FAFAFA] border border-[#E4E4E7] rounded-full pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-black"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 px-4 py-8">
              {connections.length === 0
                ? "Follow someone to share posts into a DM."
                : "No one matches that search."}
            </p>
          ) : (
            filtered.map((u) => {
              const isSel = selected.has(u.id);
              const wasSent = sentTo.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  disabled={wasSent || sending}
                  data-testid={`share-target-${u.id}`}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                    isSel ? "bg-[#FACC15]/20" : "hover:bg-[#FAFAFA]"
                  }`}
                >
                  <Avatar user={u} size={40} ringYellow={isSel} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm truncate">{u.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {u.role === "mechanic" ? `Mechanic · ${u.specialty || "General"}` : "Enthusiast"}
                    </p>
                  </div>
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      wasSent
                        ? "bg-green-500 border-green-600"
                        : isSel
                          ? "bg-black border-black"
                          : "border-zinc-300"
                    }`}
                  >
                    {wasSent ? (
                      <Check size={14} weight="bold" className="text-white" />
                    ) : (
                      isSel && <Check size={14} weight="bold" className="text-[#FACC15]" />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E4E4E7] p-3 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {selected.size > 0
              ? `${selected.size} selected`
              : "Pick one or more to send via DM"}
          </p>
          <button
            onClick={sendToSelected}
            disabled={selected.size === 0 || sending}
            data-testid="share-send-btn"
            className="btn-yellow inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {sending ? (
              <Spinner size={14} className="animate-spin" />
            ) : (
              <PaperPlaneTilt size={14} weight="fill" />
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
