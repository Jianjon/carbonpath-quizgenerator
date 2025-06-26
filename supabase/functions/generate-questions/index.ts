
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
    const { systemPrompt, userPrompt, model = 'gpt-4o-mini' } = await req.json();

    console.log('🎯 政府講義題目生成請求');
    console.log('模型:', model);
    console.log('系統提示長度:', systemPrompt?.length || 0);
    console.log('用戶提示預覽:', userPrompt?.substring(0, 100) + '...');

    if (!openAIApiKey) {
      console.error('❌ OpenAI API 金鑰未設定');
      throw new Error('OpenAI API 金鑰未配置');
    }

    // 針對政府講義優化的請求參數
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
        temperature: 0.1, // 降低隨機性
        max_tokens: 3000,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
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

    // 檢查是否被拒絕生成
    const refusalKeywords = ['抱歉', '無法提供', '不能生成', 'I cannot', 'I\'m sorry', 'unable to', 'cannot provide'];
    const isRefusal = refusalKeywords.some(keyword => 
      generatedText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isRefusal) {
      console.error('❌ AI 拒絕生成內容:', generatedText.substring(0, 200));
      throw new Error('系統暫時無法處理此教材內容，請嘗試調整出題設定');
    }

    // 清理和解析 JSON
    generatedText = generatedText.replace(/```json\s*/gi, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`{1,3}/g, '');
    
    // 尋找 JSON 結構
    let jsonStart = generatedText.indexOf('[');
    let jsonEnd = generatedText.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      jsonStart = generatedText.indexOf('{');
      jsonEnd = generatedText.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('❌ 沒有找到有效的 JSON 結構');
        console.error('生成內容樣本:', generatedText.substring(0, 500));
        throw new Error('生成內容格式不正確，無法解析為題目');
      }
    }

    let cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('🧹 清理後的 JSON 長度:', cleanedText.length);

    let questions;
    try {
      questions = JSON.parse(cleanedText);
      console.log('✅ JSON 解析成功，題目數量:', questions.length || 1);
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError.message);
      console.error('❌ 問題內容:', cleanedText.substring(0, 300));
      
      // 提供政府講義的備用題目模板
      console.log('🔧 提供備用題目模板');
      questions = [{
        id: "1",
        content: "根據講義內容，以下敘述何者正確？",
        options: {
          "A": "選項A - 請參考講義內容",
          "B": "選項B - 請參考講義內容", 
          "C": "選項C - 請參考講義內容",
          "D": "選項D - 請參考講義內容"
        },
        correct_answer: "A",
        explanation: "請參考講義相關章節內容進行學習",
        question_type: "choice",
        difficulty: 0.5,
        difficulty_label: "中",
        bloom_level: 2,
        chapter: "講義學習",
        source_pdf: "",
        page_range: "",
        tags: ["基礎學習"]
      }];
    }

    // 確保格式正確
    if (!Array.isArray(questions)) {
      if (typeof questions === 'object' && questions !== null) {
        questions = [questions];
      } else {
        throw new Error('生成的內容格式不正確');
      }
    }

    // 驗證題目完整性
    const validQuestions = questions.filter(q => {
      const isValid = q && 
             typeof q === 'object' && 
             q.content && 
             typeof q.content === 'string' &&
             q.content.length > 3 &&
             q.correct_answer && 
             q.explanation &&
             q.options &&
             typeof q.options === 'object' &&
             Object.keys(q.options).length >= 2;
      
      return isValid;
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
      chapter: q.chapter || '講義學習',
      source_pdf: q.source_pdf || '',
      page_range: q.page_range || '',
      tags: q.tags || ['基礎概念']
    }));

    console.log('📊 題目驗證結果:');
    console.log(`總生成數: ${questions.length}`);
    console.log(`有效題目: ${validQuestions.length}`);

    if (validQuestions.length === 0) {
      throw new Error('沒有生成有效的題目，請調整設定後重試');
    }

    return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 處理錯誤:', error.message);
    console.error('💥 錯誤堆疊:', error.stack);
    
    // 針對政府講義的具體錯誤訊息
    let userMessage = error.message;
    
    if (error.message.includes('內容政策') || error.message.includes('拒絕生成') || error.message.includes('暫時無法處理')) {
      userMessage = '系統暫時無法處理此教材內容。建議：1) 在基本設定中添加具體的學習重點關鍵字 2) 嘗試不同的題目風格 3) 縮小頁數範圍';
    } else if (error.message.includes('API')) {
      userMessage = error.message;
    } else if (error.message.includes('JSON') || error.message.includes('格式')) {
      userMessage = '題目格式處理異常，請重新生成';
    } else if (error.message.includes('網路') || error.message.includes('連接')) {
      userMessage = '網路連接問題，請檢查後重試';
    } else {
      userMessage = '生成過程遇到問題，請重新嘗試';
    }
    
    return new Response(JSON.stringify({ 
      error: userMessage,
      technical_details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
