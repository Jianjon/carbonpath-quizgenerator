
import { useState } from 'react';
import { extractPDFContent } from '@/utils/pdfProcessor';
import { callAIService } from '@/services/questionGenerationService';
import { Parameters, QuestionData } from '@/types/question';

export const useQuestionGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    if (!uploadedFile) {
      throw new Error('請先上傳PDF檔案');
    }

    setGenerationProgress(0);
    setGenerationStep('🚀 開始處理...');
    
    try {
      console.log('📖 開始提取PDF內容...');
      const pdfContent = await extractPDFContent(uploadedFile, setGenerationStep, setGenerationProgress);
      
      setGenerationStep('🤖 AI分析中...');
      setGenerationProgress(80);
      
      console.log('🤖 開始AI生成...');
      const questions = await callAIService(parameters, pdfContent, uploadedFile);

      setGenerationProgress(100);
      setGenerationStep('🎉 完成！');
      
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);

      return questions;
      
    } catch (error) {
      console.error('❌ 生成失敗:', error);
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
