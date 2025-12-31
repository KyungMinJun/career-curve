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
당신은 AI 적합도 평가 결과를 기반으로 이력서를 **실제로 수정**해야 합니다:

1. **경력 순서는 시간순으로 유지**: 경력(Work Experience)은 최근→과거 순으로 배치합니다. 순서 변경 불가.
2. **프로젝트(Selected Projects) 순서 조정**: 공고와 관련도가 높은 프로젝트를 상단에 배치합니다.
   - **중요**: 순서를 변경한 경우, AI 피드백의 "프로젝트 순서 조정" 섹션에서 **반드시** 다음을 명시하세요:
     * 원래 순서 → 변경된 순서
     * 각 프로젝트가 해당 위치에 배치된 이유 (어떤 핵심 역량/요구사항과 관련있는지)
3. **bullet point 내용 수정/강화**: 
   - 원본 bullet을 **반드시 다르게 작성**하세요.
   - 핵심 역량과 관련된 키워드, 수치, 성과를 **추가**하거나 **강조**하세요.
   - 예: "프로젝트 관리" → "5명 팀을 이끌어 3개월 내 프로젝트 완료율 95% 달성"
4. **약한 역량 보완**: 점수가 낮은 역량(1-2점)에 대해:
   - 유사 경험에서 전이 가능한 스킬을 **명시적으로 언급**
   - "~을 통해 ~역량을 개발" 형태로 연결 문구 추가
5. **강한 역량 극대화**: 점수가 높은 역량은 **구체적 숫자와 결과**를 포함
6. **원본과 동일하면 안 됨**: 피드백에서 언급한 수정사항이 이력서 본문에 **실제로 반영**되어야 합니다.

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
- 반드시 아래 4개 섹션으로 구성하세요:
  1) ## 종합 의견
  2) ## 역량 분석
  3) ## 프로젝트 순서 조정
  4) ## 세부 수정 내용
- "## 종합 의견"은 **절대 중복 출력하지 마세요**. 한 번만 작성합니다.
- **중요**: AI 적합도 평가에서 낮은 점수(1-2점)를 받은 역량이 있다면, 종합 의견에서 **객관적으로 약점을 언급**해야 합니다. 무조건 긍정적인 피드백은 금지입니다.
- **매우 중요**: "## 종합 의견" 섹션은 반드시 **한국어로** 작성하세요. 공고 언어(영어/한국어)와 무관하게 종합 의견은 항상 한국어입니다.
- 종합 의견에는 (한국어로):
  * 이 공고에 대한 지원자 적합도 (전반적인 강점/약점 - 적합도 평가 점수 기반)
  * 부족한 역량과 그것이 채용에 미칠 수 있는 영향
  * 강조할 핵심 포인트와 약점을 보완하기 위한 전략
- 역량 분석에는:
  * 각 핵심 역량별 지원자 강점/약점 분석 (AI 평가 점수 반영)
  * 부족한 역량을 어떻게 보완했는지 (또는 보완이 어려운 경우 그 한계)
- **프로젝트 순서 조정에는** (필수):
  * 프로젝트 순서를 변경했다면: "원래 순서: A, B, C → 변경된 순서: B, A, C"
  * 각 프로젝트 배치 이유: "프로젝트 B를 1순위로 배치한 이유: [핵심 역량 X]와 직접적으로 연관된 [구체적 근거]"
  * 순서를 변경하지 않았다면: "기존 순서 유지 - 이유: [설명]"
- 세부 수정 내용에는:
  * **원문 → 수정본** 형태로 구체적 변경 사항 나열
  * 예: "'프로젝트 진행' → '5명 팀을 리드하여 신규 기능 출시, MAU 30% 증가'"
- 절대 없는 사실을 만들어내지 말 것(경험/성과 과장 금지)

RESUME 작성 규칙:
- 결과는 한국어로 작성.
- 이력서 본문에는 AI 피드백/조언 문구를 절대 포함하지 말 것.
- 이력서 본문에 이모지를 절대 사용하지 마세요 (예: ⚠, ✓, ★ 등 금지).
- **원본 bullet point를 그대로 복사하지 말고, 개선된 버전으로 작성**
- 형식: ${format === "consulting" ? "컨설팅형(간결, 성과 중심)" : "서술형(국문형, 섹션 구분 명확)"}.`
        : `You are a professional resume consultant with a recruiter mindset. **Actually rewrite and improve** the candidate's experiences to match the key competencies required by the job posting.

## CRITICAL INSTRUCTIONS (Must Follow)
You must **actively modify** the resume based on the AI fit evaluation results:

