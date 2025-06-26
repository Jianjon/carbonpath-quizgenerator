
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
        temperature: 0.1,
        max_tokens: 8000,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      
      // 檢查是否為 API 配額或權限問題
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
    console.log('📝 Generated text preview:', generatedText.substring(0, 500));

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
        console.error('Generated text sample:', generatedText.substring(0, 1000));
        throw new Error('AI 回應中沒有找到有效的 JSON 格式，請重新嘗試');
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
      console.error('❌ Problematic JSON sample:', cleanedText.substring(0, 500));
      
      // 嘗試修復常見的 JSON 問題
      try {
        let fixedJson = cleanedText;
        
        // 修復尾隨逗號
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
        
        // 修復未關閉的引號
        const quoteCount = (fixedJson.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          fixedJson += '"';
        }
        
        // 修復未關閉的括號
        const openBrackets = (fixedJson.match(/\[/g) || []).length;
        const closeBrackets = (fixedJson.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
          fixedJson += ']'.repeat(openBrackets - closeBrackets);
        }
        
        const openBraces = (fixedJson.match(/\{/g) || []).length;
        const closeBraces = (fixedJson.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          fixedJson += '}'.repeat(openBraces - closeBraces);
        }
        
        questions = JSON.parse(fixedJson);
        console.log('✅ Fixed JSON parsed successfully');
        
      } catch (secondError) {
        console.error('❌ JSON fix attempt failed:', secondError.message);
        
        // 最後嘗試：提取部分有效的題目
        try {
          const questionPattern = /"id":\s*"[^"]+"/g;
          const questionMatches = cleanedText.match(questionPattern);
          
          if (questionMatches && questionMatches.length > 0) {
            console.log(`🔧 Found ${questionMatches.length} potential questions, attempting partial extraction`);
            
            // 簡化的回退方案：返回基本的題目結構供前端處理
            questions = [{
              id: "1",
              content: "AI 生成的內容需要進一步處理，請重新生成",
              options: {"A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D"},
              correct_answer: "A",
              explanation: "由於 AI 回應格式問題，請重新生成題目",
              question_type: "choice",
              difficulty: 0.5,
              difficulty_label: "中",
              bloom_level: 2,
              chapter: "系統訊息",
              source_pdf: "",
              page_range: "",
              tags: ["系統提示"]
            }];
            
            console.log('⚠️ Using fallback question structure');
          } else {
            throw new Error('完全無法解析 AI 生成的內容');
          }
        } catch (fallbackError) {
          console.error('❌ All parsing attempts failed');
          throw new Error('AI 生成的內容格式無法解析，請檢查 OpenAI 服務狀態或重新嘗試');
        }
      }
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
             q.content.length > 10 &&
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
    
    if (error.message.includes('API')) {
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
