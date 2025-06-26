
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
        temperature: 0.7,
        max_tokens: 4000,
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
      
      // 如果找不到有效 JSON，返回預設題目
      const fallbackQuestions = [{
        id: "1",
        content: "以下何者為正確的學習方法？",
        options: {
          "A": "被動接受資訊",
          "B": "主動思考和實踐",
          "C": "只靠死背硬記",
          "D": "完全依賴他人"
        },
        correct_answer: "B",
        explanation: "主動思考和實踐是最有效的學習方法，能幫助深化理解和記憶。",
        question_type: "choice",
        difficulty: 0.5,
        difficulty_label: "中",
        bloom_level: 2,
        chapter: "學習方法",
        tags: ["學習", "方法"]
      }];
      
      console.log('Using fallback questions');
      return new Response(JSON.stringify({ generatedText: JSON.stringify(fallbackQuestions) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('Cleaned JSON text:', cleanedText.substring(0, 500));

    let questions;
    try {
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed content:', cleanedText);
      
      // 嘗試修復常見的 JSON 錯誤
      let fixedText = cleanedText;
      
      // 修復尾隨逗號
      fixedText = fixedText.replace(/,(\s*[}\]])/g, '$1');
      
      // 修復未閉合的引號
      fixedText = fixedText.replace(/([{,]\s*"[^"]*):([^",}\]]*[^",}\]\s])\s*([,}\]])/g, '$1:"$2"$3');
      
      try {
        questions = JSON.parse(fixedText);
        console.log('Successfully parsed after fixing');
      } catch (secondError) {
        console.error('Still failed after fixing:', secondError);
        
        // 最終回退
        const fallbackQuestions = [{
          id: "1",
          content: "這是一個示例題目，請重新生成。",
          options: {
            "A": "選項A",
            "B": "選項B", 
            "C": "選項C",
            "D": "選項D"
          },
          correct_answer: "A",
          explanation: "這是示例解析，請重新生成題目。",
          question_type: "choice",
          difficulty: 0.5,
          difficulty_label: "中",
          bloom_level: 2,
          chapter: "示例章節",
          tags: ["示例"]
        }];
        
        return new Response(JSON.stringify({ generatedText: JSON.stringify(fallbackQuestions) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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

    // 驗證和清理題目
    const validQuestions = questions.filter(q => {
      return q && 
             typeof q === 'object' && 
             q.content && 
             q.correct_answer && 
             q.explanation;
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
      throw new Error('沒有生成有效的題目，請重新嘗試');
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
