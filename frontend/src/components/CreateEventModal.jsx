import { useState } from "react";
import { X, MapPin, Calendar, Spinner, Image as ImageIcon } from "@phosphor-icons/react";
import { api, formatApiErrorDetail } from "../lib/api";

export function CreateEventModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const reset = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartsAt("");
    setFile(null);
    setPreview(null);
    setErr("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    setErr("");
    if (!title.trim() || !location.trim() || !startsAt) {
      setErr("Title, location and date/time are required");
      return;
    }
    setBusy(true);
    try {
      let image_path = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        image_path = data.path;
      }
      await api.post("/events", {
        title,
        description,
        location,
        starts_at: new Date(startsAt).toISOString(),
        image_path,
      });
      onCreated && onCreated();
      close();
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="event-modal"
    >
      <div className="bg-white w-full max-w-xl rounded-2xl border-2 border-black overflow-hidden hive-rise">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7]">
          <h3 className="font-display text-2xl font-bold uppercase">Host a meet</h3>
          <button onClick={close} className="hover:opacity-70" data-testid="event-modal-close">
            <X size={22} weight="bold" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <input
            data-testid="event-title-input"
            className="hive-input"
            placeholder="Event title — e.g. Friday Night Cars & Coffee"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                data-testid="event-location-input"
                className="hive-input pl-10"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="relative">
              <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                data-testid="event-time-input"
                type="datetime-local"
                className="hive-input pl-10"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
          </div>
          <textarea
            data-testid="event-desc-input"
            className="hive-input min-h-[80px] resize-none"
            placeholder="Tell the hive what to expect…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="block">
            <div
              className={`relative h-40 w-full rounded-xl overflow-hidden border-2 border-dashed ${
                preview ? "border-transparent" : "border-zinc-300 bg-[#FAFAFA]"
              } flex items-center justify-center cursor-pointer hover:border-black transition-colors`}
            >
              {preview ? (
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-zinc-500">
                  <ImageIcon size={28} weight="duotone" />
                  <p className="mt-1 text-sm font-semibold">Cover image (optional)</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFile}
                data-testid="event-image-input"
              />
            </div>
          </label>

          {err && (
            <p className="text-sm text-red-600" data-testid="event-modal-error">
              {err}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={close} className="btn-ghost" data-testid="event-modal-cancel">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="btn-yellow inline-flex items-center gap-1.5 disabled:opacity-60"
              data-testid="event-modal-submit"
            >
              {busy && <Spinner size={16} className="animate-spin" />}
              Publish meet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
