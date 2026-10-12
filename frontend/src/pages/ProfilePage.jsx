import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, GearSix, SignOut, Trash, Spinner, UserPlus, UserMinus, ChatCircleText } from "@phosphor-icons/react";
import { api, fileUrl, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";

export default function ProfilePage() {
  const { userId } = useParams();
  const { user, refresh, logout } = useAuth();
  const nav = useNavigate();
  const [target, setTarget] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, is_following: false });
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", specialty: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const isMe = !userId || userId === user?.id;
  const id = isMe ? user?.id : userId;

  const load = async () => {
    if (!id) return;
    try {
      const [u, p, s] = await Promise.all([
        api.get(`/users/${id}`),
        api.get(`/posts/user/${id}`),
        api.get(`/users/${id}/stats`),
      ]);
      setTarget(u.data);
      setPosts(p.data);
      setStats(s.data);
      setForm({ name: u.data.name || "", bio: u.data.bio || "", specialty: u.data.specialty || "" });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      await api.patch("/users/me", form);
      await refresh();
      await load();
      setEdit(false);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const onAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.patch("/users/me", { avatar_url: data.path });
      await refresh();
      await load();
    } finally {
      setUploading(false);
    }
  };

  const removePost = async (pid) => {
    await api.delete(`/posts/${pid}`);
    setPosts((prev) => prev.filter((p) => p.id !== pid));
  };

  const toggleFollow = async () => {
    if (followBusy) return;
    setFollowBusy(true);
    try {
      if (stats.is_following) {
        await api.delete(`/users/${target.id}/follow`);
      } else {
        await api.post(`/users/${target.id}/follow`);
      }
      const { data } = await api.get(`/users/${target.id}/stats`);
      setStats(data);
    } finally {
      setFollowBusy(false);
    }
  };

  if (!target) return <p className="p-10 text-center text-zinc-500">Loading profile…</p>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 pb-24" data-testid="profile-page">
      {/* Banner */}
      <div className="relative h-32 sm:h-44 rounded-2xl overflow-hidden hive-stripes mb-[-48px]" />

      <div className="relative px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="bg-white p-1 rounded-full">
                <Avatar user={target} size={108} ringYellow />
              </div>
              {isMe && (
                <button
                  onClick={() => fileRef.current?.click()}
                  data-testid="change-avatar-btn"
                  className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-[#FACC15] border-2 border-black flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {uploading ? <Spinner size={16} className="animate-spin" /> : <Camera size={16} weight="bold" />}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatar}
                data-testid="avatar-file-input"
              />
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                  {target.name}
                </h1>
                {target.role === "mechanic" && (
                  <span className="bg-black text-[#FACC15] px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded">
                    Mechanic
                  </span>
                )}
              </div>
              <p className="text-zinc-600">{target.specialty || "Enthusiast"}</p>
            </div>
          </div>
          {isMe ? (
            <div className="flex gap-2">
              <button
                onClick={() => setEdit((v) => !v)}
                className="btn-ghost inline-flex items-center gap-1.5"
                data-testid="toggle-edit-btn"
              >
                <GearSix size={16} weight="bold" /> {edit ? "Close" : "Edit profile"}
              </button>
              <button onClick={logout} className="btn-black inline-flex items-center gap-1.5" data-testid="logout-btn">
                <SignOut size={16} weight="bold" /> Sign out
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={toggleFollow}
                disabled={followBusy}
                data-testid="follow-btn"
                className={`${stats.is_following ? "btn-ghost" : "btn-yellow"} inline-flex items-center gap-1.5 disabled:opacity-60`}
              >
                {followBusy ? (
                  <Spinner size={14} className="animate-spin" />
                ) : stats.is_following ? (
                  <UserMinus size={16} weight="bold" />
                ) : (
                  <UserPlus size={16} weight="bold" />
                )}
                {stats.is_following ? "Following" : "Follow"}
              </button>
              <button
                onClick={() => nav(`/messages/${target.id}`)}
                data-testid={`message-${target.id}`}
                className="btn-black inline-flex items-center gap-1.5"
              >
                <ChatCircleText size={16} weight="bold" /> Message
              </button>
            </div>
          )}
        </div>

        {target.bio && <p className="mt-4 text-zinc-700 max-w-2xl">{target.bio}</p>}

        <div className="mt-5 flex gap-6 text-sm">
          <div>
            <span className="font-display text-2xl font-bold">{posts.length}</span>{" "}
            <span className="text-zinc-500">posts</span>
          </div>
          <div data-testid="stat-followers">
            <span className="font-display text-2xl font-bold">{stats.followers}</span>{" "}
            <span className="text-zinc-500">followers</span>
          </div>
          <div data-testid="stat-following">
            <span className="font-display text-2xl font-bold">{stats.following}</span>{" "}
            <span className="text-zinc-500">following</span>
          </div>
          <div>
            <span className="font-display text-2xl font-bold">
              {posts.reduce((acc, p) => acc + (p.likes?.length || 0), 0)}
            </span>{" "}
            <span className="text-zinc-500">revs</span>
          </div>
        </div>

        {edit && isMe && (
          <div className="mt-6 p-5 bg-[#FAFAFA] border border-[#E4E4E7] rounded-2xl space-y-3" data-testid="edit-form">
            <input
              className="hive-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Display name"
              data-testid="edit-name"
            />
            {target.role === "mechanic" && (
              <input
                className="hive-input"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                placeholder="Specialty"
                data-testid="edit-specialty"
              />
            )}
            <textarea
              className="hive-input min-h-[80px] resize-none"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Bio"
              data-testid="edit-bio"
            />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEdit(false)} className="btn-ghost" data-testid="edit-cancel">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-yellow inline-flex items-center gap-1.5 disabled:opacity-60" data-testid="edit-save">
                {saving && <Spinner size={14} className="animate-spin" />} Save changes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Posts grid */}
      <div className="mt-10 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight">Garage</h2>
          <span className="text-xs text-zinc-500 font-mono-tight">{posts.length} posts</span>
        </div>

        {posts.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-200 rounded-xl p-10 text-center">
            <p className="font-display text-2xl font-bold">No posts yet.</p>
            {isMe && <p className="text-zinc-600 mt-1">Post your first build using the + button.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {posts.map((p) => (
              <div key={p.id} className="relative aspect-square bg-zinc-100 overflow-hidden group" data-testid={`grid-post-${p.id}`}>
                {p.media_type === "video" && (p.media_path || p.image_path) ? (
                  <video
                    src={fileUrl(p.media_path || p.image_path)}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (p.media_path || p.image_path) ? (
                  <img
                    src={fileUrl(p.media_path || p.image_path)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="p-3 text-xs sm:text-sm">{p.caption}</div>
                )}
                {p.media_type === "video" && (
                  <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Video
                  </span>
                )}
                {isMe && (
                  <button
                    onClick={() => removePost(p.id)}
                    className="absolute top-2 right-2 bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    data-testid={`grid-delete-${p.id}`}
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
