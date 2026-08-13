"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Charts read their colours from the same CSS custom properties as the rest of
 * the UI, so they re-theme with the page instead of hard-coding a palette.
 */

const AXIS = {
  stroke: "var(--text-muted)",
  fontSize: 11,
};

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--text-primary)",
  boxShadow: "6px 6px 16px var(--shadow-dark), -6px -6px 16px var(--shadow-light)",
};

export function EnrollmentsByCategoryChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-[var(--text-muted)]">
        No enrollment data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={62}
          outerRadius={100}
          paddingAngle={3}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          verticalAlign="bottom"
          height={36}
          wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CompletionByDepartmentChart({
  data,
}: {
  data: { department: string; completed: number; inProgress: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-[var(--text-muted)]">
        No department data yet. Set departments on user profiles to populate this.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-subtle)"
          vertical={false}
        />
        <XAxis
          dataKey="department"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-18}
          textAnchor="end"
          height={56}
        />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-sunken)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
        <Bar
          dataKey="completed"
          name="Completed"
          fill="var(--success)"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          dataKey="inProgress"
          name="In progress"
          fill="var(--accent)"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopCoursesChart({
  data,
}: {
  data: { name: string; enrollments: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-[var(--text-muted)]">
        No courses yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 42)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-subtle)"
          horizontal={false}
        />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={150}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-sunken)" }} />
        <Bar
          dataKey="enrollments"
          name="Enrollments"
          fill="var(--accent)"
          radius={[0, 6, 6, 0]}
          maxBarSize={26}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
