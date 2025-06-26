
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { method, userId, serviceName, apiKey } = await req.json();

    if (method === 'GET') {
      // 獲取 API 密鑰
      const { data, error } = await supabaseClient
        .from('api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('service_name', serviceName)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return new Response(JSON.stringify({ apiKey: data?.api_key || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      // 儲存或更新 API 密鑰
      const { data: existing } = await supabaseClient
        .from('api_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('service_name', serviceName)
        .single();

      if (existing) {
        await supabaseClient
          .from('api_keys')
          .update({ 
            api_key: apiKey, 
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .eq('service_name', serviceName);
      } else {
        await supabaseClient
          .from('api_keys')
          .insert({
            user_id: userId,
            service_name: serviceName,
            api_key: apiKey
          });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Error in manage-api-keys function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
