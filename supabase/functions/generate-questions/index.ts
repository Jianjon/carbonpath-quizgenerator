
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { systemPrompt, userPrompt, pdfContent, model = 'gpt-4o-mini' } = await req.json();

    console.log('🔥 收到AI題目生成請求');
    console.log('模型:', model);
    console.log('PDF內容長度:', pdfContent?.length || 0);

    if (!openAIApiKey) {
      throw new Error('OpenAI API 金鑰未設定');
    }

    if (!pdfContent || pdfContent.length < 50) {
      throw new Error('PDF內容不足，無法生成題目');
    }

    console.log('🤖 呼叫OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 3000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API 錯誤:', response.status, errorText);
      throw new Error(`OpenAI API 錯誤: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI 回應成功');
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('OpenAI 回應內容為空');
    }

    const generatedText = data.choices[0].message.content.trim();
    console.log('📝 生成的內容長度:', generatedText.length);

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 處理錯誤:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : '未知錯誤'
    }), {
      status: 200, // 保持200狀態以便前端處理
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
