import React from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export interface RadarChartProps {
  data: Record<string, number>;
}

export const RadarChart: React.FC<RadarChartProps> = ({ data }) => {
  const labels = Object.keys(data);
  const values = Object.values(data);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Compliance %",
        data: values,
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(59, 130, 246, 1)",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    animation: {
      duration: 500,
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          color: "#94a3b8",
        },
        grid: {
          color: "#334155",
        },
        angleLines: {
          color: "#334155",
        },
        pointLabels: {
          color: "#e2e8f0",
          font: { size: 11 },
        },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  return (
    <div style={{ width: "300px", height: "300px" }}>
      <Radar data={chartData} options={options} />
    </div>
  );
};
