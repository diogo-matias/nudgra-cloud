import type { Id } from "../_generated/dataModel";

export const META_REFRESH_RETRY_DELAYS_MS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
] as const;

export const META_TOKEN_REFRESH_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

type ParsedMetaApiErrorPayload = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

export type ParsedMetaApiError = {
  message: string;
  code: number | null;
  subcode: number | null;
  type: string | null;
};

export type AccountTokenLifecycleContext = {
  id: Id<"instagramAccounts">;
  workspaceId: Id<"workspaces">;
  instagramAccountId: string;
  status: "connected" | "connection_error" | "disconnected";
  graphAccessToken: string | null;
  tokenExpiresAt: number | null;
  reconnectRequired: boolean;
  lastRefreshAttemptAt: number | null;
  lastTokenRefreshAt: number | null;
  nextRefreshAt: number | null;
  refreshFailureCount: number;
  graphApiVersion: string;
  lastError: string | null;
};

export function parseMetaApiError(
  responseText: string,
  fallback: string,
): ParsedMetaApiError {
  if (!responseText.trim()) {
    return {
      message: fallback,
      code: null,
      subcode: null,
      type: null,
    };
  }

  try {
    const parsed = JSON.parse(responseText) as ParsedMetaApiErrorPayload;
    const message = parsed.error?.message?.trim() || fallback;
    return {
      message,
      code: typeof parsed.error?.code === "number" ? parsed.error.code : null,
      subcode:
        typeof parsed.error?.error_subcode === "number"
          ? parsed.error.error_subcode
          : null,
      type: typeof parsed.error?.type === "string" ? parsed.error.type : null,
    };
  } catch {
    return {
      message: responseText.trim() || fallback,
      code: null,
      subcode: null,
      type: null,
    };
  }
}

export function isMetaAuthError(error: ParsedMetaApiError | string) {
  const parsed =
    typeof error === "string" ? parseMetaApiError(error, error) : error;

  if (parsed.code === 190) {
    return true;
  }

  const normalized = parsed.message.toLowerCase();
  return (
    normalized.includes("invalid oauth access token") ||
    normalized.includes("error validating access token") ||
    normalized.includes("cannot parse access token") ||
    normalized.includes("access token has expired") ||
    normalized.includes("session has expired") ||
    normalized.includes("token expired") ||
    normalized.includes("token is invalid") ||
    normalized.includes("user revoked") ||
    normalized.includes("invalid or has expired")
  );
}

export function isMetaConsentRequiredError(error: ParsedMetaApiError | string) {
  const message = typeof error === "string" ? error : error.message;
  return message.toLowerCase().includes("user consent is required");
}

export function isMetaTransientError(status: number) {
  return status === 429 || status >= 500;
}

export function computeNextRefreshAt(
  tokenExpiresAt: number | null,
  now: number,
) {
  if (tokenExpiresAt === null) {
    return null;
  }

  return Math.max(now, tokenExpiresAt - META_TOKEN_REFRESH_LEAD_MS);
}

export function computeRefreshRetryDelayMs(failureCount: number) {
  if (failureCount <= 1) {
    return META_REFRESH_RETRY_DELAYS_MS[0];
  }

  if (failureCount === 2) {
    return META_REFRESH_RETRY_DELAYS_MS[1];
  }

  if (failureCount === 3) {
    return META_REFRESH_RETRY_DELAYS_MS[2];
  }

  return META_REFRESH_RETRY_DELAYS_MS[3];
}

export function buildRefreshRetryWarning(message: string) {
  return `Instagram token refresh failed temporarily. Nudgra will retry automatically while outbound sending stays active. ${message}`;
}

export function buildReconnectRequiredMessage(message: string) {
  return `Instagram access has to be reconnected. Inbound webhooks are still stored, but outbound automations are paused until you reconnect the account from Dashboard > Account. ${message}`;
}

export function canUseAccountToken(args: {
  status: "connected" | "connection_error" | "disconnected";
  graphAccessToken: string | null;
  reconnectRequired: boolean;
}) {
  return (
    args.status === "connected" &&
    args.graphAccessToken !== null &&
    !args.reconnectRequired
  );
}
