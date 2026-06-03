"use client";

import {
  Activity,
  Bot,
  Clock,
  FileWarning,
  MousePointerClick,
  UploadCloud,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AuditCountSlice,
  AuditDashboardSummary,
  AuditRange,
} from "@/lib/audit/summary";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type AuditDashboardProps = {
  summary: AuditDashboardSummary;
  range: AuditRange;
};

const RANGE_OPTIONS: Array<{ label: string; value: AuditRange }> = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" },
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--accent)",
  "var(--primary)",
  "var(--secondary)",
];

const barConfig = {
  value: {
    label: "Count",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

function numberLabel(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function secondsLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0s";
  }

  return `${Math.round(value / 1000)}s`;
}

function chartConfigFor(data: AuditCountSlice[]) {
  return data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});
}

function normalizePieData(data: AuditCountSlice[]) {
  return data.map((item, index) => ({
    ...item,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Activity;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardAction>
          <Icon className="text-muted-foreground" data-icon="inline-start" />
        </CardAction>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">
          {numberLabel(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      No data
    </div>
  );
}

function PieMetricCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: AuditCountSlice[];
}) {
  const normalized = normalizePieData(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {normalized.length ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-center">
            <ChartContainer
              config={chartConfigFor(data)}
              className="mx-auto aspect-square w-full max-w-[260px]"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel nameKey="name" />}
                />
                <Pie data={normalized} dataKey="value" nameKey="name">
                  {normalized.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2">
              {normalized.slice(0, 6).map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {numberLabel(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyChart />
        )}
      </CardContent>
    </Card>
  );
}

function BarMetricCard({
  title,
  description,
  data,
  valueFormatter = numberLabel,
}: {
  title: string;
  description: string;
  data: Array<{ name: string; value: number }>;
  valueFormatter?: (value: number) => string;
}) {
  const limited = data.slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {limited.length ? (
          <ChartContainer config={barConfig} className="h-[260px] w-full">
            <BarChart data={limited} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                width={132}
              />
              <XAxis type="number" hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => (
                      <div className="flex min-w-36 items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {String(name)}
                        </span>
                        <span className="font-mono font-medium">
                          {valueFormatter(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="value" fill="var(--primary)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <EmptyChart />
        )}
      </CardContent>
    </Card>
  );
}

function RangeNav({ range }: { range: AuditRange }) {
  return (
    <div className="flex rounded-md bg-muted p-1">
      {RANGE_OPTIONS.map((option) => (
        <a
          key={option.value}
          href={`/ops/audit?range=${option.value}`}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm font-medium transition",
            range === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </a>
      ))}
    </div>
  );
}

function LatestEventsTable({ summary }: { summary: AuditDashboardSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest events</CardTitle>
        <CardDescription>
          Most recent tracked application events in the selected range.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.latestEvents.length ? (
              summary.latestEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{dateTimeLabel(event.eventTime)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.applicationId}
                  </TableCell>
                  <TableCell>{event.eventType}</TableCell>
                  <TableCell>{event.pageName ?? "Unknown"}</TableCell>
                  <TableCell>{event.actionName ?? "Unknown"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.eventStatus === "FAIL" ? "destructive" : "outline"
                      }
                    >
                      {event.eventStatus ?? "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.requestId ?? "Unknown"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center">
                  No events in this range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AuditDashboard({ summary, range }: AuditDashboardProps) {
  const durationData = summary.behavior.pageDurationMs.map((item) => ({
    name: item.pageName,
    value: item.averageMs,
  }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-6">
        <header className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                Audit dashboard
              </h1>
              <Badge variant={summary.isAvailable ? "secondary" : "outline"}>
                {summary.isAvailable ? "Live data" : "Memory mode"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Generated {dateTimeLabel(summary.generatedAt)}. Read-only
              operational view for tracking, uploads, review runs, and AI usage.
            </p>
          </div>
          <RangeNav range={range} />
        </header>

        {!summary.isAvailable ? (
          <Card>
            <CardHeader>
              <CardTitle>Database summary unavailable</CardTitle>
              <CardDescription>
                The app is not running in Prisma mode, so the audit dashboard is
                showing an empty state.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Applications"
            value={summary.totals.applications}
            hint="All known applications"
            icon={Users}
          />
          <StatCard
            label="Tracked events"
            value={summary.totals.applicationEventLogs}
            hint="Events in selected range"
            icon={Activity}
          />
          <StatCard
            label="Uploads"
            value={summary.totals.fileUploadAttempts}
            hint="Upload attempts in range"
            icon={UploadCloud}
          />
          <StatCard
            label="Ask AI messages"
            value={summary.totals.askAiChatMessages}
            hint="AI messages in range"
            icon={Bot}
          />
        </section>

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="uploads">Uploads</TabsTrigger>
            <TabsTrigger value="reviews">Reviews & AI</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-4">
            <section className="grid gap-4 xl:grid-cols-3">
              <PieMetricCard
                title="Invite access"
                description="Invitation link access results."
                data={summary.distributions.inviteAccessResult}
              />
              <PieMetricCard
                title="Application status"
                description="Current status across all applications."
                data={summary.distributions.applicationStatus}
              />
              <PieMetricCard
                title="Review run status"
                description="Material review run status in range."
                data={summary.distributions.materialReviewRunStatus}
              />
            </section>
            <Card>
              <CardHeader>
                <CardTitle>Application funnel</CardTitle>
                <CardDescription>
                  Milestone timestamps stored on application records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {summary.milestones.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-md border bg-muted/35 px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-xl font-semibold tabular-nums">
                        {numberLabel(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="grid gap-4 xl:grid-cols-2">
            <BarMetricCard
              title="Page views"
              description="Tracked page_view events by page."
              data={summary.behavior.pages}
            />
            <BarMetricCard
              title="Average duration"
              description="Average page_duration by page."
              data={durationData}
              valueFormatter={secondsLabel}
            />
            <BarMetricCard
              title="Actions"
              description="Action categories in tracked events."
              data={summary.behavior.actions}
            />
            <BarMetricCard
              title="Top event types"
              description="Most common event_type values."
              data={summary.behavior.eventTypes}
            />
          </TabsContent>

          <TabsContent value="uploads" className="grid gap-4 xl:grid-cols-2">
            <PieMetricCard
              title="Upload kind"
              description="Resume vs material upload attempts."
              data={summary.distributions.uploadKind}
            />
            <PieMetricCard
              title="Upload failure stage"
              description="Failure location for failed upload attempts."
              data={summary.distributions.uploadFailureStage}
            />
            <BarMetricCard
              title="Upload categories"
              description="Material categories attached to upload attempts."
              data={summary.uploads.categories}
            />
            <Card>
              <CardHeader>
                <CardTitle>Recent upload failures</CardTitle>
                <CardDescription>
                  Latest failed upload attempts in the selected range.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {summary.uploads.recentFailures.length ? (
                    summary.uploads.recentFailures.map((failure) => (
                      <div
                        key={failure.id}
                        className="rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">
                            {failure.fileName}
                          </p>
                          <Badge variant="destructive">
                            {failure.failureStage ?? "Unknown"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {failure.kind} / {failure.category ?? "No category"} /
                          {failure.failureCode ?? "No code"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      No upload failures in this range.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="grid gap-4 xl:grid-cols-3">
            <PieMetricCard
              title="Category review status"
              description="Per-category material review state."
              data={summary.distributions.materialCategoryReviewStatus}
            />
            <PieMetricCard
              title="Supplement requests"
              description="Supplement request status in range."
              data={summary.distributions.supplementRequestStatus}
            />
            <PieMetricCard
              title="Ask AI feedback"
              description="User feedback ratings for AI messages."
              data={summary.distributions.askAiFeedbackRating}
            />
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Review and AI totals</CardTitle>
                <CardDescription>
                  Counts from material review and Ask AI trace tables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  <MiniMetric
                    icon={FileWarning}
                    label="Review runs"
                    value={summary.totals.materialReviewRuns}
                  />
                  <MiniMetric
                    icon={Activity}
                    label="Category reviews"
                    value={summary.totals.materialCategoryReviews}
                  />
                  <MiniMetric
                    icon={UploadCloud}
                    label="Supplement requests"
                    value={summary.totals.supplementRequests}
                  />
                  <MiniMetric
                    icon={Bot}
                    label="AI sessions"
                    value={summary.totals.askAiChatSessions}
                  />
                  <MiniMetric
                    icon={MousePointerClick}
                    label="AI feedback"
                    value={summary.totals.askAiMessageFeedback}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <LatestEventsTable summary={summary} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <Icon className="text-muted-foreground" data-icon="inline-start" />
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">
          {numberLabel(value)}
        </p>
      </div>
    </div>
  );
}
