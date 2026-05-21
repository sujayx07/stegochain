import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export default function DropZone({ onFileSelected, accept, label = "Drop file here or click to browse", hint, maxSizeMB = 10 }) {
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError(null);
    if (rejectedFiles.length > 0) {
      const err = rejectedFiles[0].errors[0];
      setError(err.code === "file-too-large" ? `File exceeds ${maxSizeMB}MB limit` : err.message);
      return;
    }
    if (acceptedFiles.length > 0) {
      setSelected(acceptedFiles[0]);
      onFileSelected(acceptedFiles[0]);
    }
  }, [onFileSelected, maxSizeMB]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept, maxSize: maxSizeMB * 1024 * 1024, multiple: false
  });

  const isImage = selected && selected.type.startsWith("image/");
  const isAudio = selected && selected.type.startsWith("audio/");
  const sizeStr = selected ? `${(selected.size / 1024).toFixed(1)} KB` : null;

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${error ? "#DC2626" : isDragActive ? "#F97316" : selected ? "#F97316" : "#E7E5E4"}`,
          borderStyle: isDragActive ? "solid" : "dashed",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
          cursor: "pointer",
          background: isDragActive ? "#FFF0E6" : selected ? "#FFFBF9" : "#FAFAFA",
          transition: "all 0.2s ease"
        }}
      >
        <input {...getInputProps()} data-testid="dropzone-input"/>

        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 36 }}>{isImage ? "🖼️" : isAudio ? "🎵" : "📄"}</div>
            <div>
              <div style={{ fontWeight: 600, color: "#1C1917", fontSize: 14 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: "#78716C", marginTop: 4 }}>{sizeStr} · {selected.type}</div>
            </div>
            <span className="badge-orange">{isImage ? "Image" : isAudio ? "Audio" : "File"}</span>
            <span style={{ fontSize: 12, color: "#78716C" }}>Click to change file</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 36, opacity: 0.5 }}>{isDragActive ? "📂" : "☁️"}</div>
            <div style={{ fontWeight: 500, color: isDragActive ? "#F97316" : "#1C1917", fontSize: 14 }}>
              {isDragActive ? "Release to upload" : label}
            </div>
            {hint && <div style={{ fontSize: 12, color: "#78716C" }}>{hint}</div>}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, color: "#DC2626", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <span>⚠</span> {error}
        </div>
      )}
    </div>
  );
}
