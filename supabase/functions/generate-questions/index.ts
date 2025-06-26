
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

    const questionCount = parseInt(userPrompt.match(/(\d+)\s*道/)?.[1] || '10');
    console.log('📊 預計生成題目數量:', questionCount);
    
    // 根據題目數量調整token限制
    let maxTokens = 8000;
    if (questionCount > 15) {
      maxTokens = 12000;
    } else if (questionCount > 10) {
      maxTokens = 10000;
    }
    
    console.log('🔧 設定最大tokens:', maxTokens);

    // 使用更穩定的GPT-4o模型，提高內容理解能力
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
        temperature: 0.2, // 稍微提高創造性，但仍保持準確性
        max_tokens: maxTokens,
        top_p: 0.9, // 增加回應多樣性
        frequency_penalty: 0.2, // 減少重複內容
        presence_penalty: 0.3, // 鼓勵新內容
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API 錯誤:', response.status, errorText);
      
      // 詳細的錯誤處理
      if (response.status === 429) {
        throw new Error('API請求次數過多，請稍後再試');
      } else if (response.status === 401) {
        throw new Error('API金鑰無效或過期，請檢查設定');
      } else if (response.status === 403) {
        throw new Error('API權限不足，請檢查帳戶狀態');
      } else if (response.status === 404) {
        console.log('🔄 模型不可用，自動切換到 gpt-4o');
        // 自動切換到穩定模型
        const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: maxTokens,
            top_p: 0.9,
            frequency_penalty: 0.2,
            presence_penalty: 0.3,
          }),
        });
        
        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.text();
          console.error('❌ 備用模型也失敗:', fallbackResponse.status, fallbackError);
          throw new Error(`API請求失敗：${fallbackResponse.status}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        console.log('✅ 備用模型回應成功');
        return await processResponse(fallbackData, questionCount);
      }
      
      throw new Error(`API請求失敗：${response.status}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI 回應接收成功');
    
    return await processResponse(data, questionCount);
    
  } catch (error) {
    console.error('💥 處理錯誤:', error.message);
    console.error('💥 錯誤堆疊:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      technical_details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 200, // 使用200狀態碼，讓前端處理
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// 處理API回應的函數
async function processResponse(data: any, questionCount: number) {
  if (!data.choices?.[0]?.message?.content) {
    console.error('❌ OpenAI 回應格式異常:', JSON.stringify(data, null, 2));
    throw new Error('AI回應內容為空或格式錯誤');
  }

  let generatedText = data.choices[0].message.content.trim();
  console.log('📝 生成內容長度:', generatedText.length);
  console.log('📝 生成內容預覽:', generatedText.substring(0, 300));

  // 檢查是否被截斷
  if (data.choices[0].finish_reason === 'length') {
    console.warn('⚠️ 回應被截斷，嘗試修復JSON');
  }

  // 更強大的JSON提取和修復
  generatedText = cleanAndExtractJSON(generatedText);

  let questions;
  try {
    questions = JSON.parse(generatedText);
    console.log('✅ JSON 解析成功');
    
  } catch (parseError) {
    console.error('❌ JSON 解析失敗，嘗試修復:', parseError.message);
    
    // 嘗試修復常見的JSON問題
    const repairedJson = repairJSON(generatedText);
    try {
      questions = JSON.parse(repairedJson);
      console.log('✅ JSON 修復成功');
    } catch (repairError) {
      console.error('❌ JSON 修復也失敗:', repairError.message);
      console.error('❌ 問題內容:', generatedText.substring(0, 500));
      throw new Error('AI生成的內容格式無法解析，請重新嘗試');
    }
  }

  // 確保是陣列格式
  if (!Array.isArray(questions)) {
    if (typeof questions === 'object' && questions !== null) {
      questions = [questions];
    } else {
      throw new Error('生成的內容格式不正確');
    }
  }

  // 嚴格驗證和清理題目
  const validQuestions = questions.filter(q => {
    return q && 
           typeof q === 'object' && 
           q.content && 
           typeof q.content === 'string' &&
           q.content.length > 5 &&
           q.correct_answer && 
           q.explanation &&
           q.explanation.length > 10 &&
           q.options &&
           typeof q.options === 'object' &&
           Object.keys(q.options).length >= 2;
  }).map((q, index) => ({
    id: q.id || (index + 1).toString(),
    content: q.content.trim(),
    options: q.options || {},
    correct_answer: q.correct_answer,
    explanation: q.explanation.trim(),
    question_type: q.question_type || 'choice',
    difficulty: q.difficulty || 0.5,
    difficulty_label: q.difficulty_label || '中',
    bloom_level: q.bloom_level || 2,
    chapter: q.chapter || '淨零iPAS',
    source_pdf: q.source_pdf || '',
    page_range: q.page_range || '',
    tags: q.tags || ['淨零iPAS']
  }));

  console.log('📊 題目驗證結果:');
  console.log(`原始數量: ${questions.length}`);
  console.log(`有效數量: ${validQuestions.length}`);
  console.log(`目標數量: ${questionCount}`);
  console.log(`完成率: ${Math.round((validQuestions.length / questionCount) * 100)}%`);

  if (validQuestions.length === 0) {
    throw new Error('沒有生成有效的題目，請檢查PDF內容是否清晰可讀');
  }

  return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}

// 清理和提取JSON的函數
function cleanAndExtractJSON(text: string): string {
  // 移除markdown標記
  text = text.replace(/```json\s*/gi, '');
  text = text.replace(/```\s*/g, '');
  text = text.replace(/`{1,3}/g, '');
  
  // 尋找JSON結構
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

// 修復JSON格式的函數
function repairJSON(jsonString: string): string {
  // 修復常見問題
  let repaired = jsonString;
  
  // 修復結尾缺少括號
  if (repaired.startsWith('[') && !repaired.endsWith(']')) {
    // 尋找最後一個完整物件
    let lastCompleteEnd = -1;
    let braceCount = 0;
    let inString = false;
    
    for (let i = 1; i < repaired.length; i++) {
      const char = repaired[i];
      
      if (char === '"' && repaired[i-1] !== '\\') {
        inString = !inString;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastCompleteEnd = i;
          }
        }
      }
    }
    
    if (lastCompleteEnd > -1) {
      repaired = repaired.substring(0, lastCompleteEnd + 1) + ']';
    }
  }
  
  return repaired;
}
