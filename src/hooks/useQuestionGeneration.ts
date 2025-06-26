
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// 使用本地worker，避免網路問題
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface SampleQuestion {
  id: string;
  question: string;
  type: string;
  options?: string[];
  answer: string;
}

interface ChapterWeight {
  name: string;
  weight: number;
  questions: number;
}

interface WeightingConfig {
  chapterWeights: ChapterWeight[];
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  cognitiveDistribution: {
    remember: number;
    understand: number;
    apply: number;
    analyze: number;
  };
  questionTypeWeights: {
    multipleChoice: number;
    trueFalse: number;
    shortAnswer: number;
    essay: number;
  };
}

interface Parameters {
  chapter: string;
  questionStyle: string;
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: SampleQuestion[];
  keywords?: string;
  difficultyLevel?: string;
  weightingConfig: WeightingConfig;
}

interface QuestionData {
  id: string;
  content: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  question_type: string;
  difficulty: number;
  difficulty_label: string;
  bloom_level: number;
  chapter: string;
  source_pdf?: string;
  page_range?: string;
  tags?: string[];
}

export const useQuestionGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');

  // 解析頁數範圍
  const parsePageRange = (pageRange: string): number[] => {
    const pages: number[] = [];
    const parts = pageRange.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(p => parseInt(p.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        }
      } else {
        const pageNum = parseInt(trimmed);
        if (!isNaN(pageNum)) {
          pages.push(pageNum);
        }
      }
    }
    
    return [...new Set(pages)].sort((a, b) => a - b);
  };

  // 提取PDF內容 - 完全重新設計，移除所有網路依賴
  const extractPDFContent = async (file: File, pageRange: string): Promise<string> => {
    try {
      console.log('🔍 開始提取PDF內容，頁數範圍:', pageRange);
      console.log('📄 檔案大小:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      
      setGenerationStep('📖 讀取PDF檔案...');
      setGenerationProgress(5);
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('✅ 檔案讀取完成');
      
      setGenerationStep('🔧 初始化PDF處理器...');
      setGenerationProgress(10);
      
      // 使用最簡單的PDF載入配置
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0,
        standardFontDataUrl: undefined,
        cMapUrl: undefined,
        useSystemFonts: true
      });
      
      const pdf = await loadingTask.promise;
      console.log('📚 PDF 載入成功，總頁數:', pdf.numPages);

      setGenerationStep('📄 解析頁數範圍...');
      setGenerationProgress(15);

      const pages = parsePageRange(pageRange);
      console.log('📄 要提取的頁數:', pages);

      if (pages.length === 0) {
        throw new Error('無法解析頁數範圍，請使用格式如：1-5 或 1,3,5-8');
      }

      let fullContent = '';
      let successCount = 0;
      const maxPages = Math.min(pages.length, 30); // 限制最多30頁
      
      setGenerationStep('📖 提取PDF內容...');
      
      for (let i = 0; i < maxPages; i++) {
        const pageNum = pages[i];
        
        if (pageNum > pdf.numPages) {
          console.warn(`⚠️ 頁數 ${pageNum} 超出PDF總頁數 ${pdf.numPages}`);
          continue;
        }

        try {
          console.log(`📖 正在提取第 ${pageNum} 頁...`);
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .filter((item: any) => item && typeof item.str === 'string')
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText.length > 20) {
            fullContent += `\n\n=== 第 ${pageNum} 頁內容 ===\n${pageText}`;
            successCount++;
            console.log(`✅ 第 ${pageNum} 頁提取成功，內容長度: ${pageText.length}`);
          } else {
            console.warn(`⚠️ 第 ${pageNum} 頁內容過少`);
          }
        } catch (pageError) {
          console.error(`❌ 提取第 ${pageNum} 頁失敗:`, pageError);
        }
        
        // 更新進度
        const progress = 15 + (i / maxPages) * 25;
        setGenerationProgress(Math.round(progress));
      }

      console.log('📊 提取統計:', {
        目標頁數: pages.length,
        處理頁數: maxPages,
        成功頁數: successCount,
        內容總長度: fullContent.length
      });

      if (fullContent.length < 200) {
        throw new Error(`PDF內容提取不足 (僅 ${fullContent.length} 字符)。
可能原因：
1. PDF是掃描版圖片，無法提取文字
2. 指定頁面內容過少
3. 檔案格式問題
請確認PDF是文字版本，或嘗試不同的頁數範圍`);
      }

      setGenerationStep('✅ PDF內容提取完成');
      setGenerationProgress(40);
      
      console.log('📖 內容預覽:', fullContent.substring(0, 300) + '...');
      return fullContent;

    } catch (error) {
      console.error('❌ PDF內容提取失敗:', error);
      
      // 詳細錯誤處理
      if (error instanceof Error) {
        const errorMsg = error.message;
        if (errorMsg.includes('Invalid PDF') || errorMsg.includes('format')) {
          throw new Error('PDF檔案格式無效或損壞，請重新上傳完整的PDF檔案');
        } else if (errorMsg.includes('password')) {
          throw new Error('PDF檔案有密碼保護，請上傳無密碼的PDF檔案');
        } else if (errorMsg.includes('worker') || errorMsg.includes('fetch')) {
          throw new Error('PDF處理器載入失敗，請重新整理頁面後再試');
        } else {
          throw new Error(`PDF處理失敗：${errorMsg}`);
        }
      } else {
        throw new Error('PDF處理失敗：未知錯誤，請重新嘗試');
      }
    }
  };

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    if (!uploadedFile) {
      throw new Error('請先上傳PDF檔案');
    }

    if (!parameters.chapter || parameters.chapter.trim() === '') {
      throw new Error('請指定要出題的PDF頁數範圍');
    }

    setGenerationProgress(0);
    setGenerationStep('🚀 開始處理...');
    
    try {
      // 提取PDF內容
      const pdfContent = await extractPDFContent(uploadedFile, parameters.chapter);
      
      setGenerationStep('🤖 準備AI分析...');
      setGenerationProgress(45);
      
      // 構建強化的系統提示
      const systemPrompt = `你是專業的教育評量專家。請嚴格按照以下要求生成題目：

**重要：你必須只能基於以下PDF實際內容生成題目**

**PDF內容：**
${pdfContent}

**嚴格要求：**
1. 題目內容必須完全來自上述PDF內容，絕對不可使用PDF外的任何知識
2. 每個選項都必須基於PDF內容設計，不可憑空創造
3. 解析必須引用PDF中的具體段落或概念
4. 確保生成的題目有實際教育意義

**輸出格式（完整JSON陣列）：**
[
  {
    "id": "1",
    "content": "完全基於PDF內容的題目...",
    "options": {
      "A": "選項A - 來自PDF實際內容",
      "B": "選項B - 來自PDF實際內容", 
      "C": "選項C - 來自PDF實際內容",
      "D": "選項D - 來自PDF實際內容"
    },
    "correct_answer": "A",
    "explanation": "解析：根據PDF內容，...",
    "question_type": "choice",
    "difficulty": 0.6,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "${parameters.chapter}",
    "source_pdf": "${uploadedFile.name}",
    "page_range": "${parameters.chapter}",
    "tags": ["基於PDF的標籤"]
  }
]

請確保JSON格式完全正確，不要有任何語法錯誤。`;

      const userPrompt = `請嚴格基於提供的PDF內容（第${parameters.chapter}頁），生成 ${parameters.questionCount} 道高品質選擇題。

**要求：**
1. 每道題目都必須有PDF內容依據
2. 選項設計要有挑戰性但基於實際內容
3. 解析要詳細並引用PDF具體內容
4. 確保JSON格式完全正確

請立即開始生成：`;

      setGenerationStep('🧠 AI正在分析內容...');
      setGenerationProgress(60);
      
      console.log('🎯 向AI發送生成請求...');
      console.log('📋 PDF內容長度:', pdfContent.length);
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt,
          pdfContent,
          model: 'gpt-4o-mini'
        }
      });

      if (response.error) {
        console.error('❌ AI服務錯誤:', response.error);
        throw new Error(`AI服務錯誤: ${response.error.message || 'Unknown error'}`);
      }

      if (!response.data?.generatedText) {
        throw new Error('AI未返回有效內容，請重新嘗試');
      }

      setGenerationStep('🔍 處理生成結果...');
      setGenerationProgress(85);

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('✅ 題目解析成功，數量:', Array.isArray(questions) ? questions.length : 1);
      } catch (parseError) {
        console.error('❌ JSON解析失敗:', parseError);
        console.error('原始回應內容:', response.data.generatedText.substring(0, 500));
        throw new Error('AI回應格式錯誤，請重新生成');
      }

      if (!Array.isArray(questions)) {
        questions = [questions];
      }

      // 驗證題目品質
      const validQuestions = questions.filter((q: any) => {
        const isValid = q && 
          typeof q === 'object' && 
          q.content && 
          typeof q.content === 'string' &&
          q.content.length >= 10 && 
          q.correct_answer && 
          q.explanation && 
          typeof q.explanation === 'string' &&
          q.explanation.length >= 15 && 
          q.options &&
          typeof q.options === 'object' &&
          Object.keys(q.options).length >= 4;
          
        if (!isValid) {
          console.warn('❌ 無效題目:', q);
        }
        return isValid;
      });

      console.log('📊 品質檢驗結果:', {
        原始數量: questions.length,
        有效數量: validQuestions.length,
        目標數量: parameters.questionCount
      });

      if (validQuestions.length === 0) {
        throw new Error('生成的題目品質不符合要求，請重新嘗試');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 題目生成完成！');
      
      toast({
        title: "題目生成成功",
        description: `成功基於PDF第${parameters.chapter}頁內容生成 ${validQuestions.length} 道高品質題目`,
        variant: "default"
      });

      // 延遲清除進度顯示
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 3000);

      return validQuestions;
      
    } catch (error) {
      console.error('❌ 完整錯誤資訊:', error);
      setGenerationProgress(0);
      setGenerationStep('');
      
      const errorMessage = error instanceof Error ? error.message : '請檢查PDF檔案並重新嘗試';
      
      toast({
        title: "生成失敗",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    }
  };

  return {
    isGenerating,
    setIsGenerating,
    generationProgress,
    generationStep,
    generateQuestionsWithAI
  };
};
