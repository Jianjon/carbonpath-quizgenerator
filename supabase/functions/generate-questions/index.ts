
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

    console.log('Generating questions with model:', model);
    console.log('System prompt length:', systemPrompt?.length || 0);
    console.log('User prompt:', userPrompt?.substring(0, 200) + '...');

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
        temperature: 0.3,
        max_tokens: 6000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API 請求失敗：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response status:', response.status);
    console.log('OpenAI response data:', JSON.stringify(data).substring(0, 500));
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('OpenAI 回應格式異常：缺少內容');
    }

    let generatedText = data.choices[0].message.content.trim();
    console.log('Generated text preview:', generatedText.substring(0, 300));

    // 清理 Markdown 格式
    generatedText = generatedText.replace(/```json\s*/gi, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`{1,3}/g, '');

    // 尋找 JSON 開始和結束
    let jsonStart = generatedText.indexOf('[');
    let jsonEnd = generatedText.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      // 嘗試找物件格式
      jsonStart = generatedText.indexOf('{');
      jsonEnd = generatedText.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonContent = generatedText.substring(jsonStart, jsonEnd + 1);
        try {
          const singleQuestion = JSON.parse(jsonContent);
          return new Response(JSON.stringify({ generatedText: JSON.stringify([singleQuestion]) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (e) {
          console.error('Failed to parse single object:', e);
        }
      }
      
      throw new Error('無法找到有效的JSON格式內容');
    }

    const cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('Cleaned JSON text:', cleanedText.substring(0, 500));

    let questions;
    try {
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed content:', cleanedText);
      
      // 增強的JSON修復邏輯
      let fixedText = cleanedText;
      
      // 修復尾隨逗號
      fixedText = fixedText.replace(/,(\s*[}\]])/g, '$1');
      
      // 修復未閉合的引號和缺少的逗號
      fixedText = fixedText.replace(/([{,]\s*"[^"]*):([^",}\]]*[^",}\]\s])\s*([,}\]])/g, '$1:"$2"$3');
      
      // 修復不完整的JSON結構
      if (!fixedText.endsWith(']') && !fixedText.endsWith('}')) {
        if (fixedText.includes('[')) {
          fixedText += ']';
        } else if (fixedText.includes('{')) {
          fixedText += '}';
        }
      }
      
      try {
        questions = JSON.parse(fixedText);
        console.log('Successfully parsed after fixing');
      } catch (secondError) {
        console.error('Still failed after fixing:', secondError);
        throw new Error('JSON解析失敗，請重新生成題目');
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

    // 驗證和清理題目，確保內容完整性
    const validQuestions = questions.filter(q => {
      const isValid = q && 
             typeof q === 'object' && 
             q.content && 
             q.content.length > 10 &&
             q.correct_answer && 
             q.explanation &&
             q.explanation.length > 20;
      
      if (!isValid) {
        console.log('Invalid question filtered out:', q);
      }
      return isValid;
    }).map((q, index) => ({
      id: q.id || (index + 1).toString(),
      content: q.content,
      options: q.options || {},
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      question_type: q.question_type || 'choice',
      difficulty: q.difficulty || 0.5,
      difficulty_label: q.difficulty_label || '中',
      bloom_level: q.bloom_level || 2,
      chapter: q.chapter || '未分類',
      source_pdf: q.source_pdf || '',
      page_range: q.page_range || '',
      tags: q.tags || []
    }));

    if (validQuestions.length === 0) {
      throw new Error('沒有生成有效的題目，請檢查PDF內容或重新嘗試');
    }

    console.log('Successfully generated questions:', validQuestions.length);

    return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-questions function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '生成題目時發生錯誤，請重新嘗試'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
