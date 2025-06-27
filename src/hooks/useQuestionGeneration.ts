
import { useState } from 'react';
import { extractPDFContent, PDFProcessResult } from '@/utils/pdfProcessor';
import { callAIService, AIGenerationResult } from '@/services/questionGenerationService';
import { Parameters, QuestionData } from '@/types/question';

export const useQuestionGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [pdfPreview, setPdfPreview] = useState<string>('');

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    if (!uploadedFile) {
      throw new Error('請先上傳 PDF 檔案');
    }

    setGenerationProgress(0);
    setGenerationStep('🚀 開始處理...');
    
    try {
      console.log('📖 開始提取 PDF 內容...');
      console.log('檔案名稱:', uploadedFile.name);
      console.log('檔案大小:', (uploadedFile.size / 1024 / 1024).toFixed(2), 'MB');
      
      // 提取 PDF 內容
      const pdfResult: PDFProcessResult = await extractPDFContent(
        uploadedFile, 
        setGenerationStep, 
        setGenerationProgress
      );
      
      // 設置預覽內容
      if (pdfResult.isSuccess && pdfResult.content.length > 0) {
        setPdfPreview(pdfResult.content.substring(0, 300) + '...');
      }
      
      if (!pdfResult.isSuccess) {
        throw new Error(pdfResult.error || 'PDF 處理失敗');
      }
      
      setGenerationStep('🤖 AI 分析生成中...');
      setGenerationProgress(80);
      
      console.log('🤖 開始 AI 生成...');
      const aiResult: AIGenerationResult = await callAIService(parameters, pdfResult, uploadedFile);
      
      if (!aiResult.isSuccess) {
        throw new Error(aiResult.error || 'AI 生成失敗');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 完成！');
      
      // 顯示生成統計
      console.log('📊 生成統計:');
      console.log('- PDF 頁數:', pdfResult.pageCount);
      console.log('- 提取頁數:', pdfResult.extractedPages);
      console.log('- 內容字數:', pdfResult.wordCount);
      console.log('- 生成題數:', aiResult.questions.length);
      console.log('- Token 估算:', aiResult.tokenUsage);
      
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);

      return aiResult.questions;
      
    } catch (error) {
      console.error('❌ 生成失敗:', error);
      setGenerationProgress(0);
      setGenerationStep('');
      setPdfPreview('');
      throw error;
    }
  };

  return {
    isGenerating,
    setIsGenerating,
    generationProgress,
    generationStep,
    pdfPreview,
    generateQuestionsWithAI
  };
};
