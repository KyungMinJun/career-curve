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

        if (resp.status === 429) {
          return { error: true, status: 429, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
        }
        if (resp.status === 402) {
          return { error: true, status: 402, message: 'AI 사용량이 부족합니다. 워크스페이스 크레딧을 확인해주세요.' };
        }
        return { error: true, status: 500, message: 'AI 분석 실패' };
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

    // (A) OCR 단계: 이미지가 있고 텍스트가 부족하면 OCR 수행
    let ocrText = '';
    if (hasImages && (!hasText || resumeText.trim().length < 100)) {
      console.log('Starting OCR with', pageImages.length, 'images');
      
      // gpt-5-mini로 OCR 수행 (vision 성능 우수)
      const ocrUserParts: any[] = [
        {
          type: 'text',
          text: `이 이력서 PDF 페이지들의 모든 텍스트를 읽어서 그대로 전사해주세요.
- 회사명, 직책, 기간, 업무 내용 등 모든 텍스트를 빠짐없이 추출
- 원본 언어 그대로 유지
- 줄바꿈 유지
- 읽을 수 없는 부분은 건너뛰기`,
        },
      ];
      
      for (const img of pageImages.slice(0, 3)) {
        ocrUserParts.push({ type: 'image_url', image_url: { url: img, detail: 'high' } });
      }

      const ocrPayload: Record<string, unknown> = {
        model: 'openai/gpt-5',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert OCR system. Extract and transcribe ALL text visible in the resume images accurately. Preserve original language and formatting.'
          },
          { role: 'user', content: ocrUserParts },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_ocr_text',
              description: 'Return the OCR-transcribed text from resume images',
              parameters: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'All text extracted from the resume images' },
                },
                required: ['text'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_ocr_text' } },
      };

      const ocrResult = await callGateway(ocrPayload);
      
      if ('error' in ocrResult) {
        console.error('OCR failed:', ocrResult.message);
      } else {
        const ocrAiData = await (ocrResult as Response).json();
        const ocrParsed = readToolArguments(ocrAiData);
        ocrText = typeof ocrParsed?.text === 'string' ? ocrParsed.text : '';
        console.log('OCR extracted text length:', ocrText.length);
        
        // 디버깅: OCR 텍스트 일부 출력
        if (ocrText.length > 0) {
          console.log('OCR text preview:', ocrText.substring(0, 500));
        }
      }
    }

    // 최종 텍스트 결합 (PDF 텍스트 + OCR)
    const combinedText = [
      hasText ? resumeText : '',
      ocrText
    ].filter(t => t.trim()).join('\n\n---\n\n');
    
    console.log('Combined text length:', combinedText.length);

    if (combinedText.trim().length < 30) {
      console.log('No usable text after extraction/OCR');
      return new Response(
        JSON.stringify({ 
          success: true, 
          experiences: [], 
          ocrText: ocrText || '',
          extractedTextLength: combinedText.length,
          debugInfo: 'Text too short after OCR'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (B) 경험 추출 - 회사+업무+기간 패턴으로 경력/프로젝트 분류
    const systemPrompt = `당신은 이력서 분석 전문가입니다.

주어진 이력서 텍스트에서 경력(work)과 프로젝트(project)를 추출하세요.

## 분류 기준
**경력 (work)**: 
- 회사명 + 직책/역할 + 근무 기간이 명시된 항목
- 정규직/계약직 등 고용 형태의 업무 경험
- 예: "네이버 | 소프트웨어 엔지니어 | 2020.01 - 2023.06"

**프로젝트 (project)**:
- 특정 프로젝트명 + 역할/기술 + 기간이 있는 항목
- 사이드 프로젝트, 학교 과제, 오픈소스 기여 등
- 경력에 해당하지 않는 모든 경험

## 추출 필드
각 항목에서 다음을 추출:
- type: "work" 또는 "project"
- title: 직책명 또는 프로젝트명
- company: 회사명 또는 조직명 (없으면 빈 문자열)
- period: 기간 (예: "2020.01 - 2023.06", "2023.03 - 현재")
- description: 간단한 설명
- bullets: 주요 성과/업무 내용 배열

## 중요 규칙
1. 이력서에 실제로 있는 내용만 추출하세요
2. 없는 내용을 만들어내지 마세요
3. 기간이 없어도 회사+역할이 있으면 경력으로 분류
4. 한국어 이력서는 한국어로, 영어 이력서는 영어로 유지`;

    const extractionPayload: Record<string, unknown> = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `아래 이력서 텍스트에서 모든 경력과 프로젝트를 추출해주세요.\n\n${combinedText.substring(0, 20000)}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_experiences',
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
                      period: { type: 'string' },
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
      tool_choice: { type: 'function', function: { name: 'extract_experiences' } },
    };

    const extractionResult = await callGateway(extractionPayload);
    
    if ('error' in extractionResult) {
      return new Response(
        JSON.stringify({ success: false, error: extractionResult.message }),
        { status: extractionResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await (extractionResult as Response).json();
    console.log('Extraction AI response received');

    let experiences: any[] = [];
    const parsed = readToolArguments(aiData);
    if (parsed && Array.isArray(parsed.experiences)) {
      experiences = parsed.experiences;
    }

    // 목데이터/환각 필터링
    const cleaned = experiences.filter((exp) => {
      const title = String(exp?.title ?? '').trim();
      const company = String(exp?.company ?? '').trim();
      const desc = String(exp?.description ?? '').trim();
      const bullets = Array.isArray(exp?.bullets) ? exp.bullets.filter((b: any) => String(b).trim()) : [];

      const looksLikeMock = /^(예시|샘플|Sample|Dummy|목데이터|Example)/i.test(title) || 
                           /목데이터|샘플|example|lorem|ipsum/i.test(`${title} ${company} ${desc}`);
      const hasContent = title.length >= 2;
      return !looksLikeMock && hasContent;
    });

    console.log('Extracted experiences:', cleaned.length);

    // 로그에 추출된 내용 표시 (디버깅용)
    cleaned.forEach((exp, i) => {
      console.log(`Experience ${i + 1}:`, JSON.stringify({
        type: exp.type,
        title: exp.title,
        company: exp.company,
        period: exp.period,
      }));
    });

    return new Response(
      JSON.stringify({
        success: true,
        experiences: cleaned,
        ocrText: ocrText || undefined,
        extractedTextLength: combinedText.length,
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
