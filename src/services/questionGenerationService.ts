
import { supabase } from '@/integrations/supabase/client';
import { Parameters, QuestionData } from '@/types/question';

export const callAIService = async (
  parameters: Parameters,
  pdfContent: string,
  uploadedFile: File
): Promise<QuestionData[]> => {
  
  // 極簡化的prompt
  const prompt = `請根據以下PDF內容生成 ${parameters.questionCount} 道選擇題。

PDF內容：
${pdfContent}

請嚴格按照以下JSON格式回答，不要添加任何其他文字：
[
  {
    "id": "1",
    "content": "題目內容？",
    "options": {
      "A": "選項A",
      "B": "選項B", 
      "C": "選項C",
      "D": "選項D"
    },
    "correct_answer": "A",
    "explanation": "解析說明",
    "question_type": "choice",
    "difficulty": 0.6,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "全文",
    "source_pdf": "${uploadedFile.name}",
    "page_range": "全文",
    "tags": ["基礎概念"]
  }
]`;

  console.log('🤖 發送AI請求...');
  console.log('PDF內容長度:', pdfContent.length);
  console.log('要求生成題數:', parameters.questionCount);

  const response = await supabase.functions.invoke('generate-questions', {
    body: {
      systemPrompt: '你是專業的出題老師，根據提供的內容出選擇題。',
      userPrompt: prompt,
      pdfContent: pdfContent,
      model: 'gpt-4o-mini'
    }
  });

  if (response.error) {
    console.error('❌ AI服務錯誤:', response.error);
    throw new Error(`AI服務錯誤: ${response.error.message}`);
  }

  let result = response.data?.generatedText || '';
  
  if (!result) {
    throw new Error('AI未返回結果');
  }

  console.log('🤖 AI原始回應:', result);

  // 嘗試解析JSON
  let questions;
  try {
    // 清理回應內容
    const cleanedResult = result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    questions = JSON.parse(cleanedResult);
  } catch (e) {
    console.error('❌ JSON解析失敗:', e);
    console.error('原始內容:', result);
    throw new Error('AI回應格式錯誤，請重試');
  }

  // 確保是陣列格式
  if (!Array.isArray(questions)) {
    questions = [questions];
  }

  // 基本驗證
  const validQuestions = questions.filter((q: any) => 
    q?.content && q?.correct_answer && q?.options
  );

  if (validQuestions.length === 0) {
    throw new Error('未能生成有效題目，請重試');
  }

  console.log('✅ 成功生成題目:', validQuestions.length, '題');
  return validQuestions;
};
