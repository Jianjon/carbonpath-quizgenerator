
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// 設定 PDF.js 使用本地 worker
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

  // 簡化頁數解析
  const parsePageRange = (pageRange: string): number[] => {
    const pages: number[] = [];
    const parts = pageRange.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(p => parseInt(p.trim()));
        if (!isNaN(start) && !isNaN(end) && start <= end && start > 0) {
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        }
      } else {
        const pageNum = parseInt(trimmed);
        if (!isNaN(pageNum) && pageNum > 0) {
          pages.push(pageNum);
        }
      }
    }
    
    return [...new Set(pages)].sort((a, b) => a - b);
  };

  // 極簡化的 PDF 內容提取
  const extractPDFContent = async (file: File, pageRange: string): Promise<string> => {
    try {
      console.log('🔍 開始處理 PDF...');
      setGenerationStep('📖 讀取PDF檔案...');
      setGenerationProgress(10);
      
      const arrayBuffer = await file.arrayBuffer();
      
      setGenerationStep('🔧 初始化PDF...');
      setGenerationProgress(20);
      
      // 最簡單的 PDF 載入配置
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: false,
        disableFontFace: true,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true
      }).promise;
      
      console.log('✅ PDF 載入成功，總頁數:', pdf.numPages);
      
      setGenerationStep('📄 解析頁數...');
      setGenerationProgress(30);
      
      const pages = parsePageRange(pageRange);
      
      if (pages.length === 0) {
        throw new Error('請輸入有效的頁數範圍，例如：1-5 或 1,3,8');
      }
      
      let content = '';
      const maxPages = Math.min(pages.length, 10); // 限制最多10頁
      
      setGenerationStep('📖 提取內容...');
      
      for (let i = 0; i < maxPages; i++) {
        const pageNum = pages[i];
        
        if (pageNum > pdf.numPages) {
          console.warn(`頁數 ${pageNum} 超出範圍`);
          continue;
        }
        
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ')
            .trim();
          
          if (pageText.length > 10) {
            content += `\n=== 第 ${pageNum} 頁 ===\n${pageText}\n`;
          }
        } catch (error) {
          console.warn(`跳過第 ${pageNum} 頁:`, error);
        }
        
        setGenerationProgress(30 + (i / maxPages) * 40);
      }
      
      if (content.length < 50) {
        throw new Error('PDF 內容太少，請確認是文字版 PDF');
      }
      
      setGenerationStep('✅ 內容提取完成');
      setGenerationProgress(70);
      
      return content;
      
    } catch (error) {
      console.error('PDF 處理錯誤:', error);
      throw new Error(`PDF 處理失敗: ${error.message}`);
    }
  };

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    if (!uploadedFile) {
      throw new Error('請先上傳 PDF 檔案');
    }

    if (!parameters.chapter?.trim()) {
      throw new Error('請輸入頁數範圍');
    }

    setGenerationProgress(0);
    setGenerationStep('🚀 開始處理...');
    
    try {
      const pdfContent = await extractPDFContent(uploadedFile, parameters.chapter);
      
      setGenerationStep('🤖 AI 分析中...');
      setGenerationProgress(75);
      
      const prompt = `基於以下 PDF 內容，生成 ${parameters.questionCount} 道選擇題。

PDF 內容：
${pdfContent}

請嚴格按照此 JSON 格式回答：
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
    "tags": ["標籤"]
  }
]

要求：題目必須完全基於提供的 PDF 內容，不得添加其他資訊。`;

      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          prompt,
          model: 'gpt-4o-mini'
        }
      });

      if (response.error) {
        throw new Error(`AI 服務錯誤: ${response.error.message}`);
      }

      setGenerationStep('🔍 處理結果...');
      setGenerationProgress(90);

      let result = response.data?.choices?.[0]?.message?.content || response.data?.generatedText || '';
      
      // 清理 JSON
      result = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let questions;
      try {
        questions = JSON.parse(result);
      } catch (e) {
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

      setGenerationProgress(100);
      setGenerationStep('🎉 完成！');
      
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);

      return validQuestions;
      
    } catch (error) {
      console.error('生成失敗:', error);
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
