
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
        temperature: 0.2,
        max_tokens: 8000,
        top_p: 0.8,
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
    console.log('OpenAI response length:', data.choices?.[0]?.message?.content?.length || 0);
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('OpenAI 回應格式異常：缺少內容');
    }

    let generatedText = data.choices[0].message.content.trim();

    // 強化清理邏輯
    generatedText = generatedText.replace(/```json\s*/gi, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`{1,3}/g, '');
    generatedText = generatedText.replace(/^\s*[\[\{]/, match => match.trim());
    generatedText = generatedText.replace(/[\]\}]\s*$/, match => match.trim());

    // 尋找 JSON 開始和結束
    let jsonStart = generatedText.indexOf('[');
    let jsonEnd = generatedText.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      jsonStart = generatedText.indexOf('{');
      jsonEnd = generatedText.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('無法找到有效的JSON結構');
        throw new Error('AI 回應中沒有找到有效的 JSON 格式');
      }
    }

    let cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('Extracted JSON length:', cleanedText.length);

    // 增強的 JSON 修復函數
    const fixJson = (jsonStr) => {
      let fixed = jsonStr;
      
      // 修復未正確關閉的引號
      const quoteMatches = (fixed.match(/"/g) || []).length;
      if (quoteMatches % 2 !== 0) {
        // 在最後添加缺失的引號
        const lastQuoteIndex = fixed.lastIndexOf('"');
        const afterLastQuote = fixed.substring(lastQuoteIndex + 1);
        if (!afterLastQuote.match(/^\s*[,\]\}]/)) {
          fixed = fixed.substring(0, lastQuoteIndex + 1) + '"' + afterLastQuote;
        }
      }
      
      // 修復尾隨逗號
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
      
      // 修復未加引號的屬性值
      fixed = fixed.replace(/:\s*([^",\[\]{}]+)(\s*[,}])/g, (match, value, ending) => {
        const trimmedValue = value.trim();
        if (trimmedValue === 'true' || trimmedValue === 'false' || 
            trimmedValue === 'null' || !isNaN(Number(trimmedValue))) {
          return `: ${trimmedValue}${ending}`;
        }
        return `: "${trimmedValue}"${ending}`;
      });
      
      // 確保 JSON 結構完整
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      
      if (openBrackets > closeBrackets) {
        fixed += ']'.repeat(openBrackets - closeBrackets);
      }
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
      }
      
      return fixed;
    };

    let questions;
    try {
      questions = JSON.parse(cleanedText);
      console.log('Successfully parsed JSON on first attempt');
    } catch (parseError) {
      console.error('First JSON parse failed:', parseError.message);
      
      try {
        const fixedJson = fixJson(cleanedText);
        console.log('Attempting to parse fixed JSON...');
        questions = JSON.parse(fixedJson);
        console.log('Successfully parsed fixed JSON');
      } catch (secondError) {
        console.error('Second parse attempt failed:', secondError.message);
        console.error('Original content length:', generatedText.length);
        console.error('Cleaned content sample:', cleanedText.substring(0, 500));
        
        // 最後嘗試：如果是不完整的陣列，嘗試修復
        try {
          let lastAttempt = cleanedText;
          if (!lastAttempt.endsWith(']') && lastAttempt.includes('[')) {
            // 找到最後一個完整的物件
            const objects = lastAttempt.split('},{');
            if (objects.length > 1) {
              // 保留完整的物件
              const completeObjects = objects.slice(0, -1);
              lastAttempt = '[' + completeObjects.join('},{') + '}]';
              if (lastAttempt.startsWith('[[')) {
                lastAttempt = lastAttempt.substring(1);
              }
            }
          }
          
          questions = JSON.parse(lastAttempt);
          console.log('Successfully parsed with last attempt fix');
        } catch (finalError) {
          console.error('All parsing attempts failed:', finalError.message);
          throw new Error('無法解析 AI 生成的題目格式，請重新生成');
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

    // 嚴格驗證題目品質
    const validQuestions = questions.filter(q => {
      const isValid = q && 
             typeof q === 'object' && 
             q.content && 
             typeof q.content === 'string' &&
             q.content.length > 15 &&
             q.correct_answer && 
             q.explanation &&
             typeof q.explanation === 'string' &&
             q.explanation.length > 25 &&
             q.options &&
             typeof q.options === 'object' &&
             Object.keys(q.options).length >= 4;
      
      if (!isValid) {
        console.log('Invalid question filtered out:', {
          hasContent: !!q?.content,
          contentLength: q?.content?.length || 0,
          hasAnswer: !!q?.correct_answer,
          hasExplanation: !!q?.explanation,
          explanationLength: q?.explanation?.length || 0,
          hasOptions: !!q?.options,
          optionsCount: q?.options ? Object.keys(q.options).length : 0
        });
      }
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

    console.log('Total questions processed:', questions.length);
    console.log('Valid questions after filtering:', validQuestions.length);

    if (validQuestions.length === 0) {
      throw new Error('沒有生成有效的題目，請檢查PDF內容或重新嘗試');
    }

    return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-questions function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || '生成題目時發生錯誤，請重新嘗試',
      details: error.stack?.split('\n').slice(0, 3).join('\n') || '無詳細資訊'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
