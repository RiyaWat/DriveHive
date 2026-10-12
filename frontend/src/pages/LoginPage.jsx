import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiveLogo } from "../components/HiveLogo";
import { Wrench, House, ArrowRight, Spinner, Lightning } from "@phosphor-icons/react";

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await login(email, password);
    setBusy(false);
    if (r.ok) nav("/");
    else setErr(r.error);
  };

  const tryDemo = async () => {
    setDemoBusy(true);
    setErr("");
    const r = await demoLogin();
    setDemoBusy(false);
    if (r.ok) nav("/");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative bg-black overflow-hidden hidden lg:flex items-center justify-center p-10">
        <div className="absolute inset-0 hive-stripes opacity-10" />
        <div className="relative z-10 max-w-lg">
          <HiveLogo variant="white" className="mb-10" />
          <h1 className="font-display text-6xl text-white font-bold leading-[0.95] tracking-tight">
            The hive for <span className="bg-[#FACC15] text-black px-2">car people.</span>
          </h1>
          <p className="text-zinc-300 mt-6 text-lg leading-relaxed">
            Post your build, find the next meet, and get straight answers from real mechanics. No
            algorithms. No noise. Just the gearheads.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: House, label: "Live feed" },
              { icon: Wrench, label: "Mechanic DM" },
              { icon: ArrowRight, label: "Local meets" },
            ].map(({ icon: Icon, label }, i) => (
              <div
                key={i}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#FACC15] transition-colors"
              >
                <Icon size={24} weight="bold" className="text-[#FACC15]" />
                <p className="text-white text-sm mt-2 font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <HiveLogo />
          </div>
          <h2 className="font-display text-4xl font-bold tracking-tight">Welcome back.</h2>
          <p className="text-zinc-600 mt-2">Sign in to keep up with the hive.</p>

          <div className="mt-8 p-4 rounded-xl bg-black text-white border-2 border-black">
            <p className="text-xs uppercase tracking-wider font-bold text-[#FACC15]">Just looking around?</p>
            <p className="text-sm text-zinc-300 mt-1">
              Jump into a demo account with sample builds, meets and mechanic chats. No sign-up.
            </p>
            <button
              type="button"
              onClick={tryDemo}
              disabled={demoBusy || busy}
              data-testid="demo-login"
              className="btn-yellow w-full mt-3 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {demoBusy ? <Spinner size={16} className="animate-spin" /> : <Lightning size={16} weight="fill" />}
              Try the demo
            </button>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <div className="h-px bg-[#E4E4E7] flex-1" />
            <p className="text-xs uppercase tracking-wider font-bold text-zinc-400">or sign in</p>
            <div className="h-px bg-[#E4E4E7] flex-1" />
          </div>

          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              data-testid="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="hive-input"
              placeholder="Email address"
            />
            <input
              data-testid="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="hive-input"
              placeholder="Password"
            />
            {err && (
              <p className="text-sm text-red-600" data-testid="login-error">
                {err}
              </p>
            )}
            <button
              data-testid="login-submit"
              disabled={busy}
              className="btn-yellow w-full inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy && <Spinner size={16} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-6 text-sm text-zinc-600">
            New to the hive?{" "}
            <Link to="/register" className="font-bold text-black underline" data-testid="goto-register">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
