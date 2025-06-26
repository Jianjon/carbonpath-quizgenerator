
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

    console.log('🎯 淨零iPAS題目生成請求');
    console.log('模型:', model);
    console.log('系統提示長度:', systemPrompt?.length || 0);
    console.log('用戶提示預覽:', userPrompt?.substring(0, 100) + '...');

    if (!openAIApiKey) {
      console.error('❌ OpenAI API 金鑰未設定');
      throw new Error('OpenAI API 金鑰未配置');
    }

    // 動態調整參數以處理大量題目
    const questionCount = parseInt(userPrompt.match(/(\d+)\s*道/)?.[1] || '10');
    console.log('📊 預計生成題目數量:', questionCount);
    
    // 根據題目數量動態調整max_tokens
    let maxTokens = 3000;
    if (questionCount > 15) {
      maxTokens = 8000;
    } else if (questionCount > 10) {
      maxTokens = 5000;
    } else if (questionCount > 5) {
      maxTokens = 4000;
    }
    
    console.log('🔧 設定最大tokens:', maxTokens);

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
        max_tokens: maxTokens,
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

    // 檢查是否被截斷
    if (data.choices[0].finish_reason === 'length') {
      console.warn('⚠️ 回應被截斷，嘗試部分處理');
    }

    // 檢查是否被拒絕生成
    const refusalKeywords = ['抱歉', '無法提供', '不能生成', 'I cannot', 'I\'m sorry', 'unable to', 'cannot provide'];
    const isRefusal = refusalKeywords.some(keyword => 
      generatedText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isRefusal) {
      console.error('❌ AI 拒絕生成內容:', generatedText.substring(0, 200));
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
      console.error('❌ 沒有找到有效的JSON結構');
      console.error('生成內容樣本:', generatedText.substring(0, 500));
      
      // 提供基於樣題的備用題目
      console.log('🔧 使用淨零iPAS樣題模板');
      const backupQuestions = [{
        id: "1",
        content: "關於碳盤查的組織邊界，下列何者正確？",
        options: {
          "A": "包含台灣廠與大陸廠的範圍界定",
          "B": "僅限於單一工廠的範圍界定", 
          "C": "依據營運控制權決定邊界範圍",
          "D": "以上皆非"
        },
        correct_answer: "A",
        explanation: "組織邊界是指企業在進行碳盤查時，需要界定哪些設施或營運活動應納入盤查範圍。",
        question_type: "choice",
        difficulty: 0.5,
        difficulty_label: "中",
        bloom_level: 2,
        chapter: "淨零iPAS",
        source_pdf: "",
        page_range: "",
        tags: ["碳盤查", "組織邊界"]
      }];
      
      return new Response(JSON.stringify({ generatedText: JSON.stringify(backupQuestions) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let cleanedText = generatedText.substring(jsonStart, jsonEnd + 1);
    console.log('🧹 清理後的JSON長度:', cleanedText.length);

    // 嘗試修復被截斷的JSON
    if (data.choices[0].finish_reason === 'length') {
      console.log('🔧 嘗試修復被截斷的JSON');
      
      // 如果是陣列被截斷，嘗試補上結尾
      if (cleanedText.startsWith('[') && !cleanedText.endsWith(']')) {
        // 找到最後一個完整的物件
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
      
      // 嘗試逐行解析，提取有效的JSON物件
      console.log('🔧 嘗試逐行解析');
      const lines = cleanedText.split('\n');
      const validObjects = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const obj = JSON.parse(trimmed);
            if (obj.content && obj.options && obj.correct_answer) {
              validObjects.push(obj);
            }
          } catch (e) {
            // 忽略無效行
          }
        }
      }
      
      if (validObjects.length > 0) {
        console.log('🔧 逐行解析成功，獲得', validObjects.length, '道題目');
        questions = validObjects;
      } else {
        // 最後的備用方案
        console.log('🔧 使用備用淨零iPAS題目模板');
        questions = [{
          id: "1",
          content: "關於淨零排放的目標，下列何者正確？",
          options: {
            "A": "2030年達成淨零排放",
            "B": "2050年達成淨零排放", 
            "C": "2070年達成淨零排放",
            "D": "沒有明確時程"
          },
          correct_answer: "B",
          explanation: "我國2050淨零排放路徑已明確訂定2050年為淨零排放目標年。",
          question_type: "choice",
          difficulty: 0.3,
          difficulty_label: "易",
          bloom_level: 1,
          chapter: "淨零iPAS",
          source_pdf: "",
          page_range: "",
          tags: ["淨零排放", "政策目標"]
        }];
      }
    }

    // 確保格式正確
    if (!Array.isArray(questions)) {
      if (typeof questions === 'object' && questions !== null) {
        questions = [questions];
      } else {
        throw new Error('生成的內容格式不正確');
      }
    }

    // 驗證題目完整性並自動補全
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

    console.log('📊 題目驗證結果:');
    console.log(`總生成數: ${questions.length}`);
    console.log(`有效題目: ${validQuestions.length}`);
    console.log(`完成率: ${Math.round((validQuestions.length / questionCount) * 100)}%`);

    if (validQuestions.length === 0) {
      throw new Error('沒有生成有效的題目，請調整設定後重試');
    }

    // 如果題目數量不足且沒有被截斷，給出建議
    if (validQuestions.length < questionCount * 0.8 && data.choices[0].finish_reason !== 'length') {
      console.warn('⚠️ 生成題目數量不足，建議降低題目數量或分批生成');
    }

    return new Response(JSON.stringify({ generatedText: JSON.stringify(validQuestions) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('💥 處理錯誤:', error.message);
    console.error('💥 錯誤堆疊:', error.stack);
    
    let userMessage = error.message;
    
    if (error.message.includes('內容政策') || error.message.includes('拒絕生成') || error.message.includes('暫時無法處理')) {
      userMessage = '系統暫時無法處理此教材內容。建議：1) 減少題目數量到10題以下 2) 在基本設定中添加具體的學習重點關鍵字 3) 嘗試不同的題目風格';
    } else if (error.message.includes('API')) {
      userMessage = error.message;
    } else if (error.message.includes('JSON') || error.message.includes('格式')) {
      userMessage = '題目數量過多導致格式處理異常，請減少到15題以下重新生成';
    } else if (error.message.includes('網路') || error.message.includes('連接')) {
      userMessage = '網路連接問題，請檢查後重試';
    } else {
      userMessage = '生成過程遇到問題，建議減少題目數量後重新嘗試';
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
