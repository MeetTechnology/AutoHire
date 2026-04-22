import { redirect } from "next/navigation";

type ResultPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResultPage({ searchParams }: ResultPageProps) {
  const resolvedSearchParams = await searchParams;
  const view = resolvedSearchParams.view;
  const firstView = Array.isArray(view) ? view[0] : view;

  if (firstView === "additional") {
    redirect("/apply/resume?view=additional");
  }

  if (firstView === "review") {
    redirect("/apply/resume?view=review");
  }

  redirect("/apply/resume");
}
