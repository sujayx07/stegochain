import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FILES = {
  "StegoChain.sol": {
    lang: "solidity",
    code: [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity ^0.8.19;",
      "",
      "contract StegoChain {",
      "    struct Message {",
      "        bytes32 merkleRoot;",
      "        string ipfsHash;",
      "        uint256 timestamp;",
      "    }",
      "    ",
      "    mapping(string => Message) private records;",
      "",
      "    function registerRecord(",
      "        string memory session,",
      "        bytes32 root,",
      "        string memory ipfs",
      "    ) public {",
      "        records[session] = Message(",
      "            root,",
      "            ipfs,",
      "            block.timestamp",
      "        );",
      "    }",
      "}"
    ]
  },
  "stego_lsb.py": {
    lang: "python",
    code: [
      "# Steganographic LSB Embedder",
      "import numpy as np",
      "from PIL import Image",
      "",
      "def embed_message(cover_path, msg_bin, out_path):",
      "    img = Image.open(cover_path)",
      "    data = np.array(img)",
      "    flat = data.flatten()",
      "    ",
      "    # Swap Least Significant Bits",
      "    for i, bit in enumerate(msg_bin):",
      "        flat[i] = (flat[i] & ~1) | int(bit)",
      "        ",
      "    reshaped = flat.reshape(data.shape)",
      "    result = Image.fromarray(reshaped)",
      "    result.save(out_path)",
      "    return True"
    ]
  }
};

