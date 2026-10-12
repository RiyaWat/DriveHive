import { useState } from "react";
import { Plus, X, Image as ImageIcon, Spinner } from "@phosphor-icons/react";
import { api, fileUrl, formatApiErrorDetail } from "../lib/api";

export function CreatePostModal({ open, onClose, onCreated, mode = "post" }) {
  // mode: 'post' | 'story'
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const reset = () => {
    setCaption("");
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

  const isVideo = file && file.type.startsWith("video/");

  const submit = async () => {
    setErr("");
    if (mode === "story" && !file) {
      setErr("Pick a photo or video to add to your story");
      return;
    }
    if (mode === "post" && !file && !caption.trim()) {
      setErr("Add a photo or caption");
      return;
    }
    setBusy(true);
    try {
      let path = null;
      let mediaType = "image";
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        path = data.path;
        mediaType = data.media_type || "image";
      }
      if (mode === "post") {
        await api.post("/posts", {
          caption,
          media_path: path,
          media_type: mediaType,
        });
      } else {
        await api.post("/stories", { media_path: path, media_type: mediaType });
      }
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
      data-testid="create-modal"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl border-2 border-black overflow-hidden hive-rise">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7] hive-stripes-thin">
          <h3 className="font-display text-2xl font-bold uppercase tracking-tight">
            {mode === "story" ? "Add to story" : "New post"}
          </h3>
          <button onClick={close} className="text-black hover:opacity-70" data-testid="modal-close-btn">
            <X size={22} weight="bold" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <div
              className={`relative aspect-[4/5] w-full rounded-xl overflow-hidden border-2 border-dashed ${
                preview ? "border-transparent" : "border-zinc-300 bg-[#FAFAFA]"
              } flex items-center justify-center cursor-pointer hover:border-black transition-colors`}
            >
              {preview ? (
                isVideo ? (
                  <video src={preview} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="text-center text-zinc-500">
                  <ImageIcon size={40} weight="duotone" />
                  <p className="mt-2 font-semibold">
                    Click to upload {mode === "story" ? "a photo or video" : "a photo or video"}
                  </p>
                  <p className="text-xs">
                    PNG / JPG / WEBP / MP4 / MOV, up to {mode === "story" ? "60MB" : "60MB"}
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={onFile}
                data-testid="upload-input"
              />
            </div>
          </label>

          {mode === "post" && (
            <textarea
              data-testid="caption-input"
              className="hive-input min-h-[90px] resize-none"
              placeholder="Tell the hive about your ride…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          )}

          {err && (
            <p className="text-sm text-red-600" data-testid="modal-error">
              {err}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={close} className="btn-ghost" data-testid="modal-cancel">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="btn-yellow inline-flex items-center gap-1.5 disabled:opacity-60"
              data-testid="modal-submit"
            >
              {busy ? <Spinner size={16} className="animate-spin" /> : <Plus size={16} weight="bold" />}
              {mode === "story" ? "Share story" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
