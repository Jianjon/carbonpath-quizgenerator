
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// 設定PDF.js worker
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

  // 提取PDF指定頁面的內容
  const extractPDFContent = async (file: File, pageRange: string): Promise<string> => {
    try {
      console.log('🔍 開始提取PDF內容，頁數範圍:', pageRange);
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: false,
        isEvalSupported: false
      }).promise;

      const pages = parsePageRange(pageRange);
      console.log('📄 解析的頁數:', pages);

      if (pages.length === 0) {
        throw new Error('無法解析頁數範圍，請使用格式如：1-5, 8, 10-12');
      }

      let fullContent = '';
      for (const pageNum of pages) {
        if (pageNum > pdf.numPages) {
          console.warn(`⚠️ 頁數 ${pageNum} 超出PDF總頁數 ${pdf.numPages}`);
          continue;
        }

        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText.length > 0) {
            fullContent += `\n\n=== 第 ${pageNum} 頁內容 ===\n${pageText}`;
          }
        } catch (pageError) {
          console.error(`❌ 提取第 ${pageNum} 頁失敗:`, pageError);
        }
      }

      console.log('📊 提取的內容總長度:', fullContent.length);
      console.log('📖 內容預覽:', fullContent.substring(0, 200));

      if (fullContent.length < 100) {
        throw new Error('提取的PDF內容過少，可能是掃描版PDF或頁面內容不足');
      }

      return fullContent;

    } catch (error) {
      console.error('❌ PDF內容提取失敗:', error);
      throw new Error(`PDF內容提取失敗：${error.message}`);
    }
  };

  // 模擬進度更新
  const simulateProgress = (questionCount: number) => {
    let progress = 0;
    const steps = [
      '📖 正在讀取PDF指定頁面...',
      '🧠 深度分析頁面內容...',
      '✏️ 基於實際內容生成題目...',
      '🎯 優化題目品質...',
      '✅ 完成題目生成...'
    ];
    
    const interval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 15 + 5;
        if (progress > 90) progress = 90;
        
        const stepIndex = Math.floor((progress / 90) * steps.length);
        setGenerationProgress(Math.round(progress));
        setGenerationStep(steps[stepIndex] || steps[steps.length - 1]);
      }
    }, 1500);
    
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
    setGenerationStep('🔍 開始處理PDF內容...');
    
    const progressInterval = simulateProgress(parameters.questionCount);
    
    try {
      // 提取PDF實際內容
      const pdfContent = await extractPDFContent(uploadedFile, parameters.chapter);
      
      // 構建系統提示
      const systemPrompt = `你是專業的題目生成專家。你必須嚴格基於提供的PDF頁面內容來生成考試題目。

**重要原則：**
1. 只能使用PDF內容中的資訊來生成題目
2. 題目必須直接來自PDF內容，不可使用外部知識
3. 每個解析都必須引用PDF中的具體內容
4. 如果PDF內容不足以生成指定數量的題目，請如實說明

**題目格式要求（JSON陣列）：**
[
  {
    "id": "1",
    "content": "基於PDF內容的題目...",
    "options": {
      "A": "選項A",
      "B": "選項B", 
      "C": "選項C",
      "D": "選項D"
    },
    "correct_answer": "正確答案字母",
    "explanation": "解析必須引用PDF中的具體內容...",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "淨零碳排放",
    "source_pdf": "${uploadedFile.name}",
    "page_range": "${parameters.chapter}",
    "tags": ["相關標籤"]
  }
]`;

      const userPrompt = `請基於提供的PDF第 ${parameters.chapter} 頁內容，生成 ${parameters.questionCount} 道專業的選擇題。

**具體要求：**
1. 題目必須完全基於PDF實際內容
2. 不得使用PDF外的任何知識
3. 解析要引用PDF中的具體內容
4. 如果內容不足，請說明原因並生成可能的數量

請立即生成題目：`;

      console.log('🎯 發送題目生成請求');
      
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
        console.error('❌ 生成服務錯誤:', response.error);
        throw new Error(response.error.message || '服務錯誤');
      }

      if (!response.data || !response.data.generatedText) {
        throw new Error('系統未能生成有效回應，請重新嘗試');
      }

      setGenerationProgress(95);
      setGenerationStep('🔎 驗證題目品質...');

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('✅ 題目解析成功:', questions.length, '道');
      } catch (parseError) {
        console.error('❌ 格式解析失敗:', parseError);
        throw new Error(`題目格式處理失敗，請重新嘗試生成`);
      }

      if (!Array.isArray(questions)) {
        questions = [questions];
      }

      // 驗證題目品質
      const validQuestions = questions.filter(q => 
        q && 
        typeof q === 'object' && 
        q.content && 
        q.content.length > 10 && 
        q.correct_answer && 
        q.explanation && 
        q.explanation.length > 20 && 
        q.options &&
        Object.keys(q.options).length >= 4
      );

      console.log('📊 題目品質檢驗結果:', {
        原始數量: questions.length,
        有效數量: validQuestions.length,
        目標數量: parameters.questionCount
      });

      if (validQuestions.length === 0) {
        throw new Error('生成的題目未能通過品質檢驗，請重新嘗試');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 題目生成完成！');
      
      toast({
        title: "題目生成完成",
        description: `成功基於PDF第${parameters.chapter}頁生成 ${validQuestions.length} 道題目`,
        variant: "default"
      });

      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 3000);

      return validQuestions;
      
    } catch (error) {
      console.error('❌ 生成過程失敗:', error);
      clearInterval(progressInterval);
      setGenerationProgress(0);
      setGenerationStep('');
      
      toast({
        title: "生成失敗",
        description: error.message || '請重新嘗試',
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
