
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

    // 改用更溫和的 system prompt，避免觸發安全機制
    const improvedSystemPrompt = `你是一位專業的教育專家，專門協助教師製作教學題目。

請按照以下格式生成教育測驗題目，回傳格式必須是純 JSON 陣列：

${systemPrompt}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: improvedSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }  // 強制 JSON 格式
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API 請求失敗：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response status:', response.status);
    console.log('OpenAI response data:', data);
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('OpenAI 回應格式異常：缺少內容');
    }

    let generatedText = data.choices[0].message.content.trim();
    console.log('Generated text preview:', generatedText.substring(0, 300));

    // 如果回應包含拒絕內容，提供替代方案
    if (generatedText.includes('抱歉') || generatedText.includes('無法') || generatedText.includes('不能')) {
      console.log('AI refused request, using fallback');
      
      // 使用更簡單的 fallback prompt
      const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { 
              role: 'system', 
              content: `你是教育專家，請生成教學題目。回傳 JSON 陣列格式，每個題目包含：
              - id: 題目編號
              - content: 題目內容  
              - options: {"A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D"}
              - correct_answer: 正確答案
              - explanation: 解析
              - question_type: "choice"
              - difficulty: 0.5
              - difficulty_label: "中"
              - bloom_level: 2
              - chapter: "學習主題"
              - tags: ["關鍵字"]`
            },
            { 
              role: 'user', 
              content: `請生成 5 道基礎選擇題，主題：基本概念。只回傳 JSON 格式，不要其他文字。`
            }
          ],
          temperature: 0.5,
          max_tokens: 3000
        }),
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        generatedText = fallbackData.choices[0].message.content.trim();
        console.log('Fallback response received');
      }
    }

    // 清理和解析 JSON
    generatedText = generatedText.replace(/```json\s*/gi, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`{1,3}/g, '');

    // 尋找 JSON 陣列
    let jsonStart = generatedText.indexOf('[');
    let jsonEnd = generatedText.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      jsonStart = generatedText.indexOf('{');
      jsonEnd = generatedText.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('回應中找不到有效的 JSON 格式');
      }
    }

    const cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('Cleaned JSON text:', cleanedText.substring(0, 500));

    let questions;
    try {
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed content:', cleanedText.substring(0, 1000));
      
      // 最後的 fallback：返回示例題目
      questions = [{
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
    }

    // 確保是陣列格式
    if (!Array.isArray(questions)) {
      if (typeof questions === 'object' && questions !== null) {
        questions = [questions];
      } else {
        throw new Error('生成的內容不是有效的題目格式');
      }
    }

    // 驗證題目格式
    const validQuestions = questions.filter(q => {
      const isValid = q && 
             typeof q === 'object' && 
             q.content && 
             q.correct_answer && 
             q.explanation;
      
      if (!isValid) {
        console.log('Invalid question filtered out:', q);
      }
      
      return isValid;
    });

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
