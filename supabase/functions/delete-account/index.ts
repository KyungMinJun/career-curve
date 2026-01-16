import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the user's JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "로그인이 필요합니다. 다시 로그인한 뒤 재시도해주세요." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the JWT token from "Bearer <token>"
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "인증 정보가 없습니다. 다시 로그인한 뒤 재시도해주세요." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client to verify the token and get user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from the JWT token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "사용자 인증에 실패했습니다. 다시 로그인해주세요." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Deleting user:", user.id, user.email);

    // Delete user's profile first (if exists)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", user.id);

    if (profileError) {
      console.error("Error deleting profile:", profileError);
      // Continue anyway, profile might not exist
    }

    // Delete the user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(
        JSON.stringify({ error: "계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User deleted successfully:", user.id);

    return new Response(
      JSON.stringify({ success: true, message: "계정이 정상적으로 삭제되었습니다." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-account:", error);
    const fallbackMessage = "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    const safeMessage =
      error instanceof Error && /[가-힣]/.test(error.message) ? error.message : fallbackMessage;
    return new Response(
      JSON.stringify({ error: safeMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
