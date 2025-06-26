
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

    // 基本清理
    generatedText = generatedText.trim();
    console.log('Original response length:', generatedText.length);
    console.log('First 500 chars:', generatedText.substring(0, 500));

    // 檢查並移除 HTML 文檔結構
    if (generatedText.includes('<!DOCTYPE') || 
        generatedText.includes('<html>') || 
        generatedText.includes('<body>') ||
        generatedText.includes('<head>')) {
      console.error('Response contains HTML document structure');
      throw new Error('AI 回應包含 HTML 文檔結構，請重新嘗試');
    }

    // 移除 markdown 代碼塊標記
    generatedText = generatedText.replace(/```json\s*/gi, '');
    generatedText = generatedText.replace(/```\s*/g, '');
    generatedText = generatedText.replace(/`{1,3}/g, '');

    // 移除常見的說明文字行
    const lines = generatedText.split('\n');
    const cleanLines = [];
    let foundJsonStart = false;
    let bracketDepth = 0;
    let inJsonBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 跳過空行
      if (!line) continue;
      
      // 跳過明顯的說明文字
      if (line.match(/^(以下是|這裡是|生成的題目|題目如下|根據您的要求|請參考以下|以下為|為您生成)/)) {
        continue;
      }
      
      // 檢測 JSON 開始
      if (line.startsWith('[') || line.startsWith('{')) {
        foundJsonStart = true;
        inJsonBlock = true;
      }
      
      if (inJsonBlock) {
        cleanLines.push(lines[i]); // 保留原始縮進
        
        // 計算括號深度
        for (const char of line) {
          if (char === '[' || char === '{') bracketDepth++;
          if (char === ']' || char === '}') bracketDepth--;
        }
        
        // 如果括號平衡，檢查是否結束
        if (bracketDepth === 0 && (line.endsWith(']') || line.endsWith('}'))) {
          break;
        }
      }
    }

    let cleanedText = cleanLines.join('\n').trim();
    
    // 如果沒有找到 JSON 塊，嘗試其他方法
    if (!cleanedText && !foundJsonStart) {
      console.log('No JSON block found, trying alternative extraction...');
      
      // 尋找第一個 [ 或 { 到最後一個 ] 或 }
      const firstBracket = Math.min(
        generatedText.indexOf('[') === -1 ? Infinity : generatedText.indexOf('['),
        generatedText.indexOf('{') === -1 ? Infinity : generatedText.indexOf('{')
      );
      
      if (firstBracket !== Infinity) {
        // 從第一個括號開始尋找匹配的結束括號
        let depth = 0;
        let endIndex = -1;
        const startChar = generatedText[firstBracket];
        const endChar = startChar === '[' ? ']' : '}';
        
        for (let i = firstBracket; i < generatedText.length; i++) {
          if (generatedText[i] === startChar) depth++;
          if (generatedText[i] === endChar) depth--;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
        
        if (endIndex > firstBracket) {
          cleanedText = generatedText.substring(firstBracket, endIndex + 1);
        }
      }
    }

    if (!cleanedText) {
      throw new Error('無法在 AI 回應中找到有效的 JSON 內容');
    }

    console.log('Cleaned text length:', cleanedText.length);
    console.log('Cleaned text preview:', cleanedText.substring(0, 500));

    // 最後檢查是否還有 HTML 標籤
    if (cleanedText.includes('<') && cleanedText.includes('>')) {
      console.error('Cleaned text still contains HTML tags');
      throw new Error('處理後的內容仍包含 HTML 標籤，請重新嘗試');
    }

    // 嘗試解析 JSON
    let questions;
    try {
      questions = JSON.parse(cleanedText);
      console.log('Successfully parsed JSON, type:', typeof questions, 'length:', Array.isArray(questions) ? questions.length : 'not array');
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Failed content preview:', cleanedText.substring(0, 1000));
      
      // 最後嘗試：修復常見的 JSON 錯誤
      try {
        let fixedText = cleanedText;
        
        // 修復末尾逗號
        fixedText = fixedText.replace(/,(\s*[}\]])/g, '$1');
        
        // 修復單引號
        fixedText = fixedText.replace(/'/g, '"');
        
        // 修復未轉義的引號 (簡化版)
        fixedText = fixedText.replace(/([{,]\s*")([^"]*)"([^",:}\]]*)"([^"]*)"(\s*:)/g, '$1$2\\"$3\\"$4$5');
        
        console.log('Attempting to parse fixed JSON...');
        questions = JSON.parse(fixedText);
        console.log('Successfully parsed after fixing common JSON errors');
      } catch (secondParseError) {
        console.error('Second parse attempt failed:', secondParseError.message);
        throw new Error(`JSON 解析失敗：${parseError.message}。請確認 AI 回應格式正確。`);
      }
    }

    // 確保是陣列格式
    if (!Array.isArray(questions)) {
      if (typeof questions === 'object' && questions !== null) {
        questions = [questions];
      } else {
        throw new Error('AI 回應不是有效的題目陣列格式');
      }
    }

    // 驗證題目格式
    const validQuestions = questions.filter(q => {
      const isValid = q && 
             typeof q === 'object' && 
             q.content && 
             q.correct_answer && 
             q.explanation &&
             q.question_type;
      
      if (!isValid) {
        console.log('Invalid question found:', q);
      }
      
      return isValid;
    });

    if (validQuestions.length === 0) {
      throw new Error('生成的題目格式不完整，請重新嘗試');
    }

    console.log('Successfully validated questions:', validQuestions.length);

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
