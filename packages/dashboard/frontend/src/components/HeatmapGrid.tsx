import React, { useState } from "react";

export interface HeatmapModule {
  violationCount: number;
  errorCount: number;
  warningCount: number;
  files: string[];
}

export interface HeatmapGridProps {
  heatmap: Record<string, HeatmapModule>;
}

function getHeatColor(violationCount: number, maxViolations: number): string {
  if (maxViolations === 0) return "#1e293b";
  const intensity = Math.min(violationCount / maxViolations, 1);
  const r = Math.round(30 + intensity * 209);
  const g = Math.round(41 - intensity * 20);
  const b = Math.round(59 - intensity * 30);
  return `rgb(${r}, ${g}, ${b})`;
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({ heatmap }) => {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const modules = Object.entries(heatmap);
  const maxViolations = Math.max(...modules.map(([, m]) => m.violationCount), 1);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "8px",
        }}
      >
        {modules.map(([name, module]) => (
          <button
            key={name}
            onClick={() =>
              setSelectedModule(selectedModule === name ? null : name)
            }
            style={{
              padding: "12px 8px",
              backgroundColor: getHeatColor(module.violationCount, maxViolations),
              border: selectedModule === name ? "2px solid #3b82f6" : "1px solid #334155",
              borderRadius: "6px",
              cursor: "pointer",
              textAlign: "center",
              color: "#e2e8f0",
              fontSize: "0.75rem",
              transition: "background-color 0.3s",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>{name}</div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>
              {module.violationCount} violations
            </div>
          </button>
        ))}
      </div>

      {selectedModule && heatmap[selectedModule] && (
        <ViolationPanel
          moduleName={selectedModule}
          module={heatmap[selectedModule]}
          onClose={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
};

interface ViolationPanelProps {
  moduleName: string;
  module: HeatmapModule;
  onClose: () => void;
}

const ViolationPanel: React.FC<ViolationPanelProps> = ({
  moduleName,
  module,
  onClose,
}) => {
  return (
    <div
      style={{
        marginTop: "16px",
        padding: "16px",
        backgroundColor: "#1e293b",
        borderRadius: "8px",
        border: "1px solid #334155",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.9rem", color: "#e2e8f0" }}>
          {moduleName}
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: "1.2rem",
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
        <span style={{ color: "#ef4444", fontSize: "0.8rem" }}>
          Errors: {module.errorCount}
        </span>
        <span style={{ color: "#f97316", fontSize: "0.8rem" }}>
          Warnings: {module.warningCount}
        </span>
        <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
          Total: {module.violationCount}
        </span>
      </div>

      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
        <strong>Files:</strong>
        <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
          {module.files.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
