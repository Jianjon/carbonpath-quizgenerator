
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
    const { systemPrompt, userPrompt, model = 'gpt-4o' } = await req.json();

    console.log('Generating questions with:', { model, systemPrompt: systemPrompt.substring(0, 100) + '...', userPrompt });

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
        max_tokens: 4000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API 請求失敗：${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received:', data.choices?.[0]?.message?.content?.substring(0, 300) + '...');
    
    let generatedText = data.choices[0].message.content;

    // 更強力的內容清理
    generatedText = generatedText.trim();

    // 檢查是否包含 HTML 內容
    if (generatedText.includes('<!DOCTYPE') || 
        generatedText.includes('<html>') || 
        generatedText.includes('<body>') ||
        generatedText.includes('<div>')) {
      console.error('Response contains HTML content:', generatedText.substring(0, 500));
      throw new Error('AI 回應包含 HTML 內容，請重新嘗試');
    }

    // 移除可能的 markdown 代碼塊標記
    generatedText = generatedText.replace(/```json\s*/g, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`/g, '');

    // 移除任何解釋性文字，只保留 JSON 部分
    const lines = generatedText.split('\n');
    let jsonLines = [];
    let inJsonBlock = false;
    let braceCount = 0;
    let bracketCount = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 跳過空行和明顯的說明文字
      if (!trimmedLine || 
          trimmedLine.startsWith('以下是') ||
          trimmedLine.startsWith('這裡是') ||
          trimmedLine.startsWith('生成的題目') ||
          trimmedLine.startsWith('題目如下') ||
          trimmedLine.includes('根據您的要求')) {
        continue;
      }

      // 檢測 JSON 開始
      if (trimmedLine.startsWith('[') || trimmedLine.startsWith('{')) {
        inJsonBlock = true;
      }

      if (inJsonBlock) {
        jsonLines.push(line);
        
        // 計算括號數量
        for (const char of trimmedLine) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          if (char === '[') bracketCount++;
          if (char === ']') bracketCount--;
        }

        // 如果括號平衡且遇到結束符號，結束 JSON 塊
        if ((trimmedLine.endsWith(']') || trimmedLine.endsWith('}')) && 
            braceCount === 0 && bracketCount === 0) {
          break;
        }
      }
    }

    let cleanedText = jsonLines.join('\n').trim();

    // 如果沒有找到 JSON 塊，嘗試其他方法
    if (!cleanedText) {
      // 尋找第一個 [ 或 { 到最後一個 ] 或 }
      const firstBracket = Math.min(
        generatedText.indexOf('[') === -1 ? Infinity : generatedText.indexOf('['),
        generatedText.indexOf('{') === -1 ? Infinity : generatedText.indexOf('{')
      );
      
      const lastBracket = Math.max(
        generatedText.lastIndexOf(']'),
        generatedText.lastIndexOf('}')
      );

      if (firstBracket !== Infinity && lastBracket > firstBracket) {
        cleanedText = generatedText.substring(firstBracket, lastBracket + 1);
      } else {
        throw new Error('無法在回應中找到有效的 JSON 內容');
      }
    }

    console.log('Cleaned text for parsing:', cleanedText.substring(0, 500) + '...');

    // 嘗試解析 JSON
    let questions;
    try {
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Failed content:', cleanedText);
      
      // 最後嘗試：修復常見的 JSON 錯誤
      try {
        // 修復末尾逗號
        let fixedText = cleanedText.replace(/,(\s*[}\]])/g, '$1');
        // 修復單引號
        fixedText = fixedText.replace(/'/g, '"');
        // 修復未轉義的引號
        fixedText = fixedText.replace(/"([^"]*)"([^",:}\]]*)"([^"]*)":/g, '"$1\\"$2\\"$3":');
        
        questions = JSON.parse(fixedText);
        console.log('Successfully parsed after fixing common JSON errors');
      } catch (secondParseError) {
        console.error('Second parse attempt failed:', secondParseError.message);
        throw new Error(`JSON 解析失敗，AI 回應格式不正確：${parseError.message}`);
      }
    }

    // 確保是陣列格式
    if (!Array.isArray(questions)) {
      if (typeof questions === 'object' && questions !== null) {
        questions = [questions];
      } else {
        throw new Error('AI 回應不是有效的題目格式');
      }
    }

    // 驗證題目格式
    const validQuestions = questions.filter(q => {
      return q && 
             typeof q === 'object' && 
             q.content && 
             q.correct_answer && 
             q.explanation &&
             q.question_type;
    });

    if (validQuestions.length === 0) {
      throw new Error('生成的題目格式不完整，請檢查 AI 回應');
    }

    console.log('Successfully parsed questions:', validQuestions.length);

    return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-questions function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '生成題目時發生未知錯誤，請重新嘗試'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
