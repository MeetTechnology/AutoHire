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
  { label: "近 7 天", value: "7d" },
  { label: "近 30 天", value: "30d" },
  { label: "全部", value: "all" },
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
    label: "数量",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

const DISPLAY_LABELS: Record<string, string> = {
  analysis_result: "分析结果",
  analysis_result_duration_recorded: "分析结果停留已记录",
  analysis_result_viewed: "查看分析结果",
  APPLICATION_CREATED: "申请已创建",
  application_submitted: "申请已提交",
  ANALYSIS_COMPLETED: "分析完成",
  analysis_completed: "分析完成",
  ANALYSIS_FAILED: "分析失败",
  analysis_failed: "分析失败",
  ANALYSIS_STARTED: "开始分析",
  analysis_started: "开始分析",
  APPROVED: "已通过",
  ASK_AI_FEEDBACK: "AI 反馈",
  ASK_AI_MESSAGE: "AI 消息",
  ask_ai_feedback: "AI 反馈",
  ask_ai_message: "AI 消息",
  apply: "申请入口",
  apply_entry: "申请入口",
  apply_materials: "材料上传页",
  apply_result: "分析结果页",
  apply_resume: "简历上传页",
  apply_submission_complete: "提交完成页",
  apply_supplement: "补充材料页",
  apply_supplement_history: "补充材料历史页",
  button_click: "按钮点击",
  COMPLETED: "已完成",
  CONFIRMED: "已确认",
  confirm: "确认",
  CONFIRM: "确认",
  CV_REVIEW: "简历审核",
  DISABLED: "已禁用",
  ELIGIBLE: "符合条件",
  EXPIRED: "已过期",
  feedback: "反馈",
  feedback_viewed: "查看提交反馈",
  FAIL: "失败",
  FAILED: "失败",
  file_upload: "文件上传",
  history_only: "仅历史记录",
  HISTORY_ONLY: "仅历史记录",
  intro: "引导页",
  INTRO: "引导页",
  intro_page_duration_recorded: "引导页停留已记录",
  intro_page_viewed: "查看引导页",
  intro_viewed: "查看引导页",
  INTRO_VIEWED: "查看引导页",
  info_required: "信息待补充",
  INFO_REQUIRED: "信息待补充",
  INELIGIBLE: "不符合条件",
  intent: "创建上传意图",
  INTENT: "创建上传意图",
  intent_create: "创建上传意图",
  invite_access: "邀请访问",
  invite_link_disabled: "邀请链接已禁用",
  invite_link_expired: "邀请链接已过期",
  invite_link_invalid: "邀请链接无效",
  invite_link_opened: "打开邀请链接",
  INVALID: "无效",
  material: "材料",
  MATERIAL: "材料",
  material_upload_confirmed: "材料上传已确认",
  material_upload_failed: "材料上传失败",
  material_upload_intent_created: "材料上传意图已创建",
  material_upload_started: "材料上传已开始",
  MATERIALS: "材料",
  MATERIALS_ENTERED: "进入材料页",
  materials: "材料",
  MATERIALS_IN_PROGRESS: "材料上传中",
  materials_page_duration_recorded: "材料页停留已记录",
  materials_page_viewed: "查看材料页",
  NEEDS_REVIEW: "需要复核",
  NO_SUPPLEMENT_REQUIRED: "无需补充材料",
  page_duration: "页面停留",
  page_view: "页面浏览",
  PARTIALLY_SATISFIED: "部分满足",
  PENDING: "待处理",
  PROCESSING: "处理中",
  put: "上传文件",
  PUT: "上传文件",
  REJECTED: "已拒绝",
  resume: "简历",
  RESUME: "简历",
  resume_extraction: "简历信息提取",
  resume_page_duration_recorded: "简历页停留已记录",
  resume_page_viewed: "查看简历页",
  resume_upload: "简历上传",
  resume_upload_confirmed: "简历上传已确认",
  resume_upload_failed: "简历上传失败",
  resume_upload_intent_created: "简历上传意图已创建",
  resume_upload_started: "简历上传已开始",
  RESUME_UPLOADED: "简历已上传",
  REVIEWING: "审核中",
  secondary_analysis: "二次分析",
  session_restored: "会话已恢复",
  SESSION_RESTORE: "会话恢复",
  SKIPPED: "已跳过",
  start_apply_clicked: "点击开始申请",
  satisfied: "已满足",
  SATISFIED: "已满足",
  submit: "提交",
  submit_clicked: "点击提交",
  submit_confirm: "确认提交",
  submission_complete_duration_recorded: "提交完成页停留已记录",
  SUCCESS: "成功",
  SUBMITTED: "已提交",
  supplemental: "补充信息",
  supplement: "补充材料",
  supplement_page_duration_recorded: "补充材料页停留已记录",
  supplement_history: "补充材料历史",
  supplement_history_duration_recorded: "补充材料历史页停留已记录",
  supplement_history_page_viewed: "查看补充材料历史",
  supplement_page_viewed: "查看补充材料页",
  SUPPLEMENT_REQUIRED: "需补充材料",
  upload_confirm: "确认上传",
  upload_fail: "上传失败",
  upload_start: "开始上传",
  VALID: "有效",
  UNKNOWN: "未知",
};

