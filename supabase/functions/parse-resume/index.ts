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
    const { fileName, resumeId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // In a real implementation, we would:
    // 1. Get the file from storage
    // 2. Extract text from PDF
    // 3. Send to AI for parsing
    
    // For now, return a simulated response
    // TODO: Implement actual PDF parsing with storage integration
    
    const systemPrompt = `You are a resume parser. Extract work experiences and projects from the resume.
    
Return a JSON object with:
- experiences: array of objects with:
  - type: "work" or "project"
  - title: job title or project name
  - company: company name (for work) or organization (for project)
  - description: brief description
  - bullets: array of key achievements/responsibilities

Always respond in Korean.`;

    // Simulated parsed experiences for demo
    const experiences = [
      {
        type: 'work',
        title: '시니어 개발자',
        company: '분석된 회사명',
        description: '이력서에서 추출된 설명',
        bullets: [
          '주요 성과 1',
          '주요 성과 2',
          '주요 성과 3',
        ],
      },
    ];

    return new Response(
      JSON.stringify({ success: true, experiences }),
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
