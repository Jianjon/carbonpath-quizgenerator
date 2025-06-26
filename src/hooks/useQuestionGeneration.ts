
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// 修復 PDF.js worker 設定 - 使用更穩定的 CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js';

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

  // 提取PDF指定頁面的內容 - 加強錯誤處理和重試機制
  const extractPDFContent = async (file: File, pageRange: string): Promise<string> => {
    try {
      console.log('🔍 開始提取PDF內容，頁數範圍:', pageRange);
      
      const arrayBuffer = await file.arrayBuffer();
      
      // 加強 PDF 載入設定 - 移除無效的 disableStreamingImport 屬性
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
        useWorkerFetch: false,
        disableAutoFetch: true
      });

      const pdf = await loadingTask.promise;
      console.log('📚 PDF 成功載入，總頁數:', pdf.numPages);

      const pages = parsePageRange(pageRange);
      console.log('📄 要提取的頁數:', pages);

      if (pages.length === 0) {
        throw new Error('無法解析頁數範圍，請使用格式如：1-5, 8, 10-12');
      }

      let fullContent = '';
      let successCount = 0;
      
      for (const pageNum of pages) {
        if (pageNum > pdf.numPages) {
          console.warn(`⚠️ 頁數 ${pageNum} 超出PDF總頁數 ${pdf.numPages}`);
          continue;
        }

        try {
          console.log(`📖 正在提取第 ${pageNum} 頁...`);
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => {
              if (item && item.str) {
                return item.str;
              }
              return '';
            })
            .filter(text => text.trim().length > 0)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText.length > 10) {
            fullContent += `\n\n=== 第 ${pageNum} 頁內容 ===\n${pageText}`;
            successCount++;
            console.log(`✅ 第 ${pageNum} 頁提取成功，內容長度: ${pageText.length}`);
          } else {
            console.warn(`⚠️ 第 ${pageNum} 頁內容過少或為空`);
          }
        } catch (pageError) {
          console.error(`❌ 提取第 ${pageNum} 頁失敗:`, pageError);
        }
      }

      console.log('📊 提取統計:', {
        總頁數: pages.length,
        成功頁數: successCount,
        內容總長度: fullContent.length
      });

      if (fullContent.length < 50) {
        throw new Error(`PDF內容提取不足，可能原因：
1. PDF是掃描版圖片，無法提取文字
2. 指定頁面內容過少
3. PDF檔案損壞
請檢查PDF是否為文字版本，或嘗試其他頁數範圍`);
      }

      console.log('📖 內容預覽:', fullContent.substring(0, 200) + '...');
      return fullContent;

    } catch (error) {
      console.error('❌ PDF內容提取失敗:', error);
      
      // 提供更具體的錯誤訊息
      if (error instanceof Error && error.message.includes('worker')) {
        throw new Error('PDF處理器載入失敗，請重新整理頁面後再試');
      } else if (error instanceof Error && error.message.includes('Invalid PDF')) {
        throw new Error('PDF檔案格式無效，請檢查檔案是否完整');
      } else {
        throw new Error(`PDF處理失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
      }
    }
  };

  // 模擬進度更新
  const simulateProgress = (questionCount: number) => {
    let progress = 0;
    const steps = [
      '📖 正在分析PDF內容...',
      '🧠 理解文件結構與重點...',
      '✏️ 基於實際內容生成題目...',
      '🎯 優化題目品質與解析...',
      '✅ 完成題目生成...'
    ];
    
    const interval = setInterval(() => {
      if (progress < 85) {
        progress += Math.random() * 12 + 8;
        if (progress > 85) progress = 85;
        
        const stepIndex = Math.floor((progress / 85) * steps.length);
        setGenerationProgress(Math.round(progress));
        setGenerationStep(steps[stepIndex] || steps[steps.length - 1]);
      }
    }, 1200);
    
    return interval;
  };

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    if (!uploadedFile) {
      throw new Error('請先上傳PDF檔案');
    }

    if (!parameters.chapter || parameters.chapter.trim() === '') {
      throw new Error('請指定要出題的PDF頁數範圍');
    }

    setGenerationProgress(0);
    setGenerationStep('🔍 開始處理PDF檔案...');
    
    const progressInterval = simulateProgress(parameters.questionCount);
    
    try {
      // 提取PDF實際內容
      const pdfContent = await extractPDFContent(uploadedFile, parameters.chapter);
      
      setGenerationProgress(30);
      setGenerationStep('🤖 準備AI分析...');
      
      // 構建更嚴格的系統提示
      const systemPrompt = `你是專業的教育評量專家。請嚴格按照以下要求生成題目：

**重要：你必須只能基於以下PDF實際內容生成題目**

**PDF內容：**
${pdfContent}

**嚴格要求：**
1. 題目內容必須完全來自上述PDF內容
2. 不可使用任何PDF外的知識或資訊
3. 每個選項都必須基於PDF內容設計
4. 解析必須引用PDF中的具體段落或概念
5. 如果PDF內容不足，請說明並生成可能的數量

**輸出格式（JSON陣列）：**
[
  {
    "id": "1",
    "content": "完全基於PDF內容的題目...",
    "options": {
      "A": "選項A - 來自PDF",
      "B": "選項B - 來自PDF", 
      "C": "選項C - 來自PDF",
      "D": "選項D - 來自PDF"
    },
    "correct_answer": "A",
    "explanation": "解析：根據PDF第X頁提到的...",
    "question_type": "choice",
    "difficulty": 0.6,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "${parameters.chapter}",
    "source_pdf": "${uploadedFile.name}",
    "page_range": "${parameters.chapter}",
    "tags": ["基於PDF的標籤"]
  }
]`;

      const userPrompt = `請嚴格基於提供的PDF內容（第${parameters.chapter}頁），生成 ${parameters.questionCount} 道專業選擇題。

**要求：**
1. 只能使用PDF實際內容
2. 題目要測試對PDF內容的理解
3. 解析要引用PDF具體內容
4. 確保JSON格式正確

請立即開始生成：`;

      console.log('🎯 向AI發送生成請求...');
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt,
          pdfContent,
          model: 'gpt-4o'
        }
      });

      clearInterval(progressInterval);
      
      if (response.error) {
        console.error('❌ AI服務錯誤:', response.error);
        throw new Error(response.error.message || 'AI服務錯誤');
      }

      if (!response.data?.generatedText) {
        throw new Error('AI未返回有效內容，請重新嘗試');
      }

      setGenerationProgress(90);
      setGenerationStep('🔍 處理生成結果...');

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

      // 嚴格驗證題目品質 - 修復類型檢查問題
      const validQuestions = questions.filter((q: any) => {
        const isValid = q && 
          typeof q === 'object' && 
          q.content && 
          typeof q.content === 'string' &&
          q.content.length >= 15 && 
          q.correct_answer && 
          q.explanation && 
          typeof q.explanation === 'string' &&
          q.explanation.length >= 30 && 
          q.options &&
          typeof q.options === 'object' &&
          Object.keys(q.options).length >= 4 &&
          Object.values(q.options).every(opt => opt && typeof opt === 'string' && opt.length > 0);
          
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
      }, 2000);

      return validQuestions;
      
    } catch (error) {
      console.error('❌ 完整錯誤資訊:', error);
      clearInterval(progressInterval);
      setGenerationProgress(0);
      setGenerationStep('');
      
      toast({
        title: "生成失敗",
        description: error instanceof Error ? error.message : '請檢查PDF檔案並重新嘗試',
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
