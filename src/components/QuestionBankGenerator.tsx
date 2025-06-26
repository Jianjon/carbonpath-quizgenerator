import React, { useState, useEffect } from 'react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { QuestionDisplay } from './QuestionDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, FileText, Settings, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

type ChapterType = 'topic' | 'pages';

interface Parameters {
  chapter: string;
  chapterType: ChapterType;
  difficulty: string;
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: SampleQuestion[];
  weightingConfig: WeightingConfig;
  keywords?: string;
}

export const QuestionBankGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showOutlineSelector, setShowOutlineSelector] = useState(false);
  const [parameters, setParameters] = useState<Parameters>({
    chapter: '',
    chapterType: 'topic',
    difficulty: 'medium',
    questionCount: 10,
    questionTypes: ['multiple-choice'], // 固定為選擇題
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
  const [isGenerating, setIsGenerating] = useState(false);

  // 取得最終使用的難度設定
  const getEffectiveDifficulty = () => {
    const { easy, medium, hard } = parameters.weightingConfig.difficultyDistribution;
    const hasAdvancedDifficulty = !(easy === 20 && medium === 60 && hard === 20);
    
    if (hasAdvancedDifficulty) {
      return parameters.weightingConfig.difficultyDistribution;
    }
    
    switch (parameters.difficulty) {
      case 'easy':
        return { easy: 70, medium: 25, hard: 5 };
      case 'medium':
        return { easy: 20, medium: 60, hard: 20 };
      case 'hard':
        return { easy: 10, medium: 30, hard: 60 };
      case 'expert':
        return { easy: 5, medium: 15, hard: 80 };
      default:
        return { easy: 20, medium: 60, hard: 20 };
    }
  };

  // 處理上傳完成事件
  const handleUploadComplete = () => {
    // 如果沒有指定章節範圍，顯示大綱選擇器
    if (!parameters.chapter) {
      setShowOutlineSelector(true);
      toast({
        title: "選擇出題範圍",
        description: "請從 PDF 大綱中選擇要出題的主題範圍",
      });
    }
  };

  const generateQuestionsWithAI = async () => {
    const effectiveDifficulty = getEffectiveDifficulty();
    
    let chapterPrompt = '';
    if (parameters.chapterType === 'pages' && parameters.chapter) {
      chapterPrompt = `請針對 PDF 文件的第 ${parameters.chapter} 頁內容出題`;
    } else if (parameters.chapter) {
      chapterPrompt = `請針對「${parameters.chapter}」這個主題出題`;
    }

    const keywordsPrompt = parameters.keywords 
      ? `\n請特別聚焦在以下關鍵字相關的內容：${parameters.keywords}`
      : '';

    // 固定為選擇題的系統提示
    const systemPrompt = `你是一位專業的教育測驗專家。

**重要：你只能回傳純 JSON 陣列格式，絕對不能包含任何其他內容**

要求：
${chapterPrompt}${keywordsPrompt}
- 題目數量：${parameters.questionCount}
- 題型：選擇題（四選一）

難度分佈：
- 簡單：${effectiveDifficulty.easy}%
- 中等：${effectiveDifficulty.medium}%
- 困難：${effectiveDifficulty.hard}%

認知層次分佈：
- 記憶：${parameters.weightingConfig.cognitiveDistribution.remember}%
- 理解：${parameters.weightingConfig.cognitiveDistribution.understand}%
- 應用：${parameters.weightingConfig.cognitiveDistribution.apply}%
- 分析：${parameters.weightingConfig.cognitiveDistribution.analyze}%

${parameters.sampleQuestions.length > 0 ? `
參考樣題：
${parameters.sampleQuestions.map((q, i) => `
${i + 1}. ${q.question}
${q.options ? q.options.join('\n') : ''}
答案：${q.answer}
`).join('\n')}
` : ''}

**回傳格式（只能是這個格式，不能有任何其他文字）：**

[
  {
    "id": "1",
    "content": "題目內容",
    "options": {"A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D"},
    "correct_answer": "A",
    "explanation": "詳細解析",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "章節名稱",
    "source_pdf": "${uploadedFile?.name || ''}",
    "page_range": "${parameters.chapterType === 'pages' ? parameters.chapter : ''}",
    "tags": ["關鍵字1", "關鍵字2"]
  }
]

記住：只回傳 JSON 陣列，不要有任何解釋或其他文字！`;

    try {
      console.log('開始呼叫 AI 生成題目...');
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `請嚴格按照上述 JSON 格式生成 ${parameters.questionCount} 道選擇題。只回傳 JSON 陣列，不要有任何其他內容。${uploadedFile?.name ? `\n參考 PDF：${uploadedFile.name}` : chapterPrompt}`,
          model: 'gpt-4o'
        }
      });

      console.log('AI 回應:', response);

      if (response.error) {
        console.error('Supabase function error:', response.error);
        throw new Error(response.error.message || '呼叫 AI 服務失敗');
      }

      if (!response.data?.generatedText) {
        throw new Error('AI 回應格式錯誤：缺少生成內容');
      }

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('成功解析題目:', questions);
      } catch (parseError) {
        console.error('前端 JSON 解析錯誤:', parseError);
        console.error('收到的回應:', response.data.generatedText?.substring(0, 500));
        throw new Error(`無法解析 AI 生成的題目：${parseError.message}`);
      }

      // 確保是陣列格式
      if (!Array.isArray(questions)) {
        questions = [questions];
      }

      // 驗證題目格式
      const validQuestions = questions.filter(q => 
        q && 
        typeof q === 'object' &&
        q.content && 
        q.correct_answer && 
        q.explanation &&
        q.question_type
      );

      if (validQuestions.length === 0) {
        throw new Error('生成的題目格式不完整，請重新嘗試');
      }

      console.log('有效題目數量:', validQuestions.length);
      setGeneratedQuestions(validQuestions);
      
      toast({
        title: "生成成功",
        description: `成功生成 ${validQuestions.length} 道選擇題`,
      });

    } catch (error) {
      console.error('生成題目時發生錯誤:', error);
      toast({
        title: "生成失敗",
        description: error.message || '請檢查網路連接後重新嘗試',
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile && !parameters.chapter) {
      toast({
        title: "請先完成設定",
        description: "請上傳 PDF 檔案或輸入章節名稱",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    await generateQuestionsWithAI();
    setIsGenerating(false);
  };

  return (
    <div className="max-w-full mx-auto">
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* 左側：教材上傳與參數設定 (1/3) */}
        <div className="w-1/3 space-y-6 overflow-y-auto pr-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                教材上傳
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PDFUploader 
                uploadedFile={uploadedFile}
                onFileUpload={setUploadedFile}
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-600" />
                參數設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ParameterSettings 
                parameters={parameters}
                onParametersChange={setParameters}
                uploadedFile={uploadedFile}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleGenerate}
                disabled={(!uploadedFile && !parameters.chapter) || isGenerating}
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Zap className="h-5 w-5 mr-2" />
                {isGenerating ? '生成中...' : '開始生成題庫'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右側：生成結果與預覽 (2/3) */}
        <div className="w-2/3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                生成結果與預覽
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-4rem)] overflow-y-auto">
              <QuestionDisplay questions={generatedQuestions} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
