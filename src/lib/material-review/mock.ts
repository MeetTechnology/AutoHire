import {
  isSupplementCategory,
  SUPPORTED_SUPPLEMENT_CATEGORIES,
} from "@/features/material-supplement/constants";
import { getEnv } from "@/lib/env";
import {
  buildSatisfiedCategoryResult,
  buildSupplementRequiredCategoryResult,
} from "@/lib/material-review/fixtures";
import {
  MATERIAL_REVIEW_MOCK_SCENARIOS,
  MaterialReviewClientError,
  type CreateCategoryMaterialReviewInput,
  type CreateInitialMaterialReviewInput,
  type CreateMaterialReviewResponse,
  type GetMaterialReviewResultInput,
  type GetMaterialReviewResultResponse,
  type MaterialCategoryReviewResult,
  type MaterialReviewJobStatus,
  type MaterialReviewMockScenario,
} from "@/lib/material-review/types";

const INITIAL_RUN_PREFIX = "mock-material-review:initial:";
const CATEGORY_RUN_PREFIX = "mock-material-review:category:";

function createTimestamp() {
  return new Date().toISOString();
}

function createScenarioError(scenario: string) {
  return new MaterialReviewClientError({
    message: `Invalid mock material review scenario: ${scenario}.`,
    failureCode: "RESULT_INVALID",
    httpStatus: 400,
  });
}

function isMockScenario(value: unknown): value is MaterialReviewMockScenario {
  return (
    typeof value === "string" &&
    MATERIAL_REVIEW_MOCK_SCENARIOS.includes(value as MaterialReviewMockScenario)
  );
}

function assertMockScenario(value: unknown): MaterialReviewMockScenario {
  if (!isMockScenario(value)) {
    throw createScenarioError(String(value));
  }

  return value;
}

function getDefaultScenario() {
  return assertMockScenario(getEnv().MATERIAL_REVIEW_MOCK_SCENARIO);
}

function resolveScenario(
  inputScenario: MaterialReviewMockScenario | undefined,
  runIdScenario?: string | null,
) {
  if (inputScenario) {
    return assertMockScenario(inputScenario);
  }

  if (runIdScenario) {
    return assertMockScenario(runIdScenario);
  }

  return getDefaultScenario();
}

function buildRunResponse(input: {
  externalRunId: string;
  scenario: MaterialReviewMockScenario;
}): CreateMaterialReviewResponse {
  const timestamp = createTimestamp();
  const status: MaterialReviewJobStatus =
    input.scenario === "reviewing" ? "PROCESSING" : "COMPLETED";

  return {
    externalRunId: input.externalRunId,
    status,
    startedAt: timestamp,
    finishedAt: status === "COMPLETED" ? timestamp : null,
  };
}

function buildInitialRunId(scenario: MaterialReviewMockScenario) {
  return `${INITIAL_RUN_PREFIX}${scenario}:${Date.now()}`;
}

function buildCategoryRunId(
  category: MaterialCategoryReviewResult["category"],
  scenario: MaterialReviewMockScenario,
) {
  return `${CATEGORY_RUN_PREFIX}${category}:${scenario}:${Date.now()}`;
}

function parseInitialRunId(externalRunId: string) {
  if (!externalRunId.startsWith(INITIAL_RUN_PREFIX)) {
    return null;
  }

  const parts = externalRunId.slice(INITIAL_RUN_PREFIX.length).split(":");
  const scenario = parts[0];

  if (isMockScenario(scenario)) {
    return scenario;
  }

  if (parts.length > 1) {
    throw createScenarioError(scenario ?? "");
  }

  return null;
}

function parseCategoryRunId(externalRunId: string) {
  if (!externalRunId.startsWith(CATEGORY_RUN_PREFIX)) {
    return null;
  }

  const parts = externalRunId.slice(CATEGORY_RUN_PREFIX.length).split(":");
  const [category, scenario] = parts;

  if (!isSupplementCategory(category)) {
    throw new MaterialReviewClientError({
      message: `Invalid mock material review category: ${category}.`,
      failureCode: "RESULT_INVALID",
      httpStatus: 400,
    });
  }

  if (scenario && isMockScenario(scenario)) {
    return { category, scenario };
  }

  if (parts.length > 2) {
    throw createScenarioError(scenario ?? "");
  }

  return { category, scenario: null };
}

function buildInitialCategoryResults(
  scenario: MaterialReviewMockScenario,
): MaterialCategoryReviewResult[] {
  if (scenario === "reviewing") {
    return [];
  }

  if (
    scenario === "no_supplement_required" ||
    scenario === "satisfied" ||
    scenario === "category_satisfied"
  ) {
    return SUPPORTED_SUPPLEMENT_CATEGORIES.map((category) =>
      buildSatisfiedCategoryResult(category),
    );
  }

  return SUPPORTED_SUPPLEMENT_CATEGORIES.map((category) =>
    buildSupplementRequiredCategoryResult(category),
  );
}

function buildCategoryReviewResult(
  category: MaterialCategoryReviewResult["category"],
  scenario: MaterialReviewMockScenario,
) {
  if (scenario === "reviewing") {
    return [];
  }

  if (scenario === "category_satisfied" || scenario === "satisfied") {
    return [buildSatisfiedCategoryResult(category)];
  }

  return [buildSupplementRequiredCategoryResult(category)];
}

export async function createInitialMaterialReview(
  input: CreateInitialMaterialReviewInput,
) {
  const scenario = resolveScenario(input.mockScenario);

  return buildRunResponse({
    externalRunId: buildInitialRunId(scenario),
    scenario,
  });
}

export async function createCategoryMaterialReview(
  input: CreateCategoryMaterialReviewInput,
) {
  const scenario = resolveScenario(input.mockScenario);

  return buildRunResponse({
    externalRunId: buildCategoryRunId(input.category, scenario),
    scenario,
  });
}

export async function getMaterialReviewResult(
  input: GetMaterialReviewResultInput,
): Promise<GetMaterialReviewResultResponse> {
  const finishedAt = createTimestamp();
  const categoryRun = parseCategoryRunId(input.externalRunId);
  const initialRunScenario = parseInitialRunId(input.externalRunId);
  const scenario = resolveScenario(
    input.mockScenario,
    categoryRun?.scenario ?? initialRunScenario,
  );
  const status: MaterialReviewJobStatus =
    scenario === "reviewing" ? "PROCESSING" : "COMPLETED";
  const categories = categoryRun
    ? buildCategoryReviewResult(categoryRun.category, scenario)
    : buildInitialCategoryResults(scenario);

  return {
    externalRunId: input.externalRunId,
    status,
    startedAt: finishedAt,
    finishedAt: status === "COMPLETED" ? finishedAt : null,
    categories,
  };
}