export default function LiveCodingIDE() {
  const [activeFile, setActiveFile] = useState("StegoChain.sol");
  const [typedLines, setTypedLines] = useState([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [currentCharIdx, setCurrentCharIdx] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [blocks, setBlocks] = useState([
    { height: 5392100, txs: 3, hash: "0x8a7f...1e02" },
    { height: 5392101, txs: 1, hash: "0x4c2b...8f4e" }
  ]);
  const [ideState, setIdeState] = useState("coding"); // coding, compiling, deployed
  
  const terminalRef = useRef(null);

  // Live Typing Simulator Effect
  useEffect(() => {
    setTypedLines([]);
    setCurrentLineIdx(0);
    setCurrentCharIdx(0);
    setIdeState("coding");
    setTerminalLogs(["[SYSTEM] Opened workspace workspace/stegochain", `[SYSTEM] Editing ${activeFile}...`]);
  }, [activeFile]);

  useEffect(() => {
    if (ideState !== "coding") return;
    
    const fileCode = FILES[activeFile].code;
    if (currentLineIdx >= fileCode.length) {
      // Completed typing! Trigger compilation phase
      setIdeState("compiling");
      return;
    }

    const currentLineText = fileCode[currentLineIdx];
    
    const timer = setTimeout(() => {
      if (currentCharIdx < currentLineText.length) {
        // Typing characters
        setTypedLines(prev => {
          const next = [...prev];
          if (!next[currentLineIdx]) {
            next[currentLineIdx] = "";
          }
          next[currentLineIdx] += currentLineText[currentCharIdx];
          return next;
        });
        setCurrentCharIdx(prev => prev + 1);
      } else {
        // Line completed, move to next line after short delay
        setCurrentLineIdx(prev => prev + 1);
        setCurrentCharIdx(0);
      }
    }, Math.random() * 20 + 8); // Fast organic typing

    return () => clearTimeout(timer);
  }, [currentCharIdx, currentLineIdx, ideState, activeFile]);

  // Terminal Compilation & Blockchain Deployment Simulation
  useEffect(() => {
    if (ideState !== "compiling") return;

    let active = true;
    let timerId;

    const logs = activeFile === "StegoChain.sol" ? [
      "🔧 Compiling StegoChain.sol via Solidity 0.8.19 Compiler...",
      "✔ Compiler optimization enabled (200 runs).",
      "✔ Contract compiled successfully! Bytecode size: 3.1 KB",
      "🚀 Deploying contract to Sepolia Testnet via MetaMask...",
      "⏱ Waiting for block confirmation...",
      "⚓ Gas used: 114,804 SepoliaGwei",
      "✔ Transaction Confirmed! Hash: 0x6e9f2910ab3ce412f842bc942b0124fe",
      "🎉 StegoChain successfully anchored on blockchain at block #" + (blocks[blocks.length - 1].height + 1)
    ] : [
      "⚙ Initializing Python stego environment...",
      "✔ Testing LSB matrices...",
      "✔ Echo hiding algorithm loaded.",
      "✔ Code execution test: PASSED (100% vector accuracy)"
    ];

    let logIdx = 0;
    const addLog = () => {
      if (!active) return;
      if (logIdx < logs.length) {
        setTerminalLogs(prev => [...prev, logs[logIdx]]);
        logIdx++;
        timerId = setTimeout(addLog, 600);
      } else {
        // Done with compilation & deployment
        setIdeState("deployed");
        if (activeFile === "StegoChain.sol") {
          // Mint new block on the blockchain!
          const nextBlockNum = blocks[blocks.length - 1].height + 1;
          setBlocks(prev => [
            ...prev,
            {
              height: nextBlockNum,
              txs: Math.floor(Math.random() * 3) + 1,
              hash: "0x" + Math.random().toString(16).substring(2, 6) + "..." + Math.random().toString(16).substring(2, 6)
            }
          ]);
        }
        // Wait 4 seconds and toggle/reset workspace file
        timerId = setTimeout(() => {
          if (active) {
            setActiveFile(prev => prev === "StegoChain.sol" ? "stego_lsb.py" : "StegoChain.sol");
          }
        }, 4000);
      }
    };

    timerId = setTimeout(addLog, 400);

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [ideState, activeFile]);

  // Auto scroll terminal logs (only scrolls the container, not the browser window!)
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // CSS syntax highlighting parser
  const renderHighlightedLine = (lineText, lang) => {
    if (!lineText) return <br />;
    
    // Quick keyword highlight mappings
    const words = lineText.split(/(\s+|=|\(|\)|\{|\}|;|\[|\]|\.|,|")/);
    
    return words.map((w, i) => {
      let color = "#333333"; // Text Color
      if (["contract", "struct", "mapping", "function", "def", "import", "from", "return", "pragma", "solidity"].includes(w)) {
        color = "#E8680C"; // Burnt Orange Keywords
      } else if (["memory", "public", "private", "string", "bytes32", "uint256"].includes(w)) {
        color = "#864E2E"; // Orange Muted DataType
      } else if (w.startsWith("//") || w.startsWith("#")) {
        color = "#888888"; // Gray comments
      } else if (w.startsWith('"') || w.startsWith("'") || (words[i-1] === '"')) {
        color = "#1A9F4A"; // Green Strings
      } else if (!isNaN(w) && w.trim() !== "") {
        color = "#CF8100"; // Gold numbers
      }

      return <span key={i} style={{ color }}>{w}</span>;
    });
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px 48px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div className="section-label">Real-time Simulation</div>
        <h2 className="section-title">Developer Sandbox & Live Ledger</h2>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        
        {/* Mock IDE Window Panel */}
        <div style={{
          flex: 1.5, minWidth: 320, borderRadius: 16, border: "1px solid #EBEBEB",
          background: "white", boxShadow: "0 8px 30px rgba(0,0,0,0.04)", overflow: "hidden",
          display: "flex", flexDirection: "column", height: 480
        }}>
          {/* IDE macOS-style Title Bar */}
          <div style={{
            background: "#FAFAFA", borderBottom: "1px solid #EBEBEB",
            padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F56" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27C93F" }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>
              {activeFile} — StegoChain Workspace
            </div>
            <div style={{ width: 42 }} /> {/* balance spacers */}
          </div>

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            
            {/* Sidebar File Tree */}
            <div style={{
              width: 140, background: "#FCFCFC", borderRight: "1px solid #EBEBEB",
              padding: "16px 8px", display: "flex", flexDirection: "column", gap: 4
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#BBB", paddingLeft: 8, marginBottom: 8, letterSpacing: "0.08em" }}>FILES</div>
              {Object.keys(FILES).map(f => (
                <div
                  key={f}
                  onClick={() => { if (ideState === "coding" || ideState === "deployed") setActiveFile(f); }}
                  style={{
                    padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: ideState === "compiling" ? "not-allowed" : "pointer",
                    background: activeFile === f ? "#FFF4EB" : "transparent",
                    color: activeFile === f ? "#E8680C" : "#666",
                    transition: "all 0.15s ease",
                    fontFamily: "var(--font-mono)"
                  }}
                >
                  {f.endsWith(".sol") ? "⛓ " : "🐍 "}
                  {f}
                </div>
              ))}
            </div>

            {/* Code Editor Pane */}
            <div style={{
              flex: 1, padding: "20px", overflowY: "auto",
              fontFamily: "var(--font-mono)", fontSize: 14, background: "#FFFFFF",
              lineHeight: 1.5, position: "relative"
            }}>
              {typedLines.map((line, idx) => (
                <div key={idx} style={{ display: "flex", gap: 14 }}>
                  <span style={{ color: "#DDD", width: 20, textAlign: "right", select: "none", fontSize: 12 }}>{idx + 1}</span>
                  <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                    {renderHighlightedLine(line, FILES[activeFile].lang)}
                    {idx === typedLines.length - 1 && ideState === "coding" && (
                      <span className="cursor" style={{ background: "#E8680C", width: 6, height: 14, display: "inline-block", marginLeft: 2, verticalAlign: "middle", animation: "blink 1s steps(2, start) infinite" }} />
                    )}
                  </span>
                </div>
              ))}

              <style>{`
                @keyframes blink { to { visibility: hidden; } }
              `}</style>
            </div>
          </div>

          {/* Editor Terminal Console logs output */}
          <div 
            ref={terminalRef}
            style={{
              height: 140, background: "#111111", borderTop: "1px solid #222",
              padding: "12px 18px", fontFamily: "var(--font-mono)", fontSize: 12,
              color: "#A2C3A7", overflowY: "auto", display: "flex", flexDirection: "column", gap: 3
            }}
          >
            {terminalLogs.map((log, idx) => {
              if (!log || typeof log !== "string") return null;
              let logColor = "#A2C3A7";
              if (log.startsWith("✔") || log.startsWith("🎉")) logColor = "#27C93F";
              if (log.startsWith("🔧") || log.startsWith("🚀")) logColor = "#E8680C";
              if (log.startsWith("⏱")) logColor = "#FFBD2E";
              if (log.startsWith("[SYSTEM]")) logColor = "#888888";
              
              return (
                <div key={idx} style={{ color: logColor }}>{log}</div>
              );
            })}
          </div>
        </div>

        {/* Live Block Ledger Visualization */}
        <div style={{
          flex: 0.8, minWidth: 260, borderRadius: 16, border: "1px solid #EBEBEB",
          background: "white", boxShadow: "0 8px 30px rgba(0,0,0,0.04)", overflow: "hidden",
          padding: "24px 20px", display: "flex", flexDirection: "column", height: 480
        }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 6, fontFamily: "var(--font-heading)" }}>On-Chain Blocks</h3>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Visual representation of smart contract transaction blocks minted live on Sepolia network.</p>

          <div style={{ display: "flex", flexDirection: "column-reverse", gap: 14, overflowY: "auto", flex: 1, paddingRight: 4 }}>
            <AnimatePresence>
              {blocks.map((b, idx) => (
                <motion.div
                  key={b.height}
                  initial={{ opacity: 0, scale: 0.8, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    background: "#FFF8F3", border: "1.5px solid #F5B888",
                    borderRadius: 12, padding: "14px 16px", position: "relative"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#E8680C", fontFamily: "var(--font-mono)" }}>Block #{b.height}</span>
                    <span style={{
                      fontSize: 11, background: "#FFF0E3", color: "#E8680C",
                      fontWeight: 700, padding: "2px 8px", borderRadius: 20
                    }}>
                      {b.txs} {b.txs === 1 ? "Tx" : "Txs"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 11, color: "#888", display: "flex", justifyContent: "space-between" }}>
                      <span>Hash</span>
                      <span className="mono" style={{ color: "#333", fontWeight: 600 }}>{b.hash}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#888", display: "flex", justifyContent: "space-between" }}>
                      <span>Status</span>
                      <span style={{ color: "#1A9F4A", fontWeight: 700 }}>● Confirmed</span>
                    </div>
                  </div>

                  {/* Chain Connection Link Graphic */}
                  {idx > 0 && (
                    <div style={{
                      position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)",
                      width: 2, height: 12, background: "#F5B888", zIndex: 1
                    }} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
