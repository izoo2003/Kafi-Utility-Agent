import { createClient } from "@/lib/supabase/server";
import { listGeneratorExpenses } from "@/lib/supabase/generator";
import { generatorSectionMeta } from "@/lib/dashboard/generator-sections";
import { PageHeader } from "@/components/dashboard/page-header";
import { GeneratorSectionNav } from "@/components/dashboard/generator-section-nav";
import { GeneratorExpensesSection } from "@/components/dashboard/generator-expenses-section";
import type { GeneratorExpense } from "@/lib/types/database";

export default async function GeneratorExpensesPage() {
  const supabase = await createClient();
  const { data, error } = await listGeneratorExpenses(supabase);
  const copy = generatorSectionMeta("expenses");

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load generator expenses: {error.message}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Generator · ${copy.label}`}
        description={copy.pageDescription}
        icon="generator"
        accent="orange"
      />
      <GeneratorSectionNav active="expenses" />
      <GeneratorExpensesSection
        initialExpenses={(data ?? []) as GeneratorExpense[]}
      />
    </div>
  );
}
