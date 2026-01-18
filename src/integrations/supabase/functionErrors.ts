type FunctionErrorContext = {
  body?: unknown;
  response?: unknown;
};

type FunctionInvokeError = {
  message?: string;
  context?: FunctionErrorContext;
  cause?: {
    context?: FunctionErrorContext;
  };
};

type FunctionErrorPayload = {
  error?: string;
  message?: string;
  success?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const getPayloadMessage = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const data = payload as FunctionErrorPayload;
  if (typeof data.error === "string") return data.error;
  if (typeof data.message === "string") return data.message;
  return null;
};

const parseTextPayload = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return text;
  try {
    const parsed = JSON.parse(trimmed) as FunctionErrorPayload;
    return getPayloadMessage(parsed) ?? trimmed;
  } catch {
    return trimmed;
  }
};

const readBodyAsText = async (body: unknown): Promise<string | null> => {
  if (!body) return null;
  if (typeof body === "string") return body;
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(body));
  }
  if (typeof Uint8Array !== "undefined" && body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return await body.text();
  }
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return await new Response(body).text();
  }
  if (isRecord(body)) {
    return JSON.stringify(body);
  }
  return null;
};

const getMessageFromBody = async (body: unknown): Promise<string | null> => {
  const payloadMessage = getPayloadMessage(body);
  if (payloadMessage) return payloadMessage;

  const text = await readBodyAsText(body);
  if (!text) return null;

  return parseTextPayload(text);
};

const getMessageFromResponse = async (response: unknown): Promise<string | null> => {
  if (!response) return null;
  if (typeof Response !== "undefined" && response instanceof Response) {
    try {
      const text = await response.clone().text();
      return text ? parseTextPayload(text) : null;
    } catch {
      return null;
    }
  }
  if (isRecord(response) && "body" in response) {
    return await getMessageFromBody(response.body);
  }
  return null;
};

export const getFunctionErrorMessage = async (
  error: unknown,
  fallbackMessage = "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
): Promise<string> => {
  if (!isRecord(error)) return fallbackMessage;

  const invokeError = error as FunctionInvokeError;
  const context = invokeError.context ?? invokeError.cause?.context;
  const body = context?.body;

  if (body) {
    const message = await getMessageFromBody(body);
    if (message) return message;
  }

  if (context?.response) {
    const message = await getMessageFromResponse(context.response);
    if (message) return message;
  }

  if (typeof invokeError.message === "string" && invokeError.message.trim()) {
    if (invokeError.message === "Edge Function returned a non-2xx status code") {
      return fallbackMessage;
    }
    return invokeError.message;
  }

  return fallbackMessage;
};
