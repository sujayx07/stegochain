import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Image, Audio, FileText, Upload, AlertTriangle } from "./Icons";

export default function DropZone({ onFileSelected, accept, label = "Drop file here or click to browse", hint, maxSizeMB = 10 }) {
  const [error, setError]       = useState(null);
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
    onDrop, accept, maxSize: maxSizeMB * 1024 * 1024, multiple: false,
  });

  const isImage = selected && selected.type.startsWith("image/");
  const isAudio = selected && selected.type.startsWith("audio/");
  const sizeStr = selected ? `${(selected.size / 1024).toFixed(1)} KB` : null;

  return (
    <div>
      <motion.div
        {...getRootProps()}
        whileHover={{ scale: 1.005 }}
        animate={{
          borderColor: error ? "#E03131" : isDragActive ? "#E8680C" : selected ? "#E8680C" : "rgba(231, 229, 228, 0.7)",
          background: isDragActive ? "rgba(255, 240, 230, 0.72)" : selected ? "rgba(255, 251, 249, 0.72)" : "rgba(255, 255, 255, 0.45)",
        }}
        transition={{ duration: 0.2 }}
        style={{
          border: "2px dashed",
          borderStyle: isDragActive ? "solid" : "dashed",
          borderRadius: 16,
          padding: "28px 24px",
          textAlign: "center",
          cursor: "pointer",
          outline: "none",
          position: "relative",
          overflow: "hidden",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {/* Active drag overlay */}
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "absolute", inset: 0, background: "rgba(249,115,22,0.06)", borderRadius: 14, pointerEvents: "none" }}
          />
        )}

        <input {...getInputProps()} data-testid="dropzone-input" />

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div key="selected" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{ color: "#E8680C" }}
              >
                {isImage ? <Image size={40} /> : isAudio ? <Audio size={40} /> : <FileText size={40} />}
              </motion.div>
              <div>
                <div style={{ fontWeight: 700, color: "#111111", fontSize: 14 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: "#888888", marginTop: 3 }}>{sizeStr} · {selected.type}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="badge badge-orange">{isImage ? "✓ Image ready" : isAudio ? "✓ Audio ready" : "✓ File ready"}</span>
              </div>
              <div style={{ fontSize: 11, color: "#BBBBBB", marginTop: 2 }}>Click to change file</div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
            >
              {/* Upload icon */}
              <motion.div
                animate={isDragActive ? { y: [-4, 4, -4], scale: 1.1 } : { y: [0, -4, 0] }}
                transition={{ duration: isDragActive ? 0.6 : 2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 52, height: 52, borderRadius: 16, background: isDragActive ? "#FFF4EB" : "#FAFAFA", border: `1.5px solid ${isDragActive ? "#F9DCC4" : "#EBEBEB"}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#E8680C" }}
              >
                <Upload size={24} />
              </motion.div>
              <div>
                <div style={{ fontWeight: 600, color: isDragActive ? "#E8680C" : "#111111", fontSize: 14, transition: "color 0.2s" }}>
                  {isDragActive ? "Release to upload" : label}
                </div>
                {!isDragActive && (
                  <div style={{ fontSize: 13, color: "#BBBBBB", marginTop: 4 }}>
                    or <span style={{ color: "#E8680C", fontWeight: 600 }}>browse files</span>
                  </div>
                )}
              </div>
              {hint && <div style={{ fontSize: 12, color: "#BBBBBB", maxWidth: 280 }}>{hint}</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 8, padding: "8px 12px", background: "#FFF0F0", border: "1px solid #FFC4C4", borderRadius: 8, color: "#E03131", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <AlertTriangle size={14} style={{ color: "#E03131" }} /> {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
