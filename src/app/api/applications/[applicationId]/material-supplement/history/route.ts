import { NextRequest, NextResponse } from "next/server";

import { isSupplementCategory } from "@/features/material-supplement/constants";
import type { SupplementCategory } from "@/features/material-supplement/types";
import { assertSupplementAccess } from "@/lib/material-supplement/access";
import {
  jsonSupplementServiceError,
  MaterialSupplementServiceError,
} from "@/lib/material-supplement/errors";
import {
  getSupplementHistory,
  type SupplementHistoryFilters,
} from "@/lib/material-supplement/service";

type Params = {
  params: Promise<{ applicationId: string }>;
};

function parseHistoryFilters(searchParams: URLSearchParams) {
  const filters: SupplementHistoryFilters = {};
  const category = searchParams.get("category");
  const runNo = searchParams.get("runNo");

  if (isSupplementCategory(category)) {
    filters.category = category satisfies SupplementCategory;
  }

  if (runNo !== null) {
    const parsedRunNo = Number(runNo);

    if (Number.isInteger(parsedRunNo) && parsedRunNo > 0) {
      filters.runNo = parsedRunNo;
    }
  }

  return filters;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;

  try {
    await assertSupplementAccess({
      request,
      applicationId,
    });

    return NextResponse.json(
      await getSupplementHistory(
        applicationId,
        parseHistoryFilters(request.nextUrl.searchParams),
      ),
    );
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      return jsonSupplementServiceError(error);
    }

    throw error;
  }
}
