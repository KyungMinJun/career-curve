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
    const { keyCompetencies, experiences } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!keyCompetencies?.length || !experiences?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing competencies or experiences' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const experiencesSummary = experiences.map((exp: any) => 
      `[${exp.type === 'work' ? '경력' : '프로젝트'}] ${exp.title}${exp.company ? ` @ ${exp.company}` : ''}\n${exp.description || ''}\n${exp.bullets?.join('\n') || ''}`
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

Always respond in Korean.`;

    const userPrompt = `공고에서 요구하는 5가지 핵심 역량:
${competenciesList}

지원자의 경험:
${experiencesSummary}

각 역량에 대해 지원자의 적합도를 평가해주세요.`;

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
              name: "evaluate_competencies",
              description: "Evaluate candidate fit for each competency",
              parameters: {
                type: "object",
                properties: {
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
                required: ["evaluations"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "evaluate_competencies" } }
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
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        evaluations = parsed.evaluations || [];
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
      JSON.stringify({ success: true, evaluatedCompetencies }),
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
