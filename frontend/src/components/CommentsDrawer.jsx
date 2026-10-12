import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatCircle, PaperPlaneTilt, X, Spinner } from "@phosphor-icons/react";
import { api, formatApiErrorDetail } from "../lib/api";
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

export function CommentsDrawer({ postId, open, onClose, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    if (!open || !postId) return;
    (async () => {
      try {
        const { data } = await api.get(`/posts/${postId}/comments`);
        setComments(data);
      } catch {}
    })();
  }, [open, postId]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${postId}/comments`, { text });
      setComments((p) => [...p, data]);
      onCountChange && onCountChange(comments.length + 1);
      setText("");
    } catch (e2) {
      setErr(formatApiErrorDetail(e2.response?.data?.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      data-testid="comments-drawer"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border-2 border-black overflow-hidden max-h-[85vh] flex flex-col hive-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7]">
          <h3 className="font-display text-xl font-bold uppercase tracking-tight inline-flex items-center gap-2">
            <ChatCircle size={20} weight="bold" /> Comments
          </h3>
          <button onClick={onClose} data-testid="comments-close">
            <X size={22} weight="bold" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 && (
            <p className="text-center text-sm text-zinc-500 py-8">
              No comments yet. Kick off the conversation.
            </p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3" data-testid={`comment-${c.id}`}>
              <button onClick={() => nav(`/profile/${c.user_id}`)}>
                <Avatar user={c.author} size={32} />
              </button>
              <div className="flex-1">
                <div className="bg-[#FAFAFA] rounded-2xl px-3 py-2 border border-[#E4E4E7]">
                  <p className="font-bold text-sm">{c.author?.name}</p>
                  <p className="text-sm mt-0.5">{c.text}</p>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-mono-tight">
                  {timeAgo(c.created_at)} ago
                </p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="border-t border-[#E4E4E7] p-3 flex items-center gap-2">
          <input
            data-testid="comment-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            className="hive-input flex-1"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            data-testid="comment-submit"
            className="btn-yellow inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Spinner size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} weight="bold" />}
            Post
          </button>
        </form>
        {err && <p className="px-4 pb-2 text-xs text-red-600">{err}</p>}
      </div>
    </div>
  );
}
