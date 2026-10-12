import { fileUrl } from "../lib/api";

export function Avatar({ user, size = 36, className = "", ringYellow = false }) {
  const src = user?.avatar_url ? fileUrl(user.avatar_url) : null;
  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const ring = ringYellow ? "ring-2 ring-[#FACC15] ring-offset-2 ring-offset-white" : "";
  const style = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={user?.name || "user"}
        style={style}
        className={`rounded-full object-cover bg-zinc-100 ${ring} ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`rounded-full bg-black text-[#FACC15] flex items-center justify-center font-bold ${ring} ${className}`}
    >
      <span style={{ fontSize: size * 0.38 }}>{initials}</span>
    </div>
  );
}
