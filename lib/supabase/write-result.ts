import type { DedupeOutcome } from "@/lib/dashboard/dedupe";

export type DomainWriteResult<T> = {
  data: T | null;
  error: { message: string } | null;
  outcome: DedupeOutcome;
};

export function writeOk<T>(data: T, outcome: DedupeOutcome): DomainWriteResult<T> {
  return { data, error: null, outcome };
}

export function writeErr<T = never>(message: string): DomainWriteResult<T> {
  return { data: null, error: { message }, outcome: "created" };
}
