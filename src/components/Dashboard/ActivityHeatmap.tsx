import React, { useState } from "react";
import { Activity } from "lucide-react";
import { DemoDataNotice } from "../DemoDataNotice";

interface ActivityPoint {
  time: string;
  load: number;
}

const mockData: ActivityPoint[] = [
  { time: "00:00", load: 20 },
  { time: "02:00", load: 35 },
  { time: "04:00", load: 15 },
  { time: "06:00", load: 45 },
  { time: "08:00", load: 80 },
  { time: "10:00", load: 65 },
  { time: "12:00", load: 95 },
  { time: "14:00", load: 85 },
  { time: "16:00", load: 110 },
  { time: "18:00", load: 75 },
  { time: "20:00", load: 50 },
  { time: "22:00", load: 30 },
];

export const ActivityHeatmap: React.FC = () => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxLoad = 120;
  const svgWidth = 500;
  const svgHeight = 180;
  const paddingX = 35;
  const paddingY = 25;

  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = mockData.map((d, i) => {
    const x = paddingX + (i / (mockData.length - 1)) * chartWidth;
    const y = paddingY + chartHeight - (d.load / maxLoad) * chartHeight;
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingY + chartHeight} L ${points[0].x} ${paddingY + chartHeight} Z`;

  return (
      <div className="bg-[#0B1221] border border-slate-800 p-5 rounded-2xl flex flex-col w-full h-full min-h-[300px] shadow-xl">
        <DemoDataNotice />
        <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-slate-200 font-bold text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            Intensidad de Carga Cognitiva
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Volumen de interacción y demanda sináptica en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>{" "}
            Alta carga
          </span>
          <span className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Base
          </span>
        </div>
      </div>

      <div className="flex-1 w-full flex items-center justify-center relative min-h-[190px]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="65%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingY + chartHeight * (1 - ratio);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {Math.round(ratio * maxLoad)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Data Points */}
          {points.map((p, i) => (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === i ? 6 : 3.5}
                fill="#0B1221"
                stroke={p.data.load > 70 ? "#f59e0b" : "#38bdf8"}
                strokeWidth={hoveredIdx === i ? 2.5 : 2}
                className="transition-all duration-200"
              />
              <text
                x={p.x}
                y={paddingY + chartHeight + 16}
                textAnchor="middle"
                fill="#64748b"
                fontSize="9"
                fontFamily="monospace"
              >
                {p.data.time}
              </text>
            </g>
          ))}
        </svg>

        {hoveredIdx !== null && (
          <div
            className="absolute -top-2 rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white shadow-2xl pointer-events-none transition-all"
            style={{
              left: `${(points[hoveredIdx].x / svgWidth) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-mono text-[10px] text-slate-400">
              {mockData[hoveredIdx].time}
            </div>
            <div className="font-bold text-amber-300">
              Carga: {mockData[hoveredIdx].load} ops/s
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
