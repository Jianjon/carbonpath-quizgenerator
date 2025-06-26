import React, { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useUserSession } from '@/hooks/useUserSession';
import { useQuestionGeneration } from '@/hooks/useQuestionGeneration';
import { useAutoSave } from '@/hooks/useAutoSave';
import { MobileLayout } from './MobileLayout';
import { DesktopLayout } from './DesktopLayout';

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

interface Parameters {
  chapter: string;
  questionStyle: string;
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: SampleQuestion[];
  keywords?: string;
  weightingConfig: WeightingConfig;
}

export const QuestionBankGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parameters, setParameters] = useState<Parameters>({
    chapter: '',
    questionStyle: 'intuitive',
    questionCount: 10,
    questionTypes: ['multiple-choice'],
    sampleQuestions: [] as SampleQuestion[],
    keywords: '',
    weightingConfig: {
      chapterWeights: [],
      difficultyDistribution: {
        easy: 20,
        medium: 60,
        hard: 20
      },
      cognitiveDistribution: {
        remember: 20,
        understand: 40,
        apply: 30,
        analyze: 10
      },
      questionTypeWeights: {
        multipleChoice: 70,
        trueFalse: 15,
        shortAnswer: 10,
        essay: 5
      }
    }
  });
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionData[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // 使用自定義 hooks
  const { sessionId, setSessionId, getUserIP } = useUserSession();
  const { 
    isGenerating, 
    setIsGenerating, 
    generationProgress, 
    generationStep, 
    generateQuestionsWithAI 
  } = useQuestionGeneration();
  const { updateQuestionsInDatabase, saveQuestionsToDatabase } = useAutoSave(
    generatedQuestions, 
    parameters, 
    sessionId, 
    setSessionId, 
    getUserIP
  );

  // 檢測是否為手機版
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 處理上傳完成事件
  const handleUploadComplete = () => {
    if (!parameters.chapter) {
      toast({
        title: "請設定出題範圍",
        description: "請在基本設定中輸入出題的PDF頁數範圍"
      });
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile && !parameters.chapter) {
      toast({
        title: "請先完成設定",
        description: "請上傳 PDF 檔案或輸入頁數範圍",
        variant: "destructive"
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      console.log('🚀 開始生成題目...');
      const questions = await generateQuestionsWithAI(parameters, uploadedFile);
      
      console.log('✅ 題目生成成功，準備保存到資料庫');
      console.log('生成的題目數量:', questions.length);
      console.log('題目內容預覽:', questions.slice(0, 2));
      
      setGeneratedQuestions(questions);
      
      // 顯示成功訊息，確認題目已保存
      toast({
        title: "題目生成完成",
        description: `成功生成 ${questions.length} 道題目並保存到資料庫`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('❌ 生成題目失敗:', error);
      toast({
        title: "生成失敗",
        description: error.message || '請重新嘗試',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 處理題目更新時，確保同步更新到資料庫
  const handleQuestionsChange = async (updatedQuestions: QuestionData[]) => {
    console.log('📝 題目被修改，準備更新到資料庫');
    console.log('修改後的題目數量:', updatedQuestions.length);
    
    setGeneratedQuestions(updatedQuestions);
    
    // 當題目被修改時，立即更新到資料庫
    if (sessionId && updatedQuestions.length > 0) {
      try {
        await updateQuestionsInDatabase(updatedQuestions);
        console.log('✅ 題目修改已同步到資料庫');
        
        toast({
          title: "題目已更新",
          description: "修改已自動保存到資料庫",
          variant: "default"
        });
      } catch (error) {
        console.error('❌ 同步題目修改失敗:', error);
        toast({
          title: "同步失敗",
          description: "題目修改未能保存到資料庫",
          variant: "destructive"
        });
      }
    }
  };

  const commonProps = {
    uploadedFile,
    setUploadedFile,
    handleUploadComplete,
    parameters,
    setParameters,
    generatedQuestions,
    isGenerating,
    generationProgress,
    generationStep,
    onGenerate: handleGenerate,
    onQuestionsChange: handleQuestionsChange
  };

  if (isMobile) {
    return <MobileLayout {...commonProps} />;
  }

  return <DesktopLayout {...commonProps} />;
};
