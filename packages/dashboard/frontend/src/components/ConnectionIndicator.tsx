import React from "react";

export interface ConnectionIndicatorProps {
  connected: boolean;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  connected,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        backgroundColor: "#0f172a",
        borderRadius: "20px",
        border: "1px solid #334155",
        fontSize: "0.75rem",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: connected ? "#22c55e" : "#ef4444",
          boxShadow: connected
            ? "0 0 6px #22c55e"
            : "0 0 6px #ef4444",
        }}
      />
      <span style={{ color: connected ? "#22c55e" : "#ef4444" }}>
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
};
