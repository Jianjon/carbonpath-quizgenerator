
import { supabase } from '@/integrations/supabase/client';
import { Parameters, QuestionData } from '@/types/question';

export const callAIService = async (
  parameters: Parameters,
  pdfContent: string,
  uploadedFile: File
): Promise<QuestionData[]> => {
  const prompt = `基於以下 PDF 內容，生成 ${parameters.questionCount} 道選擇題。

PDF 內容：
${pdfContent}

請嚴格按照此 JSON 格式回答，不要添加任何其他文字：
[
  {
    "id": "1",
    "content": "題目內容",
    "options": {
      "A": "選項A",
      "B": "選項B", 
      "C": "選項C",
      "D": "選項D"
    },
    "correct_answer": "A",
    "explanation": "解析",
    "question_type": "choice",
    "difficulty": 0.6,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "${parameters.chapter}",
    "source_pdf": "${uploadedFile.name}",
    "page_range": "${parameters.chapter}",
    "tags": ["基礎概念"]
  }
]`;

  const response = await supabase.functions.invoke('generate-questions', {
    body: {
      systemPrompt: '你是出題專家，只根據提供的PDF內容出題',
      userPrompt: prompt,
      pdfContent: pdfContent,
      model: 'gpt-4o-mini'
    }
  });

  if (response.error) {
    throw new Error(`AI 服務錯誤: ${response.error.message}`);
  }

  let result = response.data?.generatedText || '';
  
  if (!result) {
    throw new Error('AI 未返回結果');
  }

  let questions;
  try {
    questions = JSON.parse(result);
  } catch (e) {
    console.error('JSON 解析失敗:', e);
    throw new Error('AI 回應格式錯誤');
  }

  if (!Array.isArray(questions)) {
    questions = [questions];
  }

  const validQuestions = questions.filter((q: any) => 
    q?.content && q?.correct_answer && q?.explanation && q?.options
  );

  if (validQuestions.length === 0) {
    throw new Error('未能生成有效題目');
  }

  return validQuestions;
};
