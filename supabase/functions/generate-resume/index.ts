import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Experience {
  id: string;
  type: "work" | "project";
  title: string;
  company?: string;
  period?: string;
  description: string;
  bullets: string[];
}

interface KeyCompetency {
  title: string;
  description: string;
}

type ResumeFormat = "consulting" | "narrative";

interface RequestBody {
  jobTitle: string;
  companyName: string;
  jobSummary: string;
  keyCompetencies: KeyCompetency[];
  experiences: Experience[];
  language: "ko" | "en";
  format?: ResumeFormat;
}

function splitAiFeedback(raw: string) {
  // Preferred markers
  const FEEDBACK = "===AI_FEEDBACK===";
  const RESUME = "===RESUME===";

  const feedbackIdx = raw.indexOf(FEEDBACK);
  const resumeIdx = raw.indexOf(RESUME);

  if (feedbackIdx !== -1 && resumeIdx !== -1 && resumeIdx > feedbackIdx) {
    const aiFeedback = raw.slice(feedbackIdx + FEEDBACK.length, resumeIdx).trim();
    const content = raw.slice(resumeIdx + RESUME.length).trim();
    return { aiFeedback, content };
  }

  // Fallback: split by localized headers
  const fallbacks = ["[AI 피드백]", "[AI Feedback]"];
  for (const header of fallbacks) {
    const idx = raw.indexOf(header);
    if (idx !== -1) {
      const after = raw.slice(idx + header.length).trim();
      // Try to find first experience header line after feedback
      const experienceHeaderRegex = /\n\s*\[(경험 제목|Experience Title)\]\s*\n/;
      const m = after.match(experienceHeaderRegex);
      if (m && m.index !== undefined) {
        const aiFeedback = after.slice(0, m.index).trim();
        const content = after.slice(m.index).trim();
        return { aiFeedback, content };
      }
      return { aiFeedback: after.trim(), content: raw.slice(0, idx).trim() };
    }
  }

  return { aiFeedback: "", content: raw.trim() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      jobTitle,
      companyName,
      jobSummary,
      keyCompetencies,
      experiences,
      language,
      format = language === "en" ? "consulting" : "narrative",
    }: RequestBody = await req.json();

    console.log("Generating tailored resume for:", companyName, jobTitle);
    console.log("Language:", language, "Format:", format);
    console.log("Experiences count:", experiences.length);
    console.log("Key competencies:", keyCompetencies.map((k) => k.title));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt =
      language === "ko"
        ? `당신은 채용 담당자 관점까지 포함한 전문 이력서 작성 컨설턴트입니다. 주어진 채용 공고의 핵심 역량에 맞춰 지원자의 경험을 최적화하여 이력서를 작성합니다.

중요 규칙:
- 반드시 아래 마커를 그대로 사용해 출력하세요.
- 마커 밖에는 어떤 텍스트도 출력하지 마세요.

출력 형식(엄수):
===AI_FEEDBACK===
(여기에 피드백만)
===RESUME===
(여기에 이력서 본문만)

AI_FEEDBACK 작성 규칙(엄수):
- 반드시 아래 2개 섹션으로만 구성하세요.
  1) ## 종합의견
  2) ## 세부 수정 의견
- 종합의견에는: 적합해 보이는 점 / 아쉬운 점 / 어떤 내용을 중심으로 보완했는지 를 간결하게 정리
- 세부 수정 의견에는: 수정 포인트를 항목별로 제시(가능하면 원문 대비 변경 이유 포함)
- 절대 없는 사실을 만들어내지 말 것(경험/성과 과장 금지)
- 과장/왜곡 가능성이 있는 문장은 세부 수정 의견에 "⚠︎ 확인 필요"로 표시

RESUME 작성 규칙:
- 결과는 한국어로 작성.
- 이력서 본문에는 AI 피드백/조언 문구를 절대 포함하지 말 것.
- 형식: ${format === "consulting" ? "컨설팅형(간결, 성과 중심)" : "서술형(국문형, 섹션 구분 명확)"}.`
        : `You are a professional resume consultant with a recruiter mindset. Optimize the candidate's experiences to match the key competencies required by the job posting.

CRITICAL RULES:
- You MUST output using the exact markers below.
- Do NOT output any text outside of the markers.

Output format (STRICT):
===AI_FEEDBACK===
(feedback only)
===RESUME===
(resume body only)

AI_FEEDBACK rules (STRICT):
- Use exactly these two sections:
  1) ## Overall Assessment
  2) ## Detailed Revision Notes
- Overall Assessment: strengths, gaps, what you improved and why
- Detailed Revision Notes: itemized edits with rationale
- Never invent facts; no exaggeration
- Mark any potentially unverifiable claim with "⚠︎ Verify"

Additional rules:
- Write in English.
- The resume body must NOT contain feedback/advice text.
- Format: ${format === "consulting" ? "consulting-style (concise, results-driven)" : "narrative-style"}.`;

    const userPrompt =
      language === "ko"
        ? `## 채용 공고 정보
회사: ${companyName}
포지션: ${jobTitle}
요약: ${jobSummary}

## 핵심 요구 역량
${keyCompetencies.map((k, i) => `${i + 1}. ${k.title}: ${k.description}`).join("\n")}

## 지원자 경험
${experiences
  .map(
    (exp, i) => `
### ${exp.type === "work" ? "경력" : "프로젝트"} ${i + 1}: ${exp.title}${exp.company ? ` @ ${exp.company}` : ""}
기간: ${exp.period || "미정"}
설명: ${exp.description}
주요 성과:
${exp.bullets.map((b) => `- ${b}`).join("\n")}
`
  )
  .join("\n")}

요청:
1) ===AI_FEEDBACK===에는 각 역량별로:
- 어떤 경험/성과를 근거로 선택했는지
- 무엇을 어떻게 강화했는지
- 추가로 어필하면 좋은 포인트
2) ===RESUME===에는 이력서 본문만 작성.

이력서 본문 작성 형식:
- ${format === "consulting" ? "간결한 섹션(Heading) + Bullet 위주" : "섹션(경력/프로젝트) 구분 + 각 섹션 내 Bullet"}
- 각 경험은 아래 형식을 따를 것:
[경험 제목]
[회사명] | [기간]
• bullet 1
• bullet 2
• bullet 3`
        : `## Job Posting Information
Company: ${companyName}
Position: ${jobTitle}
Summary: ${jobSummary}

## Key Required Competencies
${keyCompetencies.map((k, i) => `${i + 1}. ${k.title}: ${k.description}`).join("\n")}

## Candidate's Experience
${experiences
  .map(
    (exp, i) => `
### ${exp.type === "work" ? "Work Experience" : "Project"} ${i + 1}: ${exp.title}${exp.company ? ` @ ${exp.company}` : ""}
Period: ${exp.period || "Not specified"}
Description: ${exp.description}
Key Achievements:
${exp.bullets.map((b) => `- ${b}`).join("\n")}
`
  )
  .join("\n")}

Request:
1) In ===AI_FEEDBACK===, for each competency:
- what evidence you used from the experience
- what you strengthened
- what else to highlight
2) In ===RESUME===, write ONLY the resume body.

Resume body format:
- ${format === "consulting" ? "concise headings + bullets" : "sectioned narrative"}
- For each experience use:
[Experience Title]
[Company Name] | [Period]
• bullet 1
• bullet 2
• bullet 3`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const { aiFeedback, content } = splitAiFeedback(rawContent);

    console.log("Resume generated successfully (split):", {
      aiFeedbackLength: aiFeedback.length,
      contentLength: content.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        content,
        aiFeedback: aiFeedback || null,
        rawContent,
        language,
        format,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating resume:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
