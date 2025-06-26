
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
    const { systemPrompt, userPrompt, model = 'o3-2025-04-16' } = await req.json();

    console.log('🔥 超嚴格PDF內容出題請求');
    console.log('模型:', model);
    console.log('系統提示長度:', systemPrompt?.length || 0);
    console.log('用戶提示預覽:', userPrompt?.substring(0, 100) + '...');

    if (!openAIApiKey) {
      console.error('❌ OpenAI API 金鑰未設定');
      throw new Error('OpenAI API 金鑰未配置');
    }

    const questionCount = parseInt(userPrompt.match(/(\d+)\s*道/)?.[1] || '10');
    console.log('📊 預計生成題目數量:', questionCount);
    
    let maxTokens = 8000;
    if (questionCount > 15) {
      maxTokens = 12000;
    } else if (questionCount > 10) {
      maxTokens = 10000;
    }
    
    console.log('🔧 設定最大tokens:', maxTokens);

    // 使用最強推理模型確保嚴格遵循PDF內容
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
        temperature: 0.1, // 極低溫度確保嚴格遵循指令
        max_tokens: maxTokens,
        top_p: 0.8,
        frequency_penalty: 0.3,
        presence_penalty: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API 錯誤:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('OpenAI API 請求次數過多，請稍後再試');
      } else if (response.status === 401) {
        throw new Error('OpenAI API 金鑰無效或過期');
      } else if (response.status === 403) {
        throw new Error('OpenAI API 權限不足，請檢查帳戶狀態');
      }
      
      throw new Error(`OpenAI API 請求失敗：${response.status}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI 回應接收成功');
    console.log('回應狀態:', response.status);
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('❌ OpenAI 回應格式異常:', JSON.stringify(data, null, 2));
      throw new Error('OpenAI 回應內容為空或格式錯誤');
    }

    let generatedText = data.choices[0].message.content.trim();
    console.log('📝 生成內容長度:', generatedText.length);
    console.log('📝 生成內容預覽:', generatedText.substring(0, 200));

    // 檢查是否被截斷
    if (data.choices[0].finish_reason === 'length') {
      console.warn('⚠️ 回應被截斷，嘗試部分處理');
    }

    // 檢查是否有明確拒絕出題的回應
    const explicitRefusalKeywords = [
      '抱歉，我無法',
      '我不能提供',
      '不能生成這類內容',
      'I cannot',
      'I\'m sorry, I cannot',
      'unable to provide'
    ];
    
    const isExplicitRefusal = explicitRefusalKeywords.some(keyword => 
      generatedText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isExplicitRefusal) {
      console.error('❌ AI 明確拒絕生成內容:', generatedText.substring(0, 200));
      throw new Error('系統暫時無法處理此教材內容，請嘗試調整出題設定');
    }

    // 強化的JSON清理和修復邏輯
    generatedText = generatedText.replace(/```json\s*/gi, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`{1,3}/g, '');
    
    // 尋找JSON結構
    let jsonStart = generatedText.indexOf('[');
    let jsonEnd = generatedText.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      jsonStart = generatedText.indexOf('{');
      jsonEnd = generatedText.lastIndexOf('}');
    }

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('❌ 没有找到有效的JSON結構');
      console.error('生成內容樣本:', generatedText.substring(0, 500));
      throw new Error('AI生成的內容格式不正確，請重新嘗試');
    }

    let cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('🧹 清理後的JSON長度:', cleanedText.length);

    // 嘗試修復被截斷的JSON
    if (data.choices[0].finish_reason === 'length') {
      console.log('🔧 嘗試修復被截斷的JSON');
      
      if (cleanedText.startsWith('[') && !cleanedText.endsWith(']')) {
        let lastCompleteObjectEnd = -1;
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 1; i < cleanedText.length; i++) {
          const char = cleanedText[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                lastCompleteObjectEnd = i;
              }
            }
          }
        }
        
        if (lastCompleteObjectEnd > -1) {
          cleanedText = cleanedText.substring(0, lastCompleteObjectEnd + 1) + ']';
          console.log('🔧 JSON修復成功，長度:', cleanedText.length);
        }
      }
    }

    let questions;
    try {
      questions = JSON.parse(cleanedText);
      console.log('✅ JSON 解析成功，題目數量:', questions.length || 1);
      
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError.message);
      console.error('❌ 問題內容前500字:', cleanedText.substring(0, 500));
      throw new Error('AI生成的題目格式解析失敗，請重新嘗試');
    }

    // 確保格式正確
    if (!Array.isArray(questions)) {
      if (typeof questions === 'object' && questions !== null) {
        questions = [questions];
      } else {
        throw new Error('生成的內容格式不正確');
      }
    }

    // 嚴格驗證題目完整性
    const validQuestions = questions.filter(q => {
      return q && 
             typeof q === 'object' && 
             q.content && 
             typeof q.content === 'string' &&
             q.content.length > 3 &&
             q.correct_answer && 
             q.explanation &&
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

    console.log('📊 嚴格題目驗證結果:');
    console.log(`總生成數: ${questions.length}`);
    console.log(`有效題目: ${validQuestions.length}`);
    console.log(`完成率: ${Math.round((validQuestions.length / questionCount) * 100)}%`);

    // 檢查每道題目是否嚴格遵循頁數範圍
    validQuestions.forEach((q, index) => {
      if (!q.explanation.includes('第') && !q.explanation.includes('頁')) {
        console.warn(`⚠️ 題目 ${index + 1} 可能未嚴格遵循頁數限制: ${q.content}`);
      }
    });

    if (validQuestions.length === 0) {
      throw new Error('沒有生成有效的題目，請重新嘗試');
    }

    return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 處理錯誤:', error.message);
    console.error('💥 錯誤堆疊:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      technical_details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