1. **Keep Work Experience in Chronological Order**: Work experiences MUST remain in reverse chronological order (most recent first). This order CANNOT be changed.
2. **Reorder Selected Projects Based on Relevance**: You may reorder projects based on relevance to the job posting.
   - **IMPORTANT**: If you change the order, you MUST explain in the "Project Order Adjustments" section:
     * Original order → New order
     * Why each project is placed in that position (which competency/requirement it addresses)
3. **Rewrite Bullet Points**: 
   - **DO NOT copy original bullets verbatim.** 
   - Add specific metrics, keywords aligned with job requirements, and quantified achievements.
   - Example: "Managed projects" → "Led cross-functional team of 5 to deliver product launch 2 weeks ahead of schedule, increasing user engagement by 40%"
4. **Weak Competency Compensation**: For low-scoring competencies (1-2 points):
   - Explicitly mention transferable skills from related experiences
   - Add phrases connecting experiences to the weak competency
5. **Strong Competency Maximization**: Include specific numbers, percentages, and measurable outcomes
6. **Native English Quality**: Write in fluent, natural English as a native speaker would. Use strong action verbs (Led, Drove, Spearheaded, Orchestrated, etc.)
7. **IMPORTANT**: The final resume MUST be noticeably different from the original - improved and tailored.

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
- Use exactly these four sections:
  1) ## 종합 의견 (MUST BE IN KOREAN)
  2) ## Competency Analysis
  3) ## Project Order Adjustments
  4) ## Detailed Revisions
- "## 종합 의견" must appear **ONLY ONCE**. Do not duplicate this heading.
- **CRITICAL**: The "## 종합 의견" section MUST be written in **Korean language** regardless of the job posting language. This is non-negotiable.
- **IMPORTANT**: If the AI fit evaluation shows low scores (1-2 points) for any competency, you MUST objectively mention the weakness in the 종합 의견. Do NOT be overly positive. Be honest about gaps.
- 종합 의견 (in Korean):
  * 이 공고에 대한 지원자 적합도 (강점/약점 - 적합도 평가 점수 기반)
  * 부족한 역량과 채용에 미칠 수 있는 영향
  * 강조할 핵심 포인트와 약점 보완 전략
- Competency Analysis:
  * Strength/weakness analysis for each key competency (reflect AI evaluation scores)
  * How weak competencies were compensated (or limitations if compensation is difficult)
- **Project Order Adjustments** (REQUIRED):
  * If order was changed: "Original order: A, B, C → New order: B, A, C"
  * Reason for each placement: "Project B placed first because: [specific connection to competency X]"
  * If order was not changed: "Original order maintained - Reason: [explanation]"
- Detailed Revisions:
  * Show **"Original → Revised"** format for each change
  * Example: "'Worked on data analysis' → 'Analyzed 50K+ user behavior data points to identify churn patterns, reducing churn rate by 15%'"
- Never invent facts; no exaggeration

Additional rules:
- Write in fluent, natural English (native speaker quality).
- **Do NOT copy original bullet points verbatim - rewrite them with improvements**
- Use strong action verbs throughout
- The resume body must NOT contain feedback/advice text.
- Do NOT use emojis in the resume body.
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
- **프로젝트 순서를 어떻게 조정했는지와 그 이유** (필수! "원래 순서 → 변경된 순서" 및 각 배치 이유 명시)
2) ===RESUME===에는 이력서 본문만 작성.

## 표준 이력서 형식 (반드시 따를 것)
아래 형식을 정확히 따라 작성하세요:

---
[지원자 이름]

## 경력 요약
(2-3문장으로 핵심 역량과 경력 요약)

## 경력 사항
각 경력은 아래 형식:
**[직책/역할]**
[회사명] | [기간]
• 성과/업무 1
• 성과/업무 2
• 성과/업무 3

## 프로젝트 (해당 시)
**[프로젝트명]**
[기간]
• 주요 성과 1
• 주요 성과 2

## 기술 및 역량
• 기술1, 기술2, 기술3
---

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
- **How you adjusted project order and WHY** (REQUIRED! Show "Original order → New order" and reason for each placement)
2) In ===RESUME===, write ONLY the resume body.

## STANDARD RESUME FORMAT (Must Follow)
Use this exact structure:

---
[Candidate Name]

## Professional Summary
(2-3 sentences summarizing core competencies and experience)

## Work Experience
For each position use:
**[Job Title]**
[Company Name] | [Period]
• Achievement/responsibility 1
• Achievement/responsibility 2
• Achievement/responsibility 3

## Projects (if applicable)
**[Project Name]**
[Period]
• Key achievement 1
• Key achievement 2

## Skills & Competencies
• Skill1, Skill2, Skill3
---

IMPORTANT: Do NOT use emojis in the resume body.`;

    const model = language === "en" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
