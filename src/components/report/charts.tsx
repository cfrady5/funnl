"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GREEN = "#22C55E";
const BLUE = "#3B82F6";
const AMBER = "#F59E0B";
const RED = "#EF4444";

const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

function ChartFrame({ children, height = 280 }: { children: React.ReactElement; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: 12,
};

/** CTR by ad group with a low-CTR threshold reference (color-coded bars). */
export function CtrByAdGroupChart({
  data,
}: {
  data: Array<{ name: string; ctr: number; impressions: number }>;
}) {
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
        <YAxis {...axisProps} tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name) =>
            name === "ctr" ? [`${(value * 100).toFixed(2)}%`, "CTR"] : [value, name]
          }
        />
        <Bar dataKey="ctr" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.ctr < 0.02 ? RED : d.ctr < 0.03 ? AMBER : GREEN} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** Spend vs conversions per ad group. */
export function SpendVsConversionsChart({
  data,
}: {
  data: Array<{ name: string; spend: number; conversions: number }>;
}) {
  return (
    <ChartFrame>
      <ComposedChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
        <YAxis yAxisId="left" {...axisProps} tickFormatter={(v: number) => `$${v}`} />
        <YAxis yAxisId="right" orientation="right" {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="spend" name="Spend ($)" fill={BLUE} radius={[6, 6, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversions" stroke={GREEN} strokeWidth={3} dot={{ r: 4 }} />
      </ComposedChart>
    </ChartFrame>
  );
}

/** Score bars for the 6 readiness dimensions. */
export function ScoreBarsChart({ data }: { data: Array<{ name: string; score: number; invert?: boolean }> }) {
  const color = (score: number, invert?: boolean) => {
    const s = invert ? 100 - score : score;
    return s >= 75 ? GREEN : s >= 50 ? AMBER : RED;
  };
  return (
    <ChartFrame height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" domain={[0, 100]} {...axisProps} />
        <YAxis type="category" dataKey="name" {...axisProps} width={120} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}/100`, "Score"]} />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={color(d.score, d.invert)} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
