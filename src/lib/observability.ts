import { isSupabaseConfigured } from "./config";
import { supabase } from "./supabase";

/** A single tab floods the table if every render error is reported. */
const MAX_REPORTS_PER_SESSION = 10;

let installed = false;
let reported = 0;

function describe(value: unknown): string {
  if (value instanceof Error) return value.message || value.name || "Error";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value)?.slice(0, 500) ?? "Bilinmeyen hata";
  } catch {
    return "Bilinmeyen hata";
  }
}

/**
 * Stores a client failure for the admin panel. Never throws: reporting must not
 * break the screen it is trying to describe.
 */
export async function logClientError(
  message: string,
  context?: Record<string, unknown>,
  stack?: string,
): Promise<void> {
  if (!isSupabaseConfigured || reported >= MAX_REPORTS_PER_SESSION) return;
  reported += 1;

  try {
    await supabase.rpc("log_client_error", {
      p_message: describe(message),
      p_stack: stack ? stack.slice(0, 4000) : null,
      p_url: typeof window === "undefined" ? null : window.location.href.slice(0, 500),
      p_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 300),
      p_context: context ?? null,
    });
  } catch {
    // A failed report is not worth surfacing to the candidate.
  }
}

/** Window-level handlers: uncaught errors and unhandled promise rejections. */
export function installErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    void logClientError(event.message, { kind: "error" }, event.error?.stack);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    void logClientError(
      describe(reason),
      { kind: "unhandledrejection" },
      reason instanceof Error ? reason.stack : undefined,
    );
  });
}
