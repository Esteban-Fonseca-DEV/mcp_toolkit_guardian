import React, { useEffect, useState } from "react";
import { useSSE } from "./hooks/useSSE";
import { ConnectionIndicator } from "./components/ConnectionIndicator";
import { HealthGauge } from "./components/HealthGauge";
import { RadarChart } from "./components/RadarChart";
import { HeatmapGrid, HeatmapModule } from "./components/HeatmapGrid";

interface DashboardData {
  healthScore: number;
  totalFiles: number;
  totalLines: number;
  violations: { errors: number; warnings: number };
  byAgent: Record<string, { errors: number; warnings: number }>;
  radarData: Record<string, number>;
  heatmap: Record<string, HeatmapModule>;
  lastUpdated: string;
}

interface AnalysisCompleteEvent {
  report: unknown;
  healthScore: number;
  radarData: Record<string, number>;
  timestamp: string;
  heatmap?: Record<string, HeatmapModule>;
}

export const App: React.FC = () => {
  const { data: sseEvent, connected } = useSSE<AnalysisCompleteEvent>({
    url: "/api/events",
  });

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  // Fetch initial data on mount
  useEffect(() => {
    fetch("/api/dashboard-data")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data: DashboardData | null) => {
        if (data) setDashboardData(data);
      })
      .catch(() => {
        // Server might not have data yet
      });
  }, []);

  // Update dashboard data when SSE event arrives
  useEffect(() => {
    if (sseEvent) {
      // Re-fetch full dashboard data when an event arrives
      fetch("/api/dashboard-data")
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data: DashboardData | null) => {
          if (data) setDashboardData(data);
        })
        .catch(() => {
          // Fallback: use SSE event data directly
          setDashboardData((prev) => ({
            healthScore: sseEvent.healthScore,
            totalFiles: prev?.totalFiles ?? 0,
            totalLines: prev?.totalLines ?? 0,
            violations: prev?.violations ?? { errors: 0, warnings: 0 },
            byAgent: prev?.byAgent ?? {},
            radarData: sseEvent.radarData,
            heatmap: sseEvent.heatmap ?? prev?.heatmap ?? {},
            lastUpdated: sseEvent.timestamp,
          }));
        });
    }
  }, [sseEvent]);

  const healthScore = dashboardData?.healthScore ?? 0;
  const radarData = dashboardData?.radarData ?? {};
  const heatmap = dashboardData?.heatmap ?? {};

  return (
    <div style={styles.container}>
      <ConnectionIndicator connected={connected} />

      <header style={styles.header}>
        <h1 style={styles.title}>Guardian Dashboard</h1>
        <p style={styles.subtitle}>Real-time architecture quality metrics</p>
      </header>

      {!dashboardData ? (
        <main style={styles.empty}>
          <p style={{ color: "#64748b", fontSize: "1rem" }}>
            Waiting for analysis data...
          </p>
          <p style={{ color: "#475569", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Run <code style={{ color: "#3b82f6" }}>guardian watch</code> or{" "}
            <code style={{ color: "#3b82f6" }}>guardian dashboard</code> to see
            live results.
          </p>
        </main>
      ) : (
        <main style={styles.main}>
          {/* Top row: Health gauge + Radar chart */}
          <section style={styles.topRow}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Health Score</h2>
              <div style={styles.gaugeWrapper}>
                <HealthGauge score={healthScore} />
              </div>
              <div style={styles.stats}>
                <span style={{ color: "#ef4444" }}>
                  {dashboardData.violations.errors} errors
                </span>
                <span style={{ color: "#f97316" }}>
                  {dashboardData.violations.warnings} warnings
                </span>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Agent Compliance</h2>
              <div style={styles.radarWrapper}>
                <RadarChart data={radarData} />
              </div>
            </div>
          </section>

          {/* Bottom row: Heatmap */}
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Module Heatmap</h2>
            <HeatmapGrid heatmap={heatmap} />
          </section>

          {/* Footer info */}
          <footer style={styles.footer}>
            <span>
              Last updated:{" "}
              {new Date(dashboardData.lastUpdated).toLocaleTimeString()}
            </span>
            <span>
              {dashboardData.totalFiles} files analyzed
            </span>
          </footer>
        </main>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    padding: "2rem",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    marginBottom: "2rem",
    paddingTop: "1rem",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: 0,
    color: "#f1f5f9",
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: "0.25rem",
    fontSize: "0.9rem",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    maxWidth: "1280px",
    margin: "0 auto",
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "1.5rem",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    border: "1px solid #334155",
    padding: "1.5rem",
  },
  cardTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginTop: 0,
    marginBottom: "1rem",
  },
  gaugeWrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "1rem 0",
  },
  radarWrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "1.5rem",
    fontSize: "0.85rem",
    marginTop: "0.5rem",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#64748b",
    fontSize: "0.75rem",
    padding: "1rem 0",
    borderTop: "1px solid #1e293b",
  },
};
