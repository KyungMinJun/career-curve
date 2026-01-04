import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const keyCompetencySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  score: z.number().min(1).max(5).optional(),
  evaluation: z.string().max(2000).optional(),
});

const experienceSchema = z.object({
  id: z.string().max(100).optional(),
  type: z.enum(['work', 'project']),
  title: z.string().min(1).max(300),
  company: z.string().max(200).optional(),
  period: z.string().max(100).optional(),
  description: z.string().max(5000).default(''),
  bullets: z.array(z.string().max(1000)).max(20).default([]),
});

const requestSchema = z.object({
  keyCompetencies: z.array(keyCompetencySchema).min(1).max(10),
  experiences: z.array(experienceSchema).min(1).max(50),
  minExperience: z.string().max(200).optional().nullable(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Atomic credit check and deduction (prevents race condition)
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('ai_credits_remaining, ai_credits_used')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      console.error('Subscription fetch error:', subError);
      return new Response(
        JSON.stringify({ success: false, error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (subscription.ai_credits_remaining < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient AI credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optimistic concurrency control - only update if credits haven't changed
    const { error: creditError, count: updatedCount } = await supabaseClient
      .from('user_subscriptions')
      .update({
        ai_credits_remaining: subscription.ai_credits_remaining - 1,
        ai_credits_used: (subscription.ai_credits_used || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('ai_credits_remaining', subscription.ai_credits_remaining);

    if (creditError || updatedCount === 0) {
      console.error('Credit deduction failed (race condition):', creditError);
      return new Response(
        JSON.stringify({ success: false, error: 'Credit deduction failed. Please try again.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI credit deducted successfully');

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = requestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid input data',
          details: validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keyCompetencies, experiences, minExperience } = validationResult.data;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const experiencesSummary = experiences.map((exp: any) => 
      `[${exp.type === 'work' ? '경력' : '프로젝트'}] ${exp.title}${exp.company ? ` @ ${exp.company}` : ''}${exp.period ? ` (${exp.period})` : ''}\n${exp.description || ''}\n${exp.bullets?.join('\n') || ''}`
    ).join('\n\n');

    const competenciesList = keyCompetencies.map((c: any, i: number) => 
      `${i + 1}. ${c.title}: ${c.description}`
    ).join('\n');

    const systemPrompt = `You are a STRICT and REALISTIC career evaluator simulating an actual hiring manager reviewing resumes.

Your evaluation standards MUST be harsh and realistic:
- Score 5: ONLY if the candidate has DIRECT, RECENT experience doing exactly this skill at a similar or higher level
- Score 4: Strong related experience, but not exact match OR experience is from 5+ years ago
- Score 3: Some transferable skills, but significant gap between candidate's experience and job requirement
- Score 2: Minimal relevant experience, would need significant training/ramp-up
- Score 1: No relevant experience at all

IMPORTANT SCORING GUIDELINES:
- Most candidates should average between 2-3.5. A score of 4+ should be rare.
- If the candidate's experience doesn't DIRECTLY match the competency, maximum score is 3
- Consider recency: old experience (5+ years) should be downgraded by 1 point
- Be skeptical: general skills don't count as evidence for specific competencies
- Always point out gaps honestly - this helps candidates improve their applications

For each competency, provide:
1. A realistic score from 1-5 using the strict criteria above
2. A brief, honest evaluation in Korean explaining the gap or match (2-3 sentences)
3. Specific evidence from their experience, or note the lack thereof

Also, evaluate minimum requirements check (최소 조건 충족 여부):
- Calculate total relevant work experience in YEARS from their employment history
- Add up all period durations and provide a simple result
- Your response for minimum requirements must be CONCISE:
  * Just state: "총 경력 X년 Y개월 → [충족/미충족/판단 불가]"
  * Only add clarification if specific periods are unclear (e.g., "2023년 1월~현재" 기간 계산 시 현재 시점 가정)
  * Do NOT write long explanations about each job's duration
- Be strict: only count directly relevant work experience, not projects or unrelated jobs

Always respond in Korean.`;

    const userPrompt = `공고에서 요구하는 최소 경력: ${minExperience || '정보 없음'}

공고에서 요구하는 5가지 핵심 역량:
${competenciesList}

지원자의 경험:
${experiencesSummary}

1. 먼저 최소 경력 조건 충족 여부를 판단해주세요 (충족/미충족/판단 불가).
2. 각 역량에 대해 지원자의 적합도를 평가해주세요.`;

    console.log('Evaluating fit with AI');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "evaluate_fit",
              description: "Evaluate candidate's minimum requirements and competency fit",
              parameters: {
                type: "object",
                properties: {
                  minimumRequirements: {
                    type: "object",
                    properties: {
                      experienceMet: { type: "string", enum: ["충족", "미충족", "판단 불가"], description: "Whether minimum experience requirement is met" },
                      reason: { type: "string", description: "Brief explanation in Korean" }
                    },
                    required: ["experienceMet", "reason"]
                  },
                  evaluations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        competencyIndex: { type: "number", description: "0-based index of the competency" },
                        score: { type: "number", description: "Score 1-5" },
                        evaluation: { type: "string", description: "Evaluation comment in Korean" }
                      },
                      required: ["competencyIndex", "score", "evaluation"]
                    }
                  }
                },
                required: ["minimumRequirements", "evaluations"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "evaluate_fit" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    let evaluations: any[] = [];
    let minimumRequirements = { experienceMet: "판단 불가", reason: "평가 실패" };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        evaluations = parsed.evaluations || [];
        minimumRequirements = parsed.minimumRequirements || minimumRequirements;
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }

    // Map evaluations back to competencies
    const evaluatedCompetencies = keyCompetencies.map((comp: any, idx: number) => {
      const evaluation = evaluations.find((e: any) => e.competencyIndex === idx);
      return {
        ...comp,
        score: evaluation?.score || comp.score || 0,
        evaluation: evaluation?.evaluation || comp.evaluation || ''
      };
    });

    return new Response(
      JSON.stringify({ success: true, evaluatedCompetencies, minimumRequirements }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error evaluating fit:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});