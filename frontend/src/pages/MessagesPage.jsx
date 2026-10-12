import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PaperPlaneTilt, Wrench } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";

export default function MessagesPage() {
  const { mechanicId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null); // user object
  const [thread, setThread] = useState([]);
  const [text, setText] = useState("");
  const [connections, setConnections] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const endRef = useRef(null);

  const loadConvs = async () => {
    try {
      const { data } = await api.get("/messages/conversations");
      setConvs(data);
    } catch {}
  };

  const loadThread = async (otherId) => {
    try {
      const { data } = await api.get(`/messages/${otherId}`);
      setThread(data);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {}
  };

  useEffect(() => {
    loadConvs();
    api.get("/mechanics").then((r) => setMechanics(r.data)).catch(() => {});
    api.get("/users/me/connections").then((r) => setConnections(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mechanicId) {
      setActive(null);
      setThread([]);
      return;
    }
    api.get(`/users/${mechanicId}`).then((r) => setActive(r.data)).catch(() => {});
    loadThread(mechanicId);
  }, [mechanicId]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !active) return;
    const t = text;
    setText("");
    const { data } = await api.post("/messages", { to_user_id: active.id, text: t });
    setThread((prev) => [...prev, data]);
    loadConvs();
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const sidebar = (
    <aside className="w-full md:w-80 border-r border-[#E4E4E7] bg-white overflow-y-auto" data-testid="messages-sidebar">
      <div className="p-4 border-b border-[#E4E4E7] sticky top-0 bg-white z-10">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">Inbox</h2>
        <p className="text-xs text-zinc-500 mt-1">Talk to mechanics, get back to building.</p>
      </div>

      {convs.length > 0 && (
        <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-bold text-zinc-500">
          Recent
        </div>
      )}
      {convs.map((c) => (
        <button
          key={c.other_user?.id}
          onClick={() => nav(`/messages/${c.other_user.id}`)}
          data-testid={`conv-${c.other_user?.id}`}
          className={`w-full flex items-center gap-3 p-4 hover:bg-[#FAFAFA] border-b border-[#E4E4E7] text-left transition-colors ${
            active?.id === c.other_user?.id ? "bg-[#FAFAFA]" : ""
          }`}
        >
          <Avatar user={c.other_user} size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{c.other_user?.name}</p>
            <p className="text-xs text-zinc-500 truncate">{c.last_message?.text}</p>
          </div>
        </button>
      ))}

      <div className="px-4 pt-5 pb-1 text-[11px] uppercase tracking-wider font-bold text-zinc-500">
        Your crew
      </div>
      {connections.length === 0 && (
        <p className="px-4 pb-3 text-xs text-zinc-500">
          Follow riders and mechanics to start chats with them.
        </p>
      )}
      {connections.map((c) => (
        <button
          key={c.id}
          onClick={() => nav(`/messages/${c.id}`)}
          data-testid={`conn-${c.id}`}
          className="w-full flex items-center gap-3 p-3 hover:bg-[#FAFAFA] text-left"
        >
          <Avatar user={c} size={36} ringYellow />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{c.name}</p>
            <p className="text-xs text-zinc-500 truncate">
              {c.role === "mechanic" ? `Mechanic · ${c.specialty || "General"}` : "Enthusiast"}
            </p>
          </div>
        </button>
      ))}

      <div className="px-4 pt-5 pb-1 text-[11px] uppercase tracking-wider font-bold text-zinc-500">
        Mechanics
      </div>
      {mechanics.map((m) => (
        <button
          key={m.id}
          onClick={() => nav(`/messages/${m.id}`)}
          data-testid={`new-conv-${m.id}`}
          className="w-full flex items-center gap-3 p-3 hover:bg-[#FAFAFA] text-left"
        >
          <Avatar user={m} size={36} ringYellow />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{m.name}</p>
            <p className="text-xs text-zinc-500 truncate inline-flex items-center gap-1">
              <Wrench size={10} /> {m.specialty}
            </p>
          </div>
        </button>
      ))}
    </aside>
  );

  const empty = (
    <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#FAFAFA] text-center p-10">
      <div className="w-16 h-16 rounded-full bg-[#FACC15] border-2 border-black flex items-center justify-center">
        <Wrench size={28} weight="bold" />
      </div>
      <h3 className="font-display text-3xl font-bold mt-4">Pick a mechanic</h3>
      <p className="text-zinc-600 mt-2 max-w-sm">
        Choose a pro from the list and ask anything — engine codes, suspension setups, or that funky
        smell you keep hearing about.
      </p>
    </div>
  );

  const chat = active && (
    <section className="flex-1 flex flex-col bg-[#FAFAFA]" data-testid="chat-area">
      <header className="bg-white border-b border-[#E4E4E7] p-3 flex items-center gap-3">
        <button
          onClick={() => nav("/messages")}
          className="md:hidden p-1.5 rounded-full hover:bg-zinc-100"
          data-testid="chat-back-btn"
        >
          <ArrowLeft size={20} />
        </button>
        <Avatar user={active} size={40} ringYellow />
        <div>
          <p className="font-bold">{active.name}</p>
          <p className="text-xs text-zinc-500 inline-flex items-center gap-1">
            <Wrench size={10} /> {active.specialty || active.role}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {thread.length === 0 && (
          <div className="text-center text-zinc-500 mt-10">
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs">Say hi and describe what your car is doing.</p>
          </div>
        )}
        {thread.map((m) => {
          const mine = m.from_user_id === user?.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
              data-testid={`msg-${m.id}`}
            >
              <div
                className={`max-w-[75%] py-2 px-3.5 rounded-2xl text-sm leading-relaxed ${
                  mine
                    ? "bg-[#FACC15] text-black rounded-tr-none border border-black/5"
                    : "bg-white border border-[#E4E4E7] rounded-tl-none"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-[#E4E4E7] bg-white p-3 flex items-center gap-2">
        <input
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="hive-input flex-1"
          placeholder={`Message ${active.name?.split(" ")[0]}…`}
        />
        <button
          type="submit"
          data-testid="chat-send-btn"
          className="btn-yellow inline-flex items-center gap-1.5"
        >
          <PaperPlaneTilt size={16} weight="bold" />
          Send
        </button>
      </form>
    </section>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex" data-testid="messages-page">
      <div className={`${active ? "hidden md:flex" : "flex"} w-full md:w-80 flex-col`}>{sidebar}</div>
      {active ? chat : empty}
    </div>
  );
}
