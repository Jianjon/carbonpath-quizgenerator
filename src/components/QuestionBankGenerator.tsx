import React, { useState, useEffect } from 'react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { QuestionDisplay } from './QuestionDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Brain, FileText, Settings, Zap, Loader2 } from 'lucide-react';
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
  questionStyle: string; // 改為題目風格
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: SampleQuestion[];
  weightingConfig: WeightingConfig;
  keywords?: string;
}
export const QuestionBankGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parameters, setParameters] = useState<Parameters>({
    chapter: '',
    chapterType: 'topic',
    questionStyle: 'intuitive',
    // 改為題目風格，預設為直覺刷題型
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');

  // 取得最終使用的難度設定
  const getEffectiveDifficulty = () => {
    const hasAdvancedDifficulty = parameters.weightingConfig.difficultyDistribution.easy !== 20 || parameters.weightingConfig.difficultyDistribution.medium !== 60 || parameters.weightingConfig.difficultyDistribution.hard !== 20;
    if (hasAdvancedDifficulty) {
      return parameters.weightingConfig.difficultyDistribution;
    }

    // 根據題目風格設定預設難度分佈
    switch (parameters.questionStyle) {
      case 'intuitive':
        return {
          easy: 60,
          medium: 30,
          hard: 10
        };
      case 'application':
        return {
          easy: 20,
          medium: 60,
          hard: 20
        };
      case 'diagnostic':
        return {
          easy: 10,
          medium: 50,
          hard: 40
        };
      case 'strategic':
        return {
          easy: 5,
          medium: 25,
          hard: 70
        };
      default:
        return {
          easy: 20,
          medium: 60,
          hard: 20
        };
    }
  };

  // 取得題目風格的完整 prompt 描述
  const getQuestionStylePrompt = (style: string) => {
    switch (style) {
      case 'intuitive':
        return `【直覺刷題型】
        - 題目應該簡潔明瞭，一眼就能看懂核心概念
        - 每題只考察一個明確的知識點，避免多重概念混合
        - 正確答案應該是學過內容的人能直接想到的
        - 錯誤選項要明顯錯誤，不需要深度分析即可排除
        - 適合快速複習和基礎概念確認
        - 語言表達要直白，避免繞彎子的描述`;
        
      case 'application':
        return `【素養應用型】
        - 基於真實情境或案例背景出題，讓學生感受知識的實用性
        - 題目要描述一個具體的問題場景，考生需要運用所學概念解決實際問題
        - 正確答案應該是最適合該情境的解決方案
        - 錯誤選項要包含看似合理但不適用於該情境的方案
        - 培養學生將理論知識轉化為實際應用的能力
        - 題目描述要生動具體，讓考生有身歷其境的感覺`;
        
      case 'diagnostic':
        return `【錯誤診斷型】
        - 刻意加入學生常見的錯誤觀念或迷思概念作為選項
        - 正確答案要能明確澄清常見的誤解
        - 錯誤選項應該設計成「看起來很有道理但實際錯誤」的陷阱
        - 幫助學生識別和修正學習過程中的盲點
        - 題目要能引導學生深入思考為什麼某些看似正確的概念其實是錯誤的
        - 解析要詳細說明為什麼錯誤選項是錯的，正確選項為什麼對`;
        
      case 'strategic':
        return `【策略推演型】
        - 設計需要多步驟邏輯推理的複雜情境
        - 題目要包含多個變數和條件，考生需要綜合分析
        - 正確答案應該是經過完整推理過程得出的最佳策略
        - 錯誤選項要包含推理過程中可能的錯誤判斷點
        - 考察學生的批判性思維和決策分析能力
        - 題目要設計成需要比較不同方案優劣的形式`;
        
      default:
        return '題目應簡單清楚，聚焦單一知識點，讓學生用直覺作答，不須綜合思考';
    }
  };

  // 處理上傳完成事件
  const handleUploadComplete = () => {
    if (!parameters.chapter) {
      toast({
        title: "請設定出題範圍",
        description: "請在基本設定中輸入出題的主題或頁數範圍"
      });
    }
  };
  const generateQuestionsWithAI = async () => {
    const effectiveDifficulty = getEffectiveDifficulty();
    const effectiveCognitive = parameters.weightingConfig.cognitiveDistribution;
    const hasAdvancedSettings = parameters.keywords || parameters.sampleQuestions.length > 0;
    
    setGenerationProgress(0);
    setGenerationStep('準備生成參數...');
    
    let chapterPrompt = '';
    if (parameters.chapterType === 'pages' && parameters.chapter) {
      chapterPrompt = `請針對 PDF 文件的第 ${parameters.chapter} 頁內容出題`;
    } else if (parameters.chapter) {
      chapterPrompt = `請針對「${parameters.chapter}」這個主題出題`;
    }
    
    const keywordsPrompt = parameters.keywords ? `\n請特別聚焦在以下關鍵字相關的內容：${parameters.keywords}` : '';
    const stylePrompt = getQuestionStylePrompt(parameters.questionStyle);
    
    setGenerationProgress(20);
    setGenerationStep('構建提示內容...');
    
    let advancedSettingsPrompt = '';
    if (hasAdvancedSettings) {
      advancedSettingsPrompt = `

進階設定配置：
- 關鍵字聚焦：${parameters.keywords || '無'}
- 樣題參考數量：${parameters.sampleQuestions.length} 個`;
    }

    const systemPrompt = `你是一位專業的教育測驗專家和學習心理學家。請根據指定的題目風格生成高品質的教育測驗題目。

出題要求：
${chapterPrompt}${keywordsPrompt}
- 題目數量：${parameters.questionCount}
- 題型：選擇題（四選一，選項標示為 A、B、C、D）

題目風格要求：
${stylePrompt}

AI 智慧表達要求：
- 運用教育心理學原理，針對不同學習階段設計適合的認知負荷
- 善用布魯姆分類法，讓題目層次分明
- 融入最新的學習科學研究成果
- 每個選項都要有其設計邏輯和教育目的
- 解析要展現深度思考，不只是標準答案的重述

回傳格式必須是純 JSON 陣列，不包含任何其他文字：

[
  {
    "id": "1",
    "content": "題目內容",
    "options": {"A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D"},
    "correct_answer": "A",
    "explanation": "詳細解析，要說明為什麼這個答案正確，其他選項為什麼不適合",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "章節名稱",
    "source_pdf": "${uploadedFile?.name || ''}",
    "page_range": "${parameters.chapterType === 'pages' ? parameters.chapter : ''}",
    "tags": ["關鍵字1", "關鍵字2"]
  }
]${advancedSettingsPrompt}

${parameters.sampleQuestions.length > 0 ? `
參考樣題風格：
${parameters.sampleQuestions.map((q, i) => `
${i + 1}. ${q.question}
${q.options ? q.options.join('\n') : ''}
答案：${q.answer}
`).join('\n')}
` : ''}

重要提醒：
1. 每種題目風格都有其獨特的教育目的和設計邏輯
2. 要充分展現 AI 在教育測驗設計上的專業能力
3. 只回傳 JSON 陣列，不要有任何解釋或其他文字！`;

    try {
      setGenerationProgress(40);
      setGenerationStep('呼叫 AI 生成服務...');
      console.log('開始呼叫 AI 生成題目...');
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `請嚴格按照上述 JSON 格式生成 ${parameters.questionCount} 道選擇題。只回傳 JSON 陣列，不要有任何其他內容。`,
          model: 'gpt-4o-mini'
        }
      });

      setGenerationProgress(70);
      setGenerationStep('處理 AI 回應...');
      console.log('AI 回應:', response);

      if (response.error) {
        console.error('Supabase function error:', response.error);
        throw new Error(response.error.message || '呼叫 AI 服務失敗');
      }

      if (!response.data?.generatedText) {
        throw new Error('AI 回應格式錯誤：缺少生成內容');
      }

      setGenerationProgress(85);
      setGenerationStep('解析生成的題目...');

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('成功解析題目:', questions);
      } catch (parseError) {
        console.error('前端 JSON 解析錯誤:', parseError);
        console.error('收到的回應:', response.data.generatedText?.substring(0, 500));
        throw new Error(`無法解析 AI 生成的題目：${parseError.message}`);
      }

      if (!Array.isArray(questions)) {
        questions = [questions];
      }

      setGenerationProgress(95);
      setGenerationStep('驗證題目格式...');

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

      setGenerationProgress(100);
      setGenerationStep('生成完成！');
      console.log('有效題目數量:', validQuestions.length);
      
      setGeneratedQuestions(validQuestions);
      toast({
        title: "生成成功",
        description: `成功生成 ${validQuestions.length} 道選擇題`
      });

      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);
    } catch (error) {
      console.error('生成題目時發生錯誤:', error);
      setGenerationProgress(0);
      setGenerationStep('');
      toast({
        title: "生成失敗",
        description: error.message || '請檢查網路連接後重新嘗試',
        variant: "destructive"
      });
    }
  };
  const handleGenerate = async () => {
    if (!uploadedFile && !parameters.chapter) {
      toast({
        title: "請先完成設定",
        description: "請上傳 PDF 檔案或輸入章節名稱",
        variant: "destructive"
      });
      return;
    }
    setIsGenerating(true);
    await generateQuestionsWithAI();
    setIsGenerating(false);
  };
  return <div className="max-w-full mx-auto p-4">
      <div className="flex gap-6">
        {/* 左側：教材上傳與參數設定 (1/3) */}
        <div className="w-1/3 space-y-6 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-blue-600" />
                教材上傳
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-[7px] my-0 mx-0 bg-transparent">
              <PDFUploader 
                uploadedFile={uploadedFile} 
                onFileUpload={setUploadedFile} 
                onUploadComplete={handleUploadComplete} 
              />
            </CardContent>
          </Card>

          <ParameterSettings 
            parameters={parameters} 
            onParametersChange={setParameters} 
            uploadedFile={uploadedFile} 
          />

          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* 進度顯示 */}
              {isGenerating && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600">{generationStep}</span>
                  </div>
                  <Progress value={generationProgress} className="h-2" />
                  <div className="text-xs text-gray-500 text-center">
                    {generationProgress}% 完成
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleGenerate} 
                disabled={!uploadedFile && !parameters.chapter || isGenerating} 
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Brain className="h-5 w-5 text-purple-600" />
                生成結果與預覽
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <QuestionDisplay 
                questions={generatedQuestions} 
                parameters={parameters}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
};