function numberLabel(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
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

export function displayLabel(value: string | null | undefined, fallback = "未知") {
  if (!value) {
    return fallback;
  }

  const normalized = normalizeLabelKey(value);

  return (
    DISPLAY_LABELS[value] ??
    DISPLAY_LABELS[normalized] ??
    DISPLAY_LABELS[value.toUpperCase()] ??
    DISPLAY_LABELS[normalized.toUpperCase()] ??
    value.replaceAll("_", " ")
  );
}

function normalizeLabelKey(value: string) {
  const normalized = value
    .trim()
    .replace(/^\/+/, "")
    .replaceAll("/", "_")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();

  return normalized
    .replace("durationrecorded", "duration_recorded")
    .replace("completeduration", "complete_duration")
    .replace("historyonly", "history_only")
    .replace("submissioncomplete", "submission_complete")
    .replace("submission_completed", "submission_complete")
    .replace("submission_completeuration", "submission_complete_duration");
}

export function displaySlices(data: AuditCountSlice[]) {
  return Array.from(
    data
      .reduce<Map<string, AuditCountSlice>>((acc, item) => {
        const name = displayLabel(item.name);
        const existing = acc.get(name);

        acc.set(name, {
          name,
          value: (existing?.value ?? 0) + item.value,
        });

        return acc;
      }, new Map())
      .values(),
  ).sort((left, right) => right.value - left.value);
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
      暂无数据
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
        <CardTitle>最新事件</CardTitle>
        <CardDescription>
          当前时间范围内最近记录的申请流程事件。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>申请</TableHead>
              <TableHead>事件</TableHead>
              <TableHead>页面</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>请求</TableHead>
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
                  <TableCell>{displayLabel(event.eventType)}</TableCell>
                  <TableCell>{displayLabel(event.pageName)}</TableCell>
                  <TableCell>{displayLabel(event.actionName)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.eventStatus === "FAIL" ? "destructive" : "outline"
                        }
                    >
                      {displayLabel(event.eventStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.requestId ?? "未知"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center">
                  当前时间范围内暂无事件。
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
    name: displayLabel(item.pageName),
    value: item.averageMs,
  }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-6">
        <header className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                审计仪表板
              </h1>
              <Badge variant={summary.isAvailable ? "secondary" : "outline"}>
                {summary.isAvailable ? "实时数据" : "内存模式"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              生成时间 {dateTimeLabel(summary.generatedAt)}。用于查看埋点、上传、材料审核和 AI 使用情况的只读运维视图。
            </p>
          </div>
          <RangeNav range={range} />
        </header>

        {!summary.isAvailable ? (
          <Card>
            <CardHeader>
              <CardTitle>数据库统计不可用</CardTitle>
              <CardDescription>
                当前应用未运行在 Prisma 模式下，因此审计仪表板显示为空状态。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="申请总数"
            value={summary.totals.applications}
            hint="当前数据库中的申请记录"
            icon={Users}
          />
          <StatCard
            label="埋点事件"
            value={summary.totals.applicationEventLogs}
            hint="所选时间范围内的事件"
            icon={Activity}
          />
          <StatCard
            label="上传次数"
            value={summary.totals.fileUploadAttempts}
            hint="所选时间范围内的上传尝试"
            icon={UploadCloud}
          />
          <StatCard
            label="AI 问答消息"
            value={summary.totals.askAiChatMessages}
            hint="所选时间范围内的 AI 消息"
            icon={Bot}
          />
        </section>

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="behavior">访问行为</TabsTrigger>
            <TabsTrigger value="uploads">上传</TabsTrigger>
            <TabsTrigger value="reviews">审核与 AI</TabsTrigger>
            <TabsTrigger value="events">事件</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid gap-4">
            <section className="grid gap-4 xl:grid-cols-3">
              <PieMetricCard
                title="邀请访问"
                description="候选人邀请链接的访问结果。"
                data={displaySlices(summary.distributions.inviteAccessResult)}
              />
              <PieMetricCard
                title="申请状态"
                description="所有申请记录的当前状态分布。"
                data={displaySlices(summary.distributions.applicationStatus)}
              />
              <PieMetricCard
                title="材料审核任务状态"
                description="所选时间范围内材料审核任务的状态分布。"
                data={displaySlices(summary.distributions.materialReviewRunStatus)}
              />
            </section>
            <Card>
              <CardHeader>
                <CardTitle>申请漏斗</CardTitle>
                <CardDescription>
                  基于申请记录中的关键时间戳统计。
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
              title="页面浏览"
              description="按页面统计的 page_view 事件。"
              data={displaySlices(summary.behavior.pages)}
            />
            <BarMetricCard
              title="平均停留时长"
              description="按页面统计的 page_duration 平均值。"
              data={durationData}
              valueFormatter={secondsLabel}
            />
            <BarMetricCard
              title="操作行为"
              description="埋点事件中的操作类型分布。"
              data={displaySlices(summary.behavior.actions)}
            />
            <BarMetricCard
              title="高频事件类型"
              description="出现次数最多的 event_type 值。"
              data={displaySlices(summary.behavior.eventTypes)}
            />
          </TabsContent>

          <TabsContent value="uploads" className="grid gap-4 xl:grid-cols-2">
            <PieMetricCard
              title="上传类型"
              description="简历与材料上传尝试的分布。"
              data={displaySlices(summary.distributions.uploadKind)}
            />
            <PieMetricCard
              title="上传失败环节"
              description="失败上传尝试发生的位置。"
              data={displaySlices(summary.distributions.uploadFailureStage)}
            />
            <BarMetricCard
              title="上传材料类别"
              description="上传尝试关联的材料类别。"
              data={displaySlices(summary.uploads.categories)}
            />
            <Card>
              <CardHeader>
                <CardTitle>最近上传失败</CardTitle>
                <CardDescription>
                  所选时间范围内最近失败的上传尝试。
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
                            {displayLabel(failure.failureStage)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {displayLabel(failure.kind)} /{" "}
                          {displayLabel(failure.category, "无分类")} /{" "}
                          {failure.failureCode ?? "无错误码"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      当前时间范围内暂无上传失败。
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="grid gap-4 xl:grid-cols-3">
            <PieMetricCard
              title="分类审核状态"
              description="按材料类别记录的审核状态。"
              data={displaySlices(summary.distributions.materialCategoryReviewStatus)}
            />
            <PieMetricCard
              title="补充材料请求"
              description="所选时间范围内补充材料请求的状态分布。"
              data={displaySlices(summary.distributions.supplementRequestStatus)}
            />
            <PieMetricCard
              title="AI 问答反馈"
              description="用户对 AI 消息的反馈评分。"
              data={displaySlices(summary.distributions.askAiFeedbackRating)}
            />
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>审核与 AI 总量</CardTitle>
                <CardDescription>
                  来自材料审核与 Ask AI 追踪表的统计数量。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  <MiniMetric
                    icon={FileWarning}
                    label="审核任务"
                    value={summary.totals.materialReviewRuns}
                  />
                  <MiniMetric
                    icon={Activity}
                    label="分类审核"
                    value={summary.totals.materialCategoryReviews}
                  />
                  <MiniMetric
                    icon={UploadCloud}
                    label="补充请求"
                    value={summary.totals.supplementRequests}
                  />
                  <MiniMetric
                    icon={Bot}
                    label="AI 会话"
                    value={summary.totals.askAiChatSessions}
                  />
                  <MiniMetric
                    icon={MousePointerClick}
                    label="AI 反馈"
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
