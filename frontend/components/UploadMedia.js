// frontend/components/UploadMedia.js
import { useRef, useState } from "react";

const ICONS = { image: "🖼️", audio: "🔊", default: "📄" };

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function guessType(file) {
  if (!file) return "default";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "default";
}

export default function UploadMedia({ onFileSelected, accept = "*", label = "Upload File" }) {
  const inputRef  = useRef(null);
  const [file,    setFile]    = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error,   setError]   = useState("");

  function handleFile(f) {
    setError("");
    if (!f) return;

    // Validate against accept prop
    if (accept !== "*") {
      const allowed = accept.split(",").map(s => s.trim());
      const ok = allowed.some(a => {
        if (a.startsWith(".")) return f.name.endsWith(a);
        if (a.endsWith("/*")) return f.type.startsWith(a.slice(0, -2));
        return f.type === a;
      });
      if (!ok) {
        setError(`Invalid file type. Accepted: ${accept}`);
        return;
      }
    }
    setFile(f);
    if (onFileSelected) onFileSelected(f);
  }

  function onDragOver(e) { e.preventDefault(); setDragging(true); }
  function onDragLeave()  { setDragging(false); }
  function onDrop(e)      { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }
  function onClick()      { inputRef.current?.click(); }
  function onChange(e)    { handleFile(e.target.files[0]); }

  const type = guessType(file);

  return (
    <div>
      <p className="text-sm font-medium mb-2" style={{ color: "#94a3b8" }}>{label}</p>

      {/* Drop zone */}
      <div
        data-testid="upload-dropzone"
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
        style={{
          border:          `2px dashed ${dragging ? "#6366f1" : error ? "#ef4444" : "#1e1e2e"}`,
          backgroundColor: dragging ? "rgba(99,102,241,0.06)" : "#13131a",
          minHeight:       "160px",
        }}
      >
        <span className="text-4xl">{file ? ICONS[type] : "📂"}</span>
        {file ? (
          <div className="text-center">
            <p className="font-medium" style={{ color: "#e2e8f0" }}>{file.name}</p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
              {humanSize(file.size)} &bull; {file.type || "unknown type"}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p style={{ color: "#e2e8f0" }}>Drag &amp; drop or <span style={{ color: "#6366f1" }}>browse</span></p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Accepted: {accept}</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs mt-2" style={{ color: "#ef4444" }}>{error}</p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
        data-testid="upload-input"
      />
    </div>
  );
}
