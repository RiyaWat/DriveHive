import { useEffect, useRef, useState } from "react";
import { X, Heart, CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";
import { api, fileUrl } from "../lib/api";
import { Avatar } from "./Avatar";

const IMAGE_DURATION_MS = 5000;

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

/**
 * Instagram-style story viewer.
 * Images auto-advance after 5 s; videos play their full native duration.
 */
export function StoryViewer({ open, groups, startGroupIndex = 0, onClose, currentUserId }) {
  const [gi, setGi] = useState(startGroupIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  const videoRef = useRef(null);

  const group = groups?.[gi];
  const story = group?.stories?.[si];
  const totalGroups = groups?.length || 0;
  const isVideo = story?.media_type === "video";

  useEffect(() => {
    if (!open) return;
    setGi(startGroupIndex);
    setSi(0);
  }, [open, startGroupIndex]);

  // Per-story init: reset progress, like state, mark viewed
  useEffect(() => {
    if (!open || !story) return;
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();
    setLiked((story.likes || []).includes(currentUserId));
    setLikeCount((story.likes || []).length);
    setPaused(false);
    if (story.user_id !== currentUserId) {
      api.post(`/stories/${story.id}/view`).catch(() => {});
    }
  }, [open, story?.id, currentUserId]);

  // For IMAGES only: drive progress with rAF (5s). Videos drive themselves.
  useEffect(() => {
    if (!open || !story || isVideo) return;
    if (paused) return;
    cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now() - elapsedRef.current;
    const tick = (t) => {
      const e = t - startRef.current;
      elapsedRef.current = e;
      const p = Math.min(1, e / IMAGE_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, [open, story?.id, paused, isVideo]);

  // Video play/pause wiring
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, story?.id]);

  const onVideoTime = () => {
    const v = videoRef.current;
    if (!v || !v.duration || isNaN(v.duration)) return;
    setProgress(Math.min(1, v.currentTime / v.duration));
  };

  const next = () => {
    if (!group) return;
    if (si + 1 < group.stories.length) {
      setSi((v) => v + 1);
      elapsedRef.current = 0;
      return;
    }
    if (gi + 1 < totalGroups) {
      setGi((v) => v + 1);
      setSi(0);
      elapsedRef.current = 0;
      return;
    }
    onClose();
  };

  const prev = () => {
    if (si > 0) {
      setSi((v) => v - 1);
      elapsedRef.current = 0;
      return;
    }
    if (gi > 0) {
      const prevGroup = groups[gi - 1];
      setGi((v) => v - 1);
      setSi(prevGroup.stories.length - 1);
      elapsedRef.current = 0;
    }
  };

  const toggleLike = async () => {
    if (!story) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      await api.post(`/stories/${story.id}/like`);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, [open, gi, si, groups]);

  if (!open || !story || !group) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
      data-testid="story-viewer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[460px] h-full sm:h-[92vh] sm:rounded-2xl overflow-hidden bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
          {group.stories.map((s, idx) => {
            const w =
              idx < si ? "100%" : idx === si ? `${Math.floor(progress * 100)}%` : "0%";
            return (
              <div key={s.id} className="flex-1 h-0.5 bg-white/30 overflow-hidden rounded-full">
                <div className="h-full bg-white" style={{ width: w }} />
              </div>
            );
          })}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-4 pt-2">
          <div className="flex items-center gap-2">
            <Avatar user={group.user} size={32} />
            <div className="leading-tight">
              <p className="text-white text-sm font-bold">{group.user?.name}</p>
              <p className="text-white/70 text-[10px] uppercase tracking-wider font-mono-tight">
                {timeAgo(story.created_at)} ago
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaused((p) => !p)}
              data-testid="story-pause-btn"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              {paused ? <Play size={16} weight="fill" /> : <Pause size={16} weight="fill" />}
            </button>
            <button
              onClick={onClose}
              data-testid="story-close-btn"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isVideo ? (
            <video
              ref={videoRef}
              key={story.id}
              src={fileUrl(story.media_path)}
              className="w-full h-full object-contain bg-black"
              autoPlay
              playsInline
              preload="auto"
              onTimeUpdate={onVideoTime}
              onEnded={next}
            />
          ) : (
            <img
              key={story.id}
              src={fileUrl(story.media_path)}
              alt=""
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Tap zones */}
        <button
          className="absolute left-0 top-16 bottom-20 w-1/3 z-10"
          onClick={prev}
          data-testid="story-prev-btn"
          aria-label="Previous"
        />
        <button
          className="absolute right-0 top-16 bottom-20 w-1/3 z-10"
          onClick={next}
          data-testid="story-next-btn"
          aria-label="Next"
        />

        {/* Desktop nav arrows */}
        {(gi > 0 || si > 0) && (
          <button
            onClick={prev}
            className="hidden md:flex absolute -left-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center text-white"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
        )}
        {(gi + 1 < totalGroups || si + 1 < group.stories.length) && (
          <button
            onClick={next}
            className="hidden md:flex absolute -right-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center text-white"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        )}

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent">
          <button
            onClick={toggleLike}
            data-testid="story-like-btn"
            className="flex items-center gap-1.5 text-white hover:scale-110 transition-transform"
          >
            <Heart
              size={28}
              weight={liked ? "fill" : "regular"}
              className={liked ? "text-[#FACC15]" : ""}
            />
            <span className="font-bold text-sm" data-testid="story-like-count">
              {likeCount}
            </span>
          </button>
          {story.user_id === currentUserId && (
            <span className="ml-auto text-xs text-white/60 font-mono-tight">
              Viewed by {(story.viewed_by || []).length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
