import { SUPPLEMENT_CATEGORY_LABELS } from "@/features/material-supplement/constants";

import type {
  MaterialCategoryReviewResult,
  MaterialReviewRequest,
} from "@/lib/material-review/types";

export function buildEducationSupplementRequests(): MaterialReviewRequest[] {
  return [
    {
      title: "Doctoral degree proof required",
      reason:
        "The submitted documents do not clearly prove the doctoral degree listed in the CV.",
      suggestedMaterials: [
        "Doctoral degree certificate",
        "Education verification report",
      ],
      aiMessage:
        "Please upload a doctoral degree certificate or an equivalent education verification document.",
      status: "PENDING",
    },
  ];
}

export function buildSatisfiedCategoryResult(
  category: MaterialCategoryReviewResult["category"],
): MaterialCategoryReviewResult {
  const label = SUPPLEMENT_CATEGORY_LABELS[category];

  return {
    category,
    status: "COMPLETED",
    aiMessage: `${label} are sufficient for the current review.`,
    resultPayload: {
      supplementRequired: false,
      requests: [],
    },
    rawResultPayload: null,
  };
}

export function buildSupplementRequiredCategoryResult(
  category: MaterialCategoryReviewResult["category"],
): MaterialCategoryReviewResult {
  if (category === "EDUCATION") {
    return {
      category,
      status: "COMPLETED",
      aiMessage:
        "Please provide proof of the doctoral degree listed in your CV.",
      resultPayload: {
        supplementRequired: true,
        requests: buildEducationSupplementRequests(),
      },
      rawResultPayload: null,
    };
  }

  return buildSatisfiedCategoryResult(category);
}
