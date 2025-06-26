
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

    console.log('🔥 AI題目生成請求');
    console.log('模型:', model);
    console.log('PDF內容長度:', pdfContent?.length || 0);

    if (!openAIApiKey) {
      console.error('❌ OpenAI API 金鑰未設定');
      throw new Error('OpenAI API 金鑰未配置');
    }

    if (!pdfContent || pdfContent.length < 100) {
      console.error('❌ PDF內容不足:', pdfContent?.length || 0);
      throw new Error('PDF內容不足，無法生成有意義的題目');
    }

    // 構建完整的AI提示
    const fullSystemPrompt = `${systemPrompt}

**絕對禁止：**
- 不可使用PDF內容以外的任何知識
- 不可創造PDF中不存在的概念
- 不可使用一般常識或背景知識

**必須遵守：**
- 每個題目都必須有明確的PDF內容依據
- 選項必須來自PDF實際內容
- 解析必須引用PDF具體段落

請確保生成的JSON格式完全正確。`;

    console.log('🤖 發送請求到OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 6000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API 錯誤:', response.status, errorText);
      throw new Error(`OpenAI API 錯誤：${response.status}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI 回應成功');
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('❌ OpenAI 回應格式異常');
      throw new Error('AI回應內容為空');
    }

    let generatedText = data.choices[0].message.content.trim();
    console.log('📝 原始生成內容長度:', generatedText.length);

    // 清理JSON
    generatedText = cleanJSON(generatedText);
    console.log('🔧 清理後內容長度:', generatedText.length);

    // 驗證JSON
    let questions;
    try {
      questions = JSON.parse(generatedText);
      console.log('✅ JSON 解析成功');
      
      if (!Array.isArray(questions)) {
        questions = [questions];
      }
      
      console.log('📊 題目數量:', questions.length);
      
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError);
      console.error('❌ 內容:', generatedText.substring(0, 500));
      
      // 嘗試修復JSON
      try {
        const repairedJson = repairJSON(generatedText);
        questions = JSON.parse(repairedJson);
        console.log('✅ JSON 修復成功');
      } catch (repairError) {
        console.error('❌ JSON 修復失敗:', repairError);
        throw new Error('AI生成的內容格式無法解析');
      }
    }

    if (!questions || questions.length === 0) {
      throw new Error('未能生成有效題目');
    }

    console.log('🎉 題目生成完成，數量:', questions.length);

    return new Response(JSON.stringify({ generatedText: JSON.stringify(questions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 處理錯誤:', error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : '系統錯誤',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// 清理JSON
function cleanJSON(text: string): string {
  console.log('🧹 開始清理JSON...');
  
  // 移除markdown標記
  text = text.replace(/```json\s*/gi, '');
  text = text.replace(/```\s*/g, '');
  text = text.replace(/`{1,3}/g, '');
  
  // 尋找JSON部分
  let jsonStart = text.indexOf('[');
  let jsonEnd = text.lastIndexOf(']');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    jsonStart = text.indexOf('{');
    jsonEnd = text.lastIndexOf('}');
  }

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    const extracted = text.substring(jsonStart, jsonEnd + 1);
    console.log('🎯 提取JSON成功:', extracted.length, '字符');
    return extracted;
  }

  console.log('⚠️ 無法找到JSON結構，返回原始內容');
  return text;
}

// 修復JSON
function repairJSON(jsonString: string): string {
  console.log('🔧 嘗試修復JSON...');
  
  let repaired = jsonString.trim();
  
  // 基本修復
  if (repaired.startsWith('[') && !repaired.endsWith(']')) {
    repaired += ']';
  }
  
  if (repaired.startsWith('{') && !repaired.endsWith('}')) {
    repaired += '}';
  }
  
  // 移除多餘逗號
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
  
  console.log('🔧 修復完成');
  return repaired;
}
