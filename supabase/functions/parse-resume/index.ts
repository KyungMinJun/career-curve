import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, resumeId, resumeText, pageImages } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const hasText = typeof resumeText === 'string' && resumeText.trim().length > 0;
    const hasImages = Array.isArray(pageImages) && pageImages.length > 0;

    // 텍스트도 이미지도 없으면 파싱 불가
    if (!hasText && !hasImages) {
      console.log('No resume text or images provided');
      return new Response(
        JSON.stringify({
          success: true,
          experiences: [],
          message: 'No resume content to parse'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callGateway = async (payload: Record<string, unknown>) => {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const t = await resp.text();
        console.error('AI gateway error:', resp.status, t);

        // Lovable AI 과금/레이트리밋 에러는 그대로 전달
        if (resp.status === 429) {
          return new Response(JSON.stringify({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ success: false, error: 'AI 사용량이 부족합니다. 워크스페이스 크레딧을 확인해주세요.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: false, error: 'AI 분석 실패' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return resp;
    };

    const safeParseJson = (raw: string) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const readToolArguments = (aiData: any) => {
      const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
      const argStr = toolCall?.function?.arguments;
      if (typeof argStr === 'string') return safeParseJson(argStr);
      return null;
    };

    // (A) OCR 전사 단계: 이미지가 있으면 먼저 "보이는 텍스트"를 그대로 전사
    let ocrText = '';
    if (hasImages) {
      const ocrSystemPrompt = `You are an OCR engine.

CRITICAL:
- Transcribe ONLY what is visible in the images.
- Keep original language.
- Preserve line breaks as much as possible.
- If unreadable, return an empty string.

Return via tool call.`;

      const ocrUserParts: any[] = [
        {
          type: 'text',
          text:
            '아래 이력서 PDF 페이지 이미지에서 보이는 텍스트를 그대로 전사(OCR)해 주세요. 추측/요약/생성 금지. 읽을 수 없으면 빈 문자열로 반환.',
        },
      ];
      for (const img of pageImages.slice(0, 3)) {
        ocrUserParts.push({ type: 'image_url', image_url: { url: img, detail: 'high' } });
      }

      const ocrPayload: Record<string, unknown> = {
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: ocrSystemPrompt },
          { role: 'user', content: ocrUserParts },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_ocr_text',
              description: 'Return OCR-transcribed text from resume images',
              parameters: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                },
                required: ['text'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_ocr_text' } },
        max_completion_tokens: 2400,
      };

      const ocrResp = await callGateway(ocrPayload);
      if (ocrResp.status >= 400) {
        return ocrResp;
      }

      const ocrAiData = await ocrResp.json();

      
      const ocrParsed = readToolArguments(ocrAiData);
      ocrText = typeof ocrParsed?.text === 'string' ? ocrParsed.text : '';
      console.log('OCR text length:', ocrText.length);
    }

    // (B) 경험 추출 단계: 텍스트 기반으로 안정적으로 분류/추출
    const textForExtraction = hasText ? String(resumeText) : ocrText;
    if (!textForExtraction || textForExtraction.trim().length < 40) {
      console.log('No usable text after extraction/OCR');
      return new Response(
        JSON.stringify({ success: true, experiences: [], ocrText: ocrText || '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert resume parser.

CRITICAL INSTRUCTIONS:
1. ONLY extract information that is ACTUALLY in the resume text. Do NOT make up or hallucinate any experiences.
2. If the provided text is incomplete / unreliable, return an EMPTY experiences array.
3. Categorize each item as either "work" (employment) or "project" (projects).
4. Keep original wording for names/titles as much as possible.

Return a JSON object with:
- experiences: array of objects with:
  - type: "work" or "project"
  - title: actual job title or project name
  - company: actual company name (if present)
  - description: short description (may be empty)
  - bullets: array of achievements/responsibilities (may be empty)

Always respond in Korean if the resume is in Korean, otherwise match the resume language.`;

    const extractionModel = 'google/gemini-2.5-flash';

    const extractionPayload: Record<string, unknown> = {
      model: extractionModel,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Parse this resume text and extract experiences.\n\nRESUME_TEXT:\n${textForExtraction.substring(0, 24000)}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_resume_experiences',
            description: 'Extract work experiences and projects from resume',
            parameters: {
              type: 'object',
              properties: {
                experiences: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['work', 'project'] },
                      title: { type: 'string' },
                      company: { type: 'string' },
                      description: { type: 'string' },
                      bullets: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['type', 'title'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['experiences'],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'extract_resume_experiences' } },
    };

    const extractionRespOrResponse = await callGateway(extractionPayload);
    if (extractionRespOrResponse instanceof Response && (extractionRespOrResponse as any).status >= 400) {
      return extractionRespOrResponse;
    }

    const aiData = await (extractionRespOrResponse as any).json();
    console.log('AI response received');

    let experiences: any[] = [];
    const parsed = readToolArguments(aiData);
    if (parsed && Array.isArray(parsed.experiences)) {
      experiences = parsed.experiences;
    }

    // 목데이터/환각 최소화: 흔한 플레이스홀더/신호 없는 항목 제거
    const cleaned = (experiences || []).filter((exp) => {
      const title = String(exp?.title ?? '').trim();
      const company = String(exp?.company ?? '').trim();
      const desc = String(exp?.description ?? '').trim();
      const bullets = Array.isArray(exp?.bullets) ? exp.bullets.filter((b: any) => String(b).trim()) : [];

      const looksLikeMock = /^(예시|샘플|Sample|Dummy|목데이터)/i.test(title) || /목데이터|샘플|example/i.test(`${title} ${company} ${desc}`);
      const hasSignal = title.length >= 2 && (desc.length >= 3 || bullets.length >= 1 || company.length >= 2);
      return !looksLikeMock && hasSignal;
    });

    console.log('Extracted experiences:', cleaned.length);

    return new Response(
      JSON.stringify({
        success: true,
        experiences: cleaned,
        ocrText: ocrText || undefined,
        extractedTextLength: textForExtraction.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing resume:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
