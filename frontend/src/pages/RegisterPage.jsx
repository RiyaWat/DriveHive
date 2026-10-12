import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HiveLogo } from "../components/HiveLogo";
import { Spinner } from "@phosphor-icons/react";

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "user",
    bio: "",
    specialty: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await register(form);
    setBusy(false);
    if (r.ok) nav("/");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md">
        <HiveLogo />
        <h2 className="font-display text-4xl font-bold tracking-tight mt-8">Join the hive.</h2>
        <p className="text-zinc-600 mt-2">Real enthusiasts, real builds, real mechanics.</p>

        <div className="mt-6 inline-flex p-1 bg-[#FAFAFA] border border-[#E4E4E7] rounded-full">
          <button
            type="button"
            onClick={() => update("role", "user")}
            data-testid="role-user"
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              form.role === "user" ? "bg-[#FACC15] text-black" : "text-zinc-600"
            }`}
          >
            Enthusiast
          </button>
          <button
            type="button"
            onClick={() => update("role", "mechanic")}
            data-testid="role-mechanic"
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              form.role === "mechanic" ? "bg-black text-[#FACC15]" : "text-zinc-600"
            }`}
          >
            Mechanic
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            data-testid="reg-name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="hive-input"
            placeholder="Display name"
          />
          <input
            data-testid="reg-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="hive-input"
            placeholder="Email"
          />
          <input
            data-testid="reg-password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="hive-input"
            placeholder="Password (min 6 chars)"
          />
          {form.role === "mechanic" && (
            <input
              data-testid="reg-specialty"
              value={form.specialty}
              onChange={(e) => update("specialty", e.target.value)}
              className="hive-input"
              placeholder="Specialty (e.g. Engine & Drivetrain)"
            />
          )}
          <textarea
            data-testid="reg-bio"
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            className="hive-input min-h-[80px] resize-none"
            placeholder="Tell the hive about yourself…"
          />
          {err && (
            <p className="text-sm text-red-600" data-testid="reg-error">
              {err}
            </p>
          )}
          <button
            data-testid="reg-submit"
            disabled={busy}
            className="btn-yellow w-full inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy && <Spinner size={16} className="animate-spin" />}
            Create account
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600">
          Already buzzing?{" "}
          <Link to="/login" className="font-bold text-black underline" data-testid="goto-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
