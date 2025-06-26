
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
    const { systemPrompt, userPrompt, model = 'gpt-4o' } = await req.json();

    console.log('🔥 PDF內容深度分析出題請求');
    console.log('模型:', model);
    console.log('系統提示長度:', systemPrompt?.length || 0);
    console.log('用戶提示預覽:', userPrompt?.substring(0, 100) + '...');

    if (!openAIApiKey) {
      console.error('❌ OpenAI API 金鑰未設定');
      throw new Error('OpenAI API 金鑰未配置');
    }

    const questionCount = parseInt(userPrompt.match(/(\d+)\s*道/)?.[1] || '5');
    console.log('📊 預計生成題目數量:', questionCount);
    
    const maxTokens = Math.min(12000, questionCount * 800);
    console.log('🔧 設定最大tokens:', maxTokens);

    // 使用更直接的 API 呼叫，移除複雜的錯誤處理邏輯
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
        max_tokens: maxTokens,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API 錯誤:', response.status, errorText);
      throw new Error(`API請求失敗：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI 回應接收成功');
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('❌ OpenAI 回應格式異常:', JSON.stringify(data, null, 2));
      throw new Error('AI回應內容為空或格式錯誤');
    }

    let generatedText = data.choices[0].message.content.trim();
    console.log('📝 生成內容長度:', generatedText.length);
    console.log('📝 生成內容預覽:', generatedText.substring(0, 200));

    // 簡化 JSON 處理
    generatedText = cleanAndExtractJSON(generatedText);

    let questions;
    try {
      questions = JSON.parse(generatedText);
      console.log('✅ JSON 解析成功，題目數量:', Array.isArray(questions) ? questions.length : 1);
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError.message);
      console.error('❌ 原始內容:', generatedText.substring(0, 500));
      
      // 嘗試基本修復
      const repairedJson = repairJSON(generatedText);
      try {
        questions = JSON.parse(repairedJson);
        console.log('✅ JSON 修復成功');
      } catch (repairError) {
        console.error('❌ JSON 修復失敗:', repairError.message);
        throw new Error('AI生成的內容格式無法解析，請重新嘗試');
      }
    }

    // 確保是陣列格式
    if (!Array.isArray(questions)) {
      questions = [questions];
    }

    console.log('📊 最終題目數量:', questions.length);

    return new Response(JSON.stringify({ generatedText: JSON.stringify(questions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 處理錯誤:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function cleanAndExtractJSON(text: string): string {
  // 移除 markdown 標記
  text = text.replace(/```json\s*/gi, '');
  text = text.replace(/```\s*/g, '');
  text = text.replace(/`{1,3}/g, '');
  
  // 尋找 JSON 結構
  let jsonStart = text.indexOf('[');
  let jsonEnd = text.lastIndexOf(']');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    jsonStart = text.indexOf('{');
    jsonEnd = text.lastIndexOf('}');
  }

  if (jsonStart !== -1 && jsonEnd !== -1) {
    return text.substring(jsonStart, jsonEnd + 1);
  }

  return text;
}

function repairJSON(jsonString: string): string {
  let repaired = jsonString;
  
  // 修復結尾缺少括號
  if (repaired.startsWith('[') && !repaired.endsWith(']')) {
    repaired += ']';
  }
  
  if (repaired.startsWith('{') && !repaired.endsWith('}')) {
    repaired += '}';
  }
  
  return repaired;
}
