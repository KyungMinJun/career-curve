type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIContentPart[];
};

type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

type OpenAIToolChoice = {
  type: 'function';
  function: { name: string };
};

export type LovableChatPayload = {
  model?: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  tool_choice?: OpenAIToolChoice;
};

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

type GeminiRequest = {
  contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }>;
  systemInstruction?: { role: 'system'; parts: Array<{ text: string }> };
  tools?: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
  toolConfig?: {
    functionCallingConfig: {
      mode: 'ANY' | 'AUTO' | 'NONE';
      allowedFunctionNames?: string[];
    };
  };
};

type LovableLikeResponse = {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{
        function?: { arguments?: string };
      }>;
    };
  }>;
};

function normalizeModel(model?: string): string {
  const envModel = Deno.env.get('GEMINI_MODEL');
  if (envModel && envModel.trim()) {
    return envModel.trim();
  }
  if (!model) return 'gemini-3-flash-preview';
  return model.includes('/') ? model.split('/').pop() ?? model : model;
}

function extractSystemText(messages: OpenAIMessage[]): string | null {
  const systemMessage = messages.find((m) => m.role === 'system');
  if (!systemMessage) return null;
  if (typeof systemMessage.content === 'string') return systemMessage.content;
  return systemMessage.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

function convertImageUrlToPart(url: string): GeminiPart {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { text: `Image URL: ${url}` };
  }
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
}

function convertMessageContent(content: OpenAIMessage['content']): GeminiPart[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  return content.map((part) => {
    if (part.type === 'text') {
      return { text: part.text };
    }
    return convertImageUrlToPart(part.image_url.url);
  });
}

function sanitizeSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeSchema);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      if (key === 'additionalProperties' || key === 'nullable') {
        continue;
      }
      cleaned[key] = sanitizeSchema(val);
    }
    return cleaned;
  }
  return value;
}

function buildGeminiRequest(payload: LovableChatPayload): { model: string; request: GeminiRequest } {
  const model = normalizeModel(payload.model);
  const systemText = extractSystemText(payload.messages);

  const contents = payload.messages
    .filter((m) => m.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: convertMessageContent(message.content),
    }));

  const request: GeminiRequest = { contents };

  if (systemText) {
    request.systemInstruction = {
      role: 'system',
      parts: [{ text: systemText }],
    };
  }

  if (payload.tools?.length) {
    const functionDeclarations = payload.tools
      .filter((tool) => tool.type === 'function')
      .map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: sanitizeSchema(tool.function.parameters),
      }));

    if (functionDeclarations.length) {
      request.tools = [{ functionDeclarations }];
    }
  }

  if (payload.tool_choice?.type === 'function' && payload.tool_choice.function?.name) {
    request.toolConfig = {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [payload.tool_choice.function.name],
      },
    };
  }

  return { model, request };
}

export async function callGeminiFromLovable(
  payload: LovableChatPayload,
  apiKey: string,
): Promise<Response> {
  const { model, request } = buildGeminiRequest(payload);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
}

export function normalizeGeminiToLovable(aiData: any): LovableLikeResponse | null {
  const candidate = aiData?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const textParts = parts
    .filter((part: any) => typeof part?.text === 'string')
    .map((part: any) => part.text)
    .join('');
  const functionPart = parts.find((part: any) => part?.functionCall);

  let toolCalls: LovableLikeResponse['choices'][number]['message']['tool_calls'];
  if (functionPart?.functionCall) {
    const args = functionPart.functionCall.args ?? functionPart.functionCall.arguments;
    const argumentsJson = typeof args === 'string' ? args : JSON.stringify(args ?? {});
    toolCalls = [{ function: { arguments: argumentsJson } }];
  } else if (textParts) {
    const trimmed = textParts.trim();
    try {
      const parsed = JSON.parse(trimmed);
      const argumentsJson = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      toolCalls = [{ function: { arguments: argumentsJson } }];
    } catch {
      // leave toolCalls undefined when text isn't JSON
    }
  }

  if (!textParts && !toolCalls) {
    return null;
  }

  return {
    choices: [
      {
        message: {
          content: textParts || '',
          tool_calls: toolCalls,
        },
      },
    ],
  };
}
