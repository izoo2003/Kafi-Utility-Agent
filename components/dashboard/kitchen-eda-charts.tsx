"use client";

import {
  Area,
  AreaChart,
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
import type { KitchenEdaAnalytics } from "@/lib/kitchen/eda-analytics";
import { Badge } from "@/components/ui/badge";

const IN = "#059669";
const OUT = "#e11d48";
const OK = "#78716c";
const LOW = "#d97706";
const EMPTY = "#dc2626";

const HEALTH_COLOR: Record<string, string> = {
  out: EMPTY,
  low: LOW,
  ok: OK,
  watch: "#ca8a04",
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="h-56 w-full sm:h-64">{children}</div>
    </div>
  );
}

function severityBadge(severity: "critical" | "warning" | "info") {
  if (severity === "critical") return "destructive" as const;
  if (severity === "warning") return "outline" as const;
  return "secondary" as const;
}

export function KitchenEdaCharts({ data }: { data: KitchenEdaAnalytics }) {
  const healthPie = data.stock_health.filter((s) => s.count > 0);
  const categoryData = data.category_mix.slice(0, 8);

  return (
    <div className="space-y-4">
      {data.alerts.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.alerts.map((a) => (
            <div
              key={`${a.severity}-${a.title}`}
              className={
                a.severity === "critical"
                  ? "rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-3"
                  : a.severity === "warning"
                    ? "rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3"
                    : "rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-3"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-stone-900">{a.title}</p>
                <Badge variant={severityBadge(a.severity)}>{a.severity}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-stone-700">
                {a.detail}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Avg daily Out"
          value={String(data.kpis.avg_daily_out)}
          hint="On days with Out activity"
        />
        <Kpi
          label="Peak Out day"
          value={
            data.kpis.peak_out_day
              ? `${data.kpis.peak_out_qty}`
              : "—"
          }
          hint={data.kpis.peak_out_day ?? "No Out yet"}
        />
        <Kpi
          label="Restock coverage"
          value={
            data.kpis.restock_coverage_pct == null
              ? "—"
              : `${data.kpis.restock_coverage_pct}%`
          }
          hint="In ÷ Out this month"
        />
        <Kpi
          label="Active days"
          value={String(data.kpis.days_with_activity)}
          hint="Days with In or Out"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Daily In vs Out"
          subtitle="Time series — spikes and quiet days"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily_flow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.date ?? ""
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="in_qty"
                name="In"
                stroke={IN}
                fill={IN}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="out_qty"
                name="Out"
                stroke={OUT}
                fill={OUT}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top items by Out"
          subtitle="What drove consumption this month"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.top_out_items}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="short"
                width={88}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value, name, item) => {
                  const unit = item?.payload?.unit
                    ? ` ${item.payload.unit}`
                    : "";
                  return [`${value}${unit}`, name === "out" ? "Out" : "In"];
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.name ?? ""
                }
              />
              <Bar dataKey="out" name="Out" fill={OUT} radius={[0, 4, 4, 0]} />
              <Bar dataKey="in" name="In" fill={IN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="6-month trend"
          subtitle="Month-over-month In / Out totals"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.month_trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="in" name="In" fill={IN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="out" name="Out" fill={OUT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <ChartCard
            title="Stock health"
            subtitle="Current inventory status mix"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthPie}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {healthPie.map((s) => (
                    <Cell
                      key={s.status}
                      fill={HEALTH_COLOR[s.status] ?? OK}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Out by category"
            subtitle="Where usage concentrates"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fontSize: 11 }} width={32} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="out" name="Out" fill={OUT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
