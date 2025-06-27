
import { supabase } from '@/integrations/supabase/client';
import { Parameters, QuestionData } from '@/types/question';
import { PDFProcessResult } from '@/utils/pdfProcessor';

export interface AIGenerationResult {
  questions: QuestionData[];
  isSuccess: boolean;
  error?: string;
  tokenUsage?: number;
}

// 檢查內容是否適合生成題目
const validateContentForGeneration = (content: string, questionCount: number): { isValid: boolean; message?: string } => {
  const wordCount = content.replace(/\s+/g, ' ').split(' ').length;
  
  if (content.length < 100) {
    return { isValid: false, message: 'PDF 內容過少，無法生成題目' };
  }
  
  if (wordCount < 50) {
    return { isValid: false, message: 'PDF 文字內容不足，建議至少需要 50 個詞彙' };
  }
  
  // 估算每題需要的最小內容
  const wordsPerQuestion = Math.ceil(wordCount / questionCount);
  if (wordsPerQuestion < 10) {
    return { isValid: false, message: `內容相對於要求的題目數量過少，建議減少題目數量到 ${Math.floor(wordCount / 10)} 題以下` };
  }
  
  return { isValid: true };
};

// 創建優化的 AI prompt
const createOptimizedPrompt = (content: string, questionCount: number, fileName: string): string => {
  const contentPreview = content.length > 4000 ? content.substring(0, 4000) + '...' : content;
  
  return `請根據以下教材內容生成 ${questionCount} 道高品質的選擇題。

教材來源：${fileName}
內容摘要：
${contentPreview}

出題要求：
1. 題目必須完全基於提供的教材內容
2. 每題包含 4 個選項 (A, B, C, D)
3. 難度適中，測試理解和應用能力
4. 避免過於簡單或過於複雜的題目
5. 確保答案明確且唯一

請嚴格按照以下 JSON 格式回答，不要添加任何其他文字或解釋：
[
  {
    "id": "1",
    "content": "根據教材內容，以下哪個說法是正確的？",
    "options": {
      "A": "選項A內容",
      "B": "選項B內容", 
      "C": "選項C內容",
      "D": "選項D內容"
    },
    "correct_answer": "A",
    "explanation": "詳細解釋為什麼選擇A是正確的",
    "question_type": "choice",
    "difficulty": 0.6,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "教材主題",
    "source_pdf": "${fileName}",
    "page_range": "全文",
    "tags": ["相關概念"]
  }
]`;
};

export const callAIService = async (
  parameters: Parameters,
  pdfResult: PDFProcessResult,
  uploadedFile: File
): Promise<AIGenerationResult> => {
  
  // 前置檢查
  if (!pdfResult.isSuccess) {
    return {
      questions: [],
      isSuccess: false,
      error: `PDF 處理失敗: ${pdfResult.error}`
    };
  }
  
  // 驗證內容是否適合生成題目
  const validation = validateContentForGeneration(pdfResult.content, parameters.questionCount);
  if (!validation.isValid) {
    return {
      questions: [],
      isSuccess: false,
      error: validation.message
    };
  }
  
  console.log('🤖 開始 AI 題目生成...');
  console.log('📊 內容統計:');
  console.log('- 字數:', pdfResult.wordCount);
  console.log('- 內容長度:', pdfResult.content.length);
  console.log('- 提取頁數:', pdfResult.extractedPages);
  console.log('- 要求題數:', parameters.questionCount);

  try {
    const prompt = createOptimizedPrompt(pdfResult.content, parameters.questionCount, uploadedFile.name);
    
    console.log('📝 AI Prompt 長度:', prompt.length);
    
    const response = await supabase.functions.invoke('generate-questions', {
      body: {
        systemPrompt: '你是專業的教育測評專家，擅長根據教材內容設計高品質的選擇題。你必須嚴格按照要求的 JSON 格式回答，不添加任何其他內容。',
        userPrompt: prompt,
        pdfContent: pdfResult.content,
        model: 'gpt-4o-mini'
      }
    });

    if (response.error) {
      console.error('❌ AI 服務錯誤:', response.error);
      return {
        questions: [],
        isSuccess: false,
        error: `AI 服務錯誤: ${response.error.message}`
      };
    }

    let result = response.data?.generatedText || '';
    
    if (!result) {
      return {
        questions: [],
        isSuccess: false,
        error: 'AI 未返回任何結果'
      };
    }

    console.log('🤖 AI 原始回應長度:', result.length);
    console.log('🤖 AI 回應前 200 字符:', result.substring(0, 200));

    // 清理和解析 JSON
    let questions;
    try {
      // 移除可能的 markdown 標記
      const cleanedResult = result
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/^[\s\S]*?(\[[\s\S]*\])[\s\S]*$/, '$1') // 提取 JSON 陣列
        .trim();
      
      console.log('🧹 清理後的回應:', cleanedResult.substring(0, 200));
      questions = JSON.parse(cleanedResult);
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError);
      console.error('🔍 原始內容:', result);
      return {
        questions: [],
        isSuccess: false,
        error: `AI 回應格式錯誤，請重試。解析錯誤: ${parseError.message}`
      };
    }

    // 確保是陣列格式
    if (!Array.isArray(questions)) {
      questions = [questions];
    }

    // 驗證題目品質
    const validQuestions = questions.filter((q: any) => {
      const isValid = q?.content && 
                     q?.correct_answer && 
                     q?.options && 
                     typeof q.options === 'object' &&
                     Object.keys(q.options).length >= 4;
      
      if (!isValid) {
        console.warn('⚠️ 發現無效題目:', q);
      }
      
      return isValid;
    });

    if (validQuestions.length === 0) {
      return {
        questions: [],
        isSuccess: false,
        error: '生成的題目格式不正確，請重試'
      };
    }

    // 如果有效題目數量少於要求，給予警告但仍返回結果
    if (validQuestions.length < parameters.questionCount) {
      console.warn(`⚠️ 僅生成 ${validQuestions.length} 題，少於要求的 ${parameters.questionCount} 題`);
    }

    console.log('✅ 成功生成題目:', validQuestions.length, '題');
    
    return {
      questions: validQuestions,
      isSuccess: true,
      tokenUsage: result.length // 粗略估算
    };
    
  } catch (error) {
    console.error('❌ AI 生成過程失敗:', error);
    return {
      questions: [],
      isSuccess: false,
      error: `生成失敗: ${error.message}`
    };
  }
};
