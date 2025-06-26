
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { systemPrompt, userPrompt, model = 'gpt-4o' } = await req.json();

    console.log('Generating questions with:', { model, systemPrompt: systemPrompt.substring(0, 100) + '...', userPrompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API 請求失敗：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received:', data.choices?.[0]?.message?.content?.substring(0, 200) + '...');
    
    const generatedText = data.choices[0].message.content;

    // 清理回應內容，移除可能的 HTML 標籤或非 JSON 內容
    let cleanedText = generatedText.trim();
    
    // 如果回應包含 HTML 或其他非 JSON 內容，嘗試提取 JSON 部分
    if (cleanedText.includes('<!DOCTYPE') || cleanedText.includes('<html>')) {
      console.error('Response contains HTML content:', cleanedText.substring(0, 500));
      throw new Error('AI 回應包含非預期的 HTML 內容，請重新嘗試');
    }

    // 尋找 JSON 陣列的開始和結束
    const jsonStart = cleanedText.indexOf('[');
    const jsonEnd = cleanedText.lastIndexOf(']') + 1;
    
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd);
    } else {
      // 如果找不到陣列，嘗試尋找單個物件
      const objStart = cleanedText.indexOf('{');
      const objEnd = cleanedText.lastIndexOf('}') + 1;
      
      if (objStart !== -1 && objEnd > objStart) {
        cleanedText = cleanedText.substring(objStart, objEnd);
        // 如果是單個物件，包裝成陣列
        cleanedText = `[${cleanedText}]`;
      }
    }

    console.log('Cleaned response for parsing:', cleanedText.substring(0, 200) + '...');

    // 嘗試解析 JSON
    let questions;
    try {
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Failed to parse content:', cleanedText.substring(0, 500));
      throw new Error(`無法解析 AI 回應為 JSON 格式：${parseError.message}`);
    }

    // 確保回應是陣列格式
    if (!Array.isArray(questions)) {
      questions = [questions];
    }

    console.log('Successfully parsed questions:', questions.length);

    return new Response(JSON.stringify({ generatedText: JSON.stringify(questions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-questions function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '生成題目時發生未知錯誤'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
