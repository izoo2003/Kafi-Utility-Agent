import { createClient } from "@/lib/supabase/server";
import { listGeneratorVendors } from "@/lib/supabase/generator";
import { GeneratorVendorsPanel } from "@/components/dashboard/generator-vendors-panel";
import type { GeneratorVendor } from "@/lib/types/database";

export default async function GeneratorVendorsPage() {
  const supabase = await createClient();
  const { data, error } = await listGeneratorVendors(supabase);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load generator vendors: {error.message}. If this mentions a
        missing table, run migration{" "}
        <code>20260828200000_generator_vendors.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <GeneratorVendorsPanel
      initialVendors={(data ?? []) as GeneratorVendor[]}
    />
  );
}
