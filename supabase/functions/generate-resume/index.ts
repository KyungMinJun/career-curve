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
  score?: number; // User's self-assessment 1-5
  evaluation?: string; // AI evaluation of user's fit
}

interface MinimumRequirementsCheck {
  experienceMet: '충족' | '미충족' | '판단 불가';
  reason: string;
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
  // AI 적합도 평가 결과
  minimumRequirementsCheck?: MinimumRequirementsCheck;
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
      minimumRequirementsCheck,
    }: RequestBody = await req.json();

    console.log("Generating tailored resume for:", companyName, jobTitle);
    console.log("Language:", language, "Format:", format);
    console.log("Experiences count:", experiences.length);
    console.log("Key competencies:", keyCompetencies.map((k) => k.title));
    console.log("Minimum requirements check:", minimumRequirementsCheck);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build competency evaluation section for prompt
    const competencyEvaluationSection = keyCompetencies
      .map((k, i) => {
        const scoreText = k.score !== undefined ? `(본인 평가: ${k.score}점/5점)` : '';
        const evalText = k.evaluation ? `\n   - AI 분석: ${k.evaluation}` : '';
        return `${i + 1}. ${k.title}: ${k.description} ${scoreText}${evalText}`;
      })
      .join("\n");

    // Build minimum requirements section
    const minReqSection = minimumRequirementsCheck
      ? `## 최소 자격 요건 검토 결과
- 경력 요건: ${minimumRequirementsCheck.experienceMet}
- 사유: ${minimumRequirementsCheck.reason}
`
      : '';

    // Identify weak and strong competencies
    const weakCompetencies = keyCompetencies.filter(k => k.score !== undefined && k.score <= 2);
    const strongCompetencies = keyCompetencies.filter(k => k.score !== undefined && k.score >= 4);

    const systemPrompt =
      language === "ko"
        ? `당신은 채용 담당자 관점까지 포함한 전문 이력서 작성 컨설턴트입니다. 주어진 채용 공고의 핵심 역량에 맞춰 지원자의 경험을 최적화하여 이력서를 작성합니다.

## 핵심 지시사항 (반드시 따를 것)
당신은 AI 적합도 평가 결과를 기반으로 이력서를 최적화해야 합니다:

1. **경험 순서 최적화**: 점수가 높은 역량(4-5점)과 관련된 경험을 이력서 상단에 배치하세요.
2. **약한 역량 보완**: 점수가 낮은 역량(1-2점)에 대해서는:
   - 관련 경험이 있다면 해당 부분을 더 강조해서 작성
   - 관련 경험이 부족하다면 유사한 경험에서 전이 가능한 스킬을 강조
3. **강한 역량 극대화**: 점수가 높은 역량은 구체적인 성과와 숫자를 포함하여 더욱 부각
4. **AI 분석 반영**: 각 역량에 대한 AI 분석 내용이 있다면 이를 참고하여 해당 경험 작성 시 반영
5. **최소 요건 미충족 시**: 최소 자격 요건이 미충족인 경우, 빠른 학습 능력/적응력/열정 등을 보여주는 경험을 강조

중요 규칙:
- 반드시 아래 마커를 그대로 사용해 출력하세요.
- 마커 밖에는 어떤 텍스트도 출력하지 마세요.
- 이력서 본문에 이모지를 절대 사용하지 마세요.

출력 형식(엄수):
===AI_FEEDBACK===
(여기에 피드백만)
===RESUME===
(여기에 이력서 본문만)

AI_FEEDBACK 작성 규칙(엄수):
- 반드시 아래 2개 섹션으로만 구성하세요.
  1) ## 종합 의견
  2) ## 세부 수정 의견
- 종합 의견에는 (중요! 아래 내용만 작성):
  * 이 공고에 대해 지원자의 역량이 어떻게 보이는지 (강점/약점 분석)
  * 어떤 점을 보완해야 하는지
  * 이력서에서 어떤 부분을 강조/수정했는지
  * "핵심 역량을 기준으로 최적화했습니다" 같은 기본 문구 절대 포함하지 말 것
- 세부 수정 의견에는: 수정 포인트를 항목별로 제시(가능하면 원문 대비 변경 이유 포함)
- 절대 없는 사실을 만들어내지 말 것(경험/성과 과장 금지)

RESUME 작성 규칙:
- 결과는 한국어로 작성.
- 이력서 본문에는 AI 피드백/조언 문구를 절대 포함하지 말 것.
- 이력서 본문에 이모지를 절대 사용하지 마세요 (예: ⚠, ✓, ★ 등 금지).
- 형식: ${format === "consulting" ? "컨설팅형(간결, 성과 중심)" : "서술형(국문형, 섹션 구분 명확)"}.`
        : `You are a professional resume consultant with a recruiter mindset. Optimize the candidate's experiences to match the key competencies required by the job posting.

## CRITICAL INSTRUCTIONS (Must Follow)
You must optimize the resume based on the AI fit evaluation results:

1. **Experience Order Optimization**: Place experiences related to high-scoring competencies (4-5 points) at the top.
2. **Weak Competency Compensation**: For low-scoring competencies (1-2 points):
   - If related experience exists, emphasize those parts more
   - If lacking experience, highlight transferable skills from similar experiences
3. **Strong Competency Maximization**: Highlight high-scoring competencies with specific achievements and numbers
4. **Reflect AI Analysis**: If AI analysis exists for each competency, incorporate it when writing relevant experiences
5. **If Minimum Requirements Not Met**: Emphasize experiences showing quick learning ability/adaptability/passion
6. **Native English Quality**: Write in fluent, natural English as a native speaker would. Avoid awkward phrasing, literal translations, or non-idiomatic expressions. Use strong action verbs and professional resume language.

CRITICAL RULES:
- You MUST output using the exact markers below.
- Do NOT output any text outside of the markers.
- Do NOT use emojis in the resume body.
- The resume MUST be written in professional, native-level English.

Output format (STRICT):
===AI_FEEDBACK===
(feedback only)
===RESUME===
(resume body only)

AI_FEEDBACK rules (STRICT):
- Use exactly these two sections:
  1) ## Overall Assessment
  2) ## Detailed Revision Notes
- Overall Assessment (IMPORTANT! Only include):
  * How the candidate's competencies appear for this specific job (strengths/weaknesses analysis)
  * What areas need improvement
  * What parts of the resume were emphasized/modified
  * Do NOT include generic phrases like "optimized based on key competencies"
- Detailed Revision Notes: itemized edits with rationale
- Never invent facts; no exaggeration

Additional rules:
- Write in fluent, natural English (native speaker quality).
- Review all expressions for natural phrasing - avoid awkward translations.
- Use strong action verbs (Led, Drove, Spearheaded, Orchestrated, etc.)
- The resume body must NOT contain feedback/advice text.
- Do NOT use emojis in the resume body (e.g., no ⚠, ✓, ★, etc.).
- Format: ${format === "consulting" ? "consulting-style (concise, results-driven)" : "narrative-style"}.`;

    const userPrompt =
      language === "ko"
        ? `## 채용 공고 정보
회사: ${companyName}
포지션: ${jobTitle}
요약: ${jobSummary}

${minReqSection}
## 핵심 요구 역량 (AI 적합도 평가 포함)
${competencyEvaluationSection}

${weakCompetencies.length > 0 ? `## 보완이 필요한 역량 (낮은 점수)
${weakCompetencies.map(k => `- ${k.title} (${k.score}점): ${k.evaluation || '관련 경험 부족'}`).join("\n")}
` : ''}
${strongCompetencies.length > 0 ? `## 강점 역량 (높은 점수)
${strongCompetencies.map(k => `- ${k.title} (${k.score}점): ${k.evaluation || '관련 경험 풍부'}`).join("\n")}
` : ''}
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
1) ===AI_FEEDBACK===에는:
- 약한 역량을 어떻게 보완했는지
- 강한 역량을 어떻게 부각했는지
- 경험 순서를 어떻게 최적화했는지
2) ===RESUME===에는 이력서 본문만 작성.

이력서 본문 작성 형식:
- ${format === "consulting" ? "간결한 섹션(Heading) + Bullet 위주" : "섹션(경력/프로젝트) 구분 + 각 섹션 내 Bullet"}
- 각 경험은 아래 형식을 따를 것:
[경험 제목]
[회사명] | [기간]
• bullet 1
• bullet 2
• bullet 3

중요: 이력서 본문에 이모지를 절대 사용하지 마세요.`
        : `## Job Posting Information
Company: ${companyName}
Position: ${jobTitle}
Summary: ${jobSummary}

${minReqSection}
## Key Required Competencies (with AI Fit Evaluation)
${competencyEvaluationSection}

${weakCompetencies.length > 0 ? `## Competencies Needing Improvement (Low Scores)
${weakCompetencies.map(k => `- ${k.title} (${k.score}/5): ${k.evaluation || 'Lacking related experience'}`).join("\n")}
` : ''}
${strongCompetencies.length > 0 ? `## Strong Competencies (High Scores)
${strongCompetencies.map(k => `- ${k.title} (${k.score}/5): ${k.evaluation || 'Rich related experience'}`).join("\n")}
` : ''}
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
1) In ===AI_FEEDBACK===:
- How you compensated for weak competencies
- How you highlighted strong competencies
- How you optimized the experience order
2) In ===RESUME===, write ONLY the resume body.

Resume body format:
- ${format === "consulting" ? "concise headings + bullets" : "sectioned narrative"}
- For each experience use:
[Experience Title]
[Company Name] | [Period]
• bullet 1
• bullet 2
• bullet 3

IMPORTANT: Do NOT use emojis in the resume body.`;

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
