import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '로그인이 필요합니다. 다시 로그인한 뒤 재시도해주세요.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get the user from the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ success: false, error: '인증이 만료되었습니다. 다시 로그인해주세요.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the user is an admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ success: false, error: '접근 권한이 없습니다. 관리자 계정으로 다시 시도해주세요.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all users from auth.users with pagination
    // listUsers returns max 1000 per page, we need to fetch all pages
    const userEmailMap: Record<string, string> = {};
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      console.log(`Fetching users page ${page}...`);
      const { data: { users: authUsers }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (usersError) {
        throw new Error('사용자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }

      console.log(`Page ${page}: fetched ${authUsers?.length || 0} users`);
      
      // Add users to map
      for (const user of authUsers || []) {
        userEmailMap[user.id] = user.email || user.phone || 'N/A';
      }
      
      // If we got fewer users than perPage, we've reached the last page
      if (!authUsers || authUsers.length < perPage) {
        break;
      }
      
      page++;
    }
    
    console.log(`Total users fetched: ${Object.keys(userEmailMap).length}`);

    return new Response(
      JSON.stringify({ success: true, userEmailMap }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Admin users error:', error);
    const fallbackMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    const errorMessage =
      error instanceof Error && /[가-힣]/.test(error.message) ? error.message : fallbackMessage;
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
