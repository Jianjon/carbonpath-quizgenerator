
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
    const { systemPrompt, userPrompt, pdfContent, model = 'gpt-4o' } = await req.json();

    console.log('🔥 AI題目生成請求');
    console.log('模型:', model);
    console.log('PDF內容長度:', pdfContent?.length || 0);
    console.log('PDF內容預覽:', pdfContent?.substring(0, 150) || '無內容');

    if (!openAIApiKey) {
      console.error('❌ OpenAI API 金鑰未設定');
      throw new Error('OpenAI API 金鑰未配置');
    }

    if (!pdfContent || pdfContent.length < 50) {
      console.error('❌ PDF內容不足:', pdfContent?.length || 0);
      throw new Error('PDF內容不足，無法生成有意義的題目');
    }

    // 構建完整的AI提示
    const fullSystemPrompt = `${systemPrompt}

**重要提醒：**
- 你必須嚴格基於提供的PDF內容生成題目
- 不可使用PDF內容以外的任何知識
- 每個題目都要能在PDF內容中找到依據
- 解析必須引用PDF中的具體內容

請確保生成的JSON格式完全正確，不要有任何格式錯誤。`;

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
        temperature: 0.3, // 降低隨機性，提高一致性
        max_tokens: 6000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API 錯誤:', response.status, errorText);
      throw new Error(`OpenAI API 錯誤：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI 回應成功');
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('❌ OpenAI 回應格式異常');
      throw new Error('AI回應內容為空');
    }

    let generatedText = data.choices[0].message.content.trim();
    console.log('📝 原始生成內容長度:', generatedText.length);

    // 清理和提取JSON
    generatedText = cleanAndExtractJSON(generatedText);
    console.log('🔧 清理後內容長度:', generatedText.length);
    console.log('🔧 清理後內容預覽:', generatedText.substring(0, 200));

    // 驗證JSON格式
    let questions;
    try {
      questions = JSON.parse(generatedText);
      console.log('✅ JSON 解析成功');
      
      if (!Array.isArray(questions)) {
        questions = [questions];
      }
      
      console.log('📊 題目數量:', questions.length);
      
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError.message);
      console.error('❌ 內容:', generatedText.substring(0, 300));
      
      // 嘗試修復JSON
      try {
        const repairedJson = repairJSON(generatedText);
        questions = JSON.parse(repairedJson);
        console.log('✅ JSON 修復成功');
      } catch (repairError) {
        console.error('❌ JSON 修復也失敗:', repairError.message);
        throw new Error('AI生成的內容格式無法解析，請重新嘗試');
      }
    }

    // 最終驗證
    if (!questions || questions.length === 0) {
      throw new Error('未能生成有效題目，請重新嘗試');
    }

    console.log('🎉 題目生成完成，數量:', questions.length);

    return new Response(JSON.stringify({ generatedText: JSON.stringify(questions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 處理錯誤:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200, // 保持200狀態避免前端錯誤處理問題
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// 清理和提取JSON的函數
function cleanAndExtractJSON(text: string): string {
  console.log('🧹 開始清理JSON...');
  
  // 移除markdown標記
  text = text.replace(/```json\s*/gi, '');
  text = text.replace(/```\s*/g, '');
  text = text.replace(/`{1,3}/g, '');
  
  // 移除前後的說明文字，只保留JSON部分
  let jsonStart = text.indexOf('[');
  let jsonEnd = text.lastIndexOf(']');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    jsonStart = text.indexOf('{');
    jsonEnd = text.lastIndexOf('}');
  }

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    const extracted = text.substring(jsonStart, jsonEnd + 1);
    console.log('🎯 提取的JSON:', extracted.length, '字符');
    return extracted;
  }

  console.log('⚠️ 無法找到完整JSON結構，返回原始內容');
  return text;
}

// 修復JSON的函數
function repairJSON(jsonString: string): string {
  console.log('🔧 嘗試修復JSON...');
  
  let repaired = jsonString.trim();
  
  // 基本的括號修復
  if (repaired.startsWith('[') && !repaired.endsWith(']')) {
    repaired += ']';
    console.log('🔧 補充結尾 ]');
  }
  
  if (repaired.startsWith('{') && !repaired.endsWith('}')) {
    repaired += '}';
    console.log('🔧 補充結尾 }');
  }
  
  // 移除最後可能多餘的逗號
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
  
  console.log('🔧 修復完成');
  return repaired;
}
