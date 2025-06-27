
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// 簡單設定 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.js';

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

  // 簡化的PDF內容提取
  const extractPDFContent = async (file: File, pageRange: string): Promise<string> => {
    try {
      console.log('🔍 開始提取PDF內容，頁數範圍:', pageRange);
      setGenerationStep('📖 讀取PDF檔案...');
      setGenerationProgress(10);
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('✅ 檔案讀取完成');
      
      setGenerationStep('🔧 載入PDF...');
      setGenerationProgress(20);
      
      // 最簡單的PDF載入
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      console.log('📚 PDF 載入成功，總頁數:', pdf.numPages);

      setGenerationStep('📄 解析頁數範圍...');
      setGenerationProgress(30);

      const pages = parsePageRange(pageRange);
      console.log('📄 要提取的頁數:', pages);

      if (pages.length === 0) {
        throw new Error('無法解析頁數範圍，請使用格式如：1-5 或 1,3,5-8');
      }

      let fullContent = '';
      const maxPages = Math.min(pages.length, 20); // 限制最多20頁
      
      setGenerationStep('📖 提取頁面內容...');
      
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
            .map((item: any) => item.str)
            .join(' ')
            .trim();
          
          if (pageText.length > 10) {
            fullContent += `\n第 ${pageNum} 頁：${pageText}\n`;
            console.log(`✅ 第 ${pageNum} 頁提取成功，內容長度: ${pageText.length}`);
          }
        } catch (pageError) {
          console.error(`❌ 提取第 ${pageNum} 頁失敗:`, pageError);
        }
        
        // 更新進度
        const progress = 30 + (i / maxPages) * 30;
        setGenerationProgress(Math.round(progress));
      }

      console.log('📊 內容總長度:', fullContent.length);

      if (fullContent.length < 100) {
        throw new Error('PDF內容提取不足，請確認PDF是文字版本而非掃描版');
      }

      setGenerationStep('✅ PDF內容提取完成');
      setGenerationProgress(60);
      
      return fullContent;

    } catch (error) {
      console.error('❌ PDF內容提取失敗:', error);
      throw new Error(`PDF處理失敗：${error.message || '請重新嘗試'}`);
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
      setGenerationProgress(65);
      
      // 構建AI提示
      const systemPrompt = `你是專業的教育評量專家。請嚴格按照以下要求生成題目：

**PDF內容：**
${pdfContent}

**要求：**
1. 題目內容必須完全來自上述PDF內容
2. 每個選項都必須基於PDF內容設計
3. 解析必須引用PDF中的具體內容

**輸出格式（JSON陣列）：**
[
  {
    "id": "1",
    "content": "題目內容...",
    "options": {
      "A": "選項A",
      "B": "選項B", 
      "C": "選項C",
      "D": "選項D"
    },
    "correct_answer": "A",
    "explanation": "解析內容...",
    "question_type": "choice",
    "difficulty": 0.6,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "${parameters.chapter}",
    "source_pdf": "${uploadedFile.name}",
    "page_range": "${parameters.chapter}",
    "tags": ["相關標籤"]
  }
]`;

      const userPrompt = `請基於提供的PDF內容（第${parameters.chapter}頁），生成 ${parameters.questionCount} 道選擇題。`;

      setGenerationStep('🧠 AI正在分析內容...');
      setGenerationProgress(75);
      
      console.log('🎯 向AI發送生成請求...');
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt,
          pdfContent,
          model: 'gpt-4o-mini'
        }
      });

      if (response.error) {
        throw new Error(`AI服務錯誤: ${response.error.message}`);
      }

      if (!response.data?.generatedText) {
        throw new Error('AI未返回有效內容');
      }

      setGenerationStep('🔍 處理生成結果...');
      setGenerationProgress(90);

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
      } catch (parseError) {
        throw new Error('AI回應格式錯誤');
      }

      if (!Array.isArray(questions)) {
        questions = [questions];
      }

      // 簡單驗證
      const validQuestions = questions.filter((q: any) => 
        q && q.content && q.correct_answer && q.explanation && q.options
      );

      if (validQuestions.length === 0) {
        throw new Error('生成的題目品質不符合要求');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 題目生成完成！');
      
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);

      return validQuestions;
      
    } catch (error) {
      console.error('❌ 完整錯誤資訊:', error);
      setGenerationProgress(0);
      setGenerationStep('');
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
