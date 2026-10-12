import { Link, useLocation, useNavigate } from "react-router-dom";
import { House, CalendarBlank, Wrench, ChatCircleText, Plus } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./Avatar";
import { HiveLogo } from "./HiveLogo";
import { NotificationsBell } from "./NotificationsBell";
import { SearchBox } from "./SearchBox";

const navItems = [
  { to: "/", label: "Feed", icon: House, testid: "nav-feed" },
  { to: "/events", label: "Events", icon: CalendarBlank, testid: "nav-events" },
  { to: "/mechanics", label: "Mechanics", icon: Wrench, testid: "nav-mechanics" },
  { to: "/messages", label: "Messages", icon: ChatCircleText, testid: "nav-messages" },
];

export function TopBar({ onCreate }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <header
      className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-[#E4E4E7]"
      data-testid="top-bar"
    >
      <div className="max-w-6xl mx-auto h-16 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/" data-testid="logo-link" className="flex-shrink-0">
          <HiveLogo />
        </Link>

        <div className="flex-1 max-w-xs mx-2 sm:mx-4">
          <SearchBox />
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon, testid }) => {
            const active =
              to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                data-testid={testid}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  active
                    ? "bg-black text-[#FACC15]"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <Icon size={18} weight={active ? "fill" : "regular"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <NotificationsBell />
          <button
            onClick={onCreate}
            data-testid="topbar-create-btn"
            className="hidden sm:inline-flex btn-yellow items-center gap-1.5 hive-bob"
          >
            <Plus size={16} weight="bold" />
            Post
          </button>
          {user && (
            <button
              onClick={() => nav(`/profile/${user.id}`)}
              data-testid="profile-bubble"
              className="rounded-full ring-2 ring-[#FACC15] ring-offset-2 ring-offset-white hover:opacity-80 transition-opacity"
            >
              <Avatar user={user} size={40} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({ onCreate }) {
  const loc = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E4E4E7] h-16 grid grid-cols-5"
      data-testid="mobile-bottom-nav"
    >
      {navItems.slice(0, 2).map(({ to, label, icon: Icon, testid }) => {
        const active = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            data-testid={`m-${testid}`}
            className={`flex flex-col items-center justify-center text-xs ${
              active ? "text-black" : "text-zinc-500"
            }`}
          >
            <Icon size={22} weight={active ? "fill" : "regular"} />
            <span className="mt-0.5">{label}</span>
          </Link>
        );
      })}
      <button
        onClick={onCreate}
        data-testid="m-create-btn"
        className="flex items-center justify-center"
      >
        <span className="w-12 h-12 rounded-full bg-[#FACC15] border-2 border-black flex items-center justify-center -mt-6 shadow-lg">
          <Plus size={22} weight="bold" />
        </span>
      </button>
      {navItems.slice(2).map(({ to, label, icon: Icon, testid }) => {
        const active = loc.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            data-testid={`m-${testid}`}
            className={`flex flex-col items-center justify-center text-xs ${
              active ? "text-black" : "text-zinc-500"
            }`}
          >
            <Icon size={22} weight={active ? "fill" : "regular"} />
            <span className="mt-0.5">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
