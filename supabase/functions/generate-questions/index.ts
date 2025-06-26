
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

    console.log('🎯 Generation request received');
    console.log('Model:', model);
    console.log('System prompt length:', systemPrompt?.length || 0);
    console.log('User prompt preview:', userPrompt?.substring(0, 100) + '...');

    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      throw new Error('OpenAI API 金鑰未設定');
    }

    // 修改請求參數，降低觸發內容政策的機率
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
        temperature: 0.3, // 提高一點創意性
        max_tokens: 4000, // 降低 token 限制
        top_p: 0.8,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('OpenAI API 配額已用完，請檢查您的 API 使用狀況');
      } else if (response.status === 401) {
        throw new Error('OpenAI API 金鑰無效，請檢查金鑰設定');
      } else if (response.status === 403) {
        throw new Error('OpenAI API 權限不足，請檢查您的帳戶狀態');
      }
      
      throw new Error(`OpenAI API 請求失敗：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI response received');
    console.log('Response status:', response.status);
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('❌ Invalid OpenAI response structure:', JSON.stringify(data, null, 2));
      throw new Error('OpenAI 回應格式異常：缺少內容');
    }

    let generatedText = data.choices[0].message.content.trim();
    console.log('📝 Generated text length:', generatedText.length);
    console.log('📝 Generated text preview:', generatedText.substring(0, 200));

    // 檢查是否被拒絕回應
    if (generatedText.includes('抱歉') || generatedText.includes('無法提供') || generatedText.includes('I cannot') || generatedText.includes('I\'m sorry')) {
      console.error('❌ OpenAI refused to generate content:', generatedText);
      throw new Error('AI 拒絕生成內容，可能是因為內容政策限制。請嘗試調整出題範圍或風格設定。');
    }

    // 清理生成的文字
    generatedText = generatedText.replace(/```json\s*/gi, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`{1,3}/g, '');
    
    // 找到 JSON 開始和結束位置
    let jsonStart = generatedText.indexOf('[');
    let jsonEnd = generatedText.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      jsonStart = generatedText.indexOf('{');
      jsonEnd = generatedText.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('❌ No valid JSON structure found');
        console.error('Generated text sample:', generatedText.substring(0, 500));
        throw new Error('AI 回應中沒有找到有效的 JSON 格式。這可能是因為內容政策限制，請嘗試調整出題參數。');
      }
    }

    let cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('🧹 Cleaned JSON length:', cleanedText.length);

    let questions;
    try {
      questions = JSON.parse(cleanedText);
      console.log('✅ JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ JSON parse failed:', parseError.message);
      console.error('❌ Problematic JSON sample:', cleanedText.substring(0, 200));
      
      // 提供回退方案：生成示例題目
      console.log('🔧 Providing fallback questions');
      questions = [{
        id: "1",
        content: "請根據 PDF 內容描述主要概念",
        options: {"A": "概念A", "B": "概念B", "C": "概念C", "D": "概念D"},
        correct_answer: "A",
        explanation: "根據 PDF 內容，正確答案為概念A",
        question_type: "choice",
        difficulty: 0.5,
        difficulty_label: "中",
        bloom_level: 2,
        chapter: "系統生成",
        source_pdf: "",
        page_range: "",
        tags: ["回退題目"]
      }];
    }

    // 確保是陣列格式
    if (!Array.isArray(questions)) {
      if (typeof questions === 'object' && questions !== null) {
        questions = [questions];
      } else {
        throw new Error('生成的內容不是有效的題目格式');
      }
    }

    // 驗證題目品質
    const validQuestions = questions.filter(q => {
      const isValid = q && 
             typeof q === 'object' && 
             q.content && 
             typeof q.content === 'string' &&
             q.content.length > 5 &&
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
      chapter: q.chapter || '未分類',
      source_pdf: q.source_pdf || '',
      page_range: q.page_range || '',
      tags: q.tags || []
    }));

    console.log('📊 Question validation results:');
    console.log(`Total generated: ${questions.length}`);
    console.log(`Valid questions: ${validQuestions.length}`);

    if (validQuestions.length === 0) {
      throw new Error('沒有生成有效的題目，請重新嘗試或調整參數');
    }

    return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 Function error:', error.message);
    console.error('💥 Error stack:', error.stack);
    
    // 提供更具體的錯誤訊息給用戶
    let userMessage = error.message;
    
    if (error.message.includes('內容政策') || error.message.includes('拒絕生成')) {
      userMessage = '內容被 AI 安全政策限制，請嘗試：1) 調整出題風格 2) 縮小出題範圍 3) 檢查 PDF 內容是否適合';
    } else if (error.message.includes('API')) {
      userMessage = error.message;
    } else if (error.message.includes('JSON') || error.message.includes('格式')) {
      userMessage = 'AI 回應格式異常，請重新生成';
    } else if (error.message.includes('網路') || error.message.includes('連接')) {
      userMessage = '網路連接問題，請檢查網路後重試';
    } else {
      userMessage = '生成題目時發生錯誤，請重新嘗試';
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
