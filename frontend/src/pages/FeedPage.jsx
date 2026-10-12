import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ChatCircle, ShareFat, Plus, DotsThree } from "@phosphor-icons/react";
import { api, fileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import { CommentsDrawer } from "../components/CommentsDrawer";
import { StoryViewer } from "../components/StoryViewer";
import { ShareSheet } from "../components/ShareSheet";

function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function StoriesTray({ stories, onAddStory, onOpenStory, currentUserId }) {
  const { user } = useAuth();
  return (
    <div
      className="w-full overflow-x-auto flex gap-4 p-4 border-b border-[#E4E4E7] bg-white hide-scrollbar"
      data-testid="stories-tray"
    >
      <button
        onClick={onAddStory}
        data-testid="add-story-btn"
        className="flex flex-col items-center gap-1.5 cursor-pointer min-w-[72px]"
      >
        <div className="relative w-16 h-16 rounded-full border-2 border-dashed border-zinc-300 bg-[#FAFAFA] flex items-center justify-center">
          <Avatar user={user} size={56} />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FACC15] border-2 border-white flex items-center justify-center">
            <Plus size={14} weight="bold" />
          </span>
        </div>
        <span className="text-xs font-semibold">Your story</span>
      </button>
      {stories.map((g, i) => {
        const isSelf = g.user?.id === currentUserId;
        const unviewed = g.has_unviewed && !isSelf;
        return (
          <button
            key={g.user?.id || i}
            onClick={() => onOpenStory(i)}
            data-testid={`story-${g.user?.id}`}
            data-unviewed={unviewed}
            className="flex flex-col items-center gap-1.5 min-w-[72px]"
          >
            <div
              className={
                unviewed
                  ? "story-ring rounded-full"
                  : "rounded-full p-[3px] bg-zinc-200"
              }
            >
              <div className="bg-white p-[2px] rounded-full">
                <Avatar user={g.user} size={56} />
              </div>
            </div>
            <span className="text-xs font-semibold truncate max-w-[72px]">
              {g.user?.name?.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PostCard({ post, currentUserId, onLike, onOpenAuthor, onOpenComments, onShare }) {
  const liked = (post.likes || []).includes(currentUserId);
  const shares = post.shares || 0;
  return (
    <article
      className="bg-white border border-[#E4E4E7] sm:rounded-xl mb-6 hive-rise"
      data-testid={`post-${post.id}`}
    >
      <header className="flex items-center justify-between p-3 sm:p-4">
        <button
          onClick={() => onOpenAuthor(post.author?.id)}
          className="flex items-center gap-3 group"
          data-testid={`post-author-${post.id}`}
        >
          <Avatar user={post.author} size={36} ringYellow />
          <div className="text-left">
            <p className="font-bold text-sm group-hover:underline">{post.author?.name}</p>
            <p className="text-xs text-zinc-500">
              {post.author?.role === "mechanic" && (
                <span className="bg-black text-[#FACC15] px-1.5 py-0.5 rounded mr-2 font-bold uppercase tracking-wide">
                  Mechanic
                </span>
              )}
              {timeAgo(post.created_at)} ago
            </p>
          </div>
        </button>
        <DotsThree size={22} />
      </header>

      {(post.media_path || post.image_path) && (
        (post.media_type === "video") ? (
          <video
            src={fileUrl(post.media_path || post.image_path)}
            className="w-full aspect-square object-cover bg-black"
            controls
            playsInline
            preload="metadata"
            data-testid={`post-video-${post.id}`}
          />
        ) : (
          <img
            src={fileUrl(post.media_path || post.image_path)}
            alt=""
            className="w-full aspect-square object-cover bg-[#FAFAFA]"
          />
        )
      )}

      <div className="flex items-center gap-4 px-3 sm:px-4 pt-3">
        <button
          onClick={() => onLike(post.id)}
          className="hover:scale-110 transition-transform"
          data-testid={`like-${post.id}`}
        >
          <Heart
            size={26}
            weight={liked ? "fill" : "regular"}
            className={liked ? "text-[#FACC15]" : "text-black"}
          />
        </button>
        <button
          onClick={() => onOpenComments(post.id)}
          className="hover:scale-110 transition-transform"
          data-testid={`comment-btn-${post.id}`}
        >
          <ChatCircle size={26} className="text-black" />
        </button>
        <button
          onClick={() => onShare(post)}
          className="hover:scale-110 transition-transform inline-flex items-center gap-1"
          data-testid={`share-btn-${post.id}`}
        >
          <ShareFat size={26} className="text-black" />
          {shares > 0 && <span className="text-sm font-bold" data-testid={`share-count-${post.id}`}>{shares}</span>}
        </button>
      </div>

      <div className="px-3 sm:px-4 pb-4 pt-2 text-sm">
        <p className="font-bold">{(post.likes || []).length} revs</p>
        {post.caption && (
          <p className="mt-1">
            <span className="font-bold mr-2">{post.author?.name}</span>
            {post.caption}
          </p>
        )}
        <button
          onClick={() => onOpenComments(post.id)}
          className="text-xs text-zinc-500 mt-1 hover:text-black"
          data-testid={`view-comments-${post.id}`}
        >
          View comments
        </button>
      </div>
    </article>
  );
}

export default function FeedPage({ openCreate, openStory }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsFor, setCommentsFor] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [sharePost, setSharePost] = useState(null);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([api.get("/posts/feed"), api.get("/stories")]);
      setPosts(p.data);
      setStories(s.data);
    } catch {
      /* ignore — AuthContext will redirect if we're actually unauthorised */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onLike = async (id) => {
    const { data } = await api.post(`/posts/${id}/like`);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: data.likes } : p)));
  };

  const onShare = (post) => setSharePost(post);

  const onSharedCountUpdate = (newCount) => {
    if (!sharePost) return;
    setPosts((prev) =>
      prev.map((p) => (p.id === sharePost.id ? { ...p, shares: newCount } : p))
    );
  };

  const openStoryAt = (i) => setViewerIndex(i);
  const closeViewer = () => {
    setViewerIndex(null);
    // Refresh to reflect viewed ring colors
    load();
  };

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 md:pb-10" data-testid="feed-page">
      <StoriesTray
        stories={stories}
        onAddStory={openStory}
        onOpenStory={openStoryAt}
        currentUserId={user?.id}
      />
      <div className="px-0 sm:px-2 mt-2 sm:mt-6">
        {loading && <p className="p-6 text-center text-zinc-500">Loading the hive…</p>}
        {!loading && posts.length === 0 && (
          <div className="border-2 border-dashed border-zinc-200 rounded-xl p-10 text-center mt-4 mx-3">
            <p className="font-display text-2xl font-bold">The hive is quiet.</p>
            <p className="text-zinc-600 mt-1">Be the first to drop a build today.</p>
            <button onClick={openCreate} className="btn-yellow mt-4" data-testid="empty-create-btn">
              <Plus size={16} weight="bold" className="inline -mt-0.5 mr-1" /> Create a post
            </button>
          </div>
        )}
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            currentUserId={user?.id}
            onLike={onLike}
            onOpenAuthor={(id) => id && nav(`/profile/${id}`)}
            onOpenComments={(id) => setCommentsFor(id)}
            onShare={onShare}
          />
        ))}
      </div>
      <CommentsDrawer
        postId={commentsFor}
        open={!!commentsFor}
        onClose={() => setCommentsFor(null)}
      />
      <StoryViewer
        open={viewerIndex !== null}
        groups={stories}
        startGroupIndex={viewerIndex || 0}
        currentUserId={user?.id}
        onClose={closeViewer}
      />
      <ShareSheet
        open={!!sharePost}
        post={sharePost}
        onClose={() => setSharePost(null)}
        onShared={onSharedCountUpdate}
      />
    </div>
  );
}
