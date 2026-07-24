import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export interface HealthGaugeProps {
  score: number;
}

function getColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({ score }) => {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = getColor(clampedScore);

  const data = {
    datasets: [
      {
        data: [clampedScore, 100 - clampedScore],
        backgroundColor: [color, "#1e293b"],
        borderWidth: 0,
        circumference: 270,
        rotation: 225,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "75%",
    animation: {
      duration: 500,
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  };

  return (
    <div style={{ position: "relative", width: "200px", height: "200px" }}>
      <Doughnut data={data} options={options} />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "2rem", fontWeight: 700, color }}>
          {clampedScore}
        </span>
        <br />
        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
          Health Score
        </span>
      </div>
    </div>
  );
};
