type FunctionErrorContext = {
  body?: string;
};

type FunctionInvokeError = {
  message?: string;
  context?: FunctionErrorContext;
};

type FunctionErrorPayload = {
  error?: string;
  message?: string;
  success?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

export const getFunctionErrorMessage = (
  error: unknown,
  fallbackMessage = "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
): string => {
  if (!isRecord(error)) return fallbackMessage;

  const invokeError = error as FunctionInvokeError;
  const body = invokeError.context?.body;

  if (typeof body === "string" && body.trim()) {
    try {
      const parsed = JSON.parse(body) as FunctionErrorPayload;
      if (parsed?.error && typeof parsed.error === "string") return parsed.error;
      if (parsed?.message && typeof parsed.message === "string") return parsed.message;
    } catch {
      return body;
    }
  }

  if (typeof invokeError.message === "string" && invokeError.message.trim()) {
    return invokeError.message;
  }

  return fallbackMessage;
};
