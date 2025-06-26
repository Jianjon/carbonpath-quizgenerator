import React, { useState, useEffect } from 'react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { QuestionDisplay } from './QuestionDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, FileText, Settings, Zap } from 'lucide-react';

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
  type: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
  chapter: string;
  cognitiveLevel?: string;
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
  keywords?: string; // 新增關鍵字欄位
}

export const QuestionBankGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parameters, setParameters] = useState<Parameters>({
    chapter: '',
    chapterType: 'topic',
    difficulty: 'medium',
    questionCount: 10,
    questionTypes: ['multiple-choice'],
    sampleQuestions: [] as SampleQuestion[],
    keywords: '', // 初始化關鍵字
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
    // 檢查進階設定是否啟用（有自訂分佈且不全為預設值）
    const { easy, medium, hard } = parameters.weightingConfig.difficultyDistribution;
    const hasAdvancedDifficulty = !(easy === 20 && medium === 60 && hard === 20);
    
    if (hasAdvancedDifficulty) {
      return parameters.weightingConfig.difficultyDistribution;
    }
    
    // 使用基本設定
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

  const generateQuestionsWithAI = async () => {
    const effectiveDifficulty = getEffectiveDifficulty();
    
    // 根據章節類型調整提示詞
    let chapterPrompt = '';
    if (parameters.chapterType === 'pages' && parameters.chapter) {
      chapterPrompt = `請針對 PDF 文件的第 ${parameters.chapter} 頁內容出題`;
    } else if (parameters.chapter) {
      chapterPrompt = `請針對「${parameters.chapter}」這個主題出題`;
    }

    // 關鍵字提示
    const keywordsPrompt = parameters.keywords 
      ? `\n請特別聚焦在以下關鍵字相關的內容：${parameters.keywords}`
      : '';

    const systemPrompt = `你是一位專業的教育測驗專家，需要根據提供的教材內容生成高品質的題目。

${chapterPrompt}${keywordsPrompt}
- 題目數量：${parameters.questionCount}
- 題型：${parameters.questionTypes.join(', ')}

難度分佈：
- 簡單題：${effectiveDifficulty.easy}%
- 中等題：${effectiveDifficulty.medium}%
- 困難題：${effectiveDifficulty.hard}%

認知層次分佈（布魯姆分類法）：
- 記憶：${parameters.weightingConfig.cognitiveDistribution.remember}%
- 理解：${parameters.weightingConfig.cognitiveDistribution.understand}%
- 應用：${parameters.weightingConfig.cognitiveDistribution.apply}%
- 分析：${parameters.weightingConfig.cognitiveDistribution.analyze}%

${parameters.sampleQuestions.length > 0 ? `
參考樣題格式：
${parameters.sampleQuestions.map((q, i) => `
${i + 1}. ${q.question}
${q.options ? q.options.join('\n') : ''}
答案：${q.answer}
`).join('\n')}
` : ''}

請以 JSON 格式回傳，每個題目包含：
{
  "id": "題目編號",
  "type": "題型",
  "question": "題目內容",
  "options": ["選項陣列"],
  "answer": "正確答案",
  "explanation": "詳細解析",
  "difficulty": "難度等級",
  "chapter": "章節名稱",
  "cognitiveLevel": "認知層次"
}`;

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          userPrompt: `請生成 ${parameters.questionCount} 道題目，${uploadedFile?.name ? `參考 PDF 內容：${uploadedFile.name}` : chapterPrompt}`,
          model: 'gpt-4o-mini'
        })
      });

      if (!response.ok) {
        throw new Error(`API 請求失敗：${response.status}`);
      }

      const data = await response.json();
      const content = data.generatedText;
      
      // 嘗試解析 JSON
      let questions;
      try {
        questions = JSON.parse(content);
      } catch {
        // 如果直接解析失敗，嘗試提取 JSON 部分
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('無法解析 AI 回應');
        }
      }

      setGeneratedQuestions(Array.isArray(questions) ? questions : [questions]);
    } catch (error) {
      console.error('生成題目時發生錯誤:', error);
      alert(`生成失敗：${error.message}`);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile && !parameters.chapter) {
      alert('請上傳 PDF 檔案或輸入章節名稱');
      return;
    }

    setIsGenerating(true);
    await generateQuestionsWithAI();
    setIsGenerating(false);
  };

  return (
    <div className="max-w-full mx-auto">
      {/* 新版面配置：左1/3右2/3 */}
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* 左側：教材上傳與參數設定 (1/3) */}
        <div className="w-1/3 space-y-6 overflow-y-auto pr-4">
          {/* PDF 上傳區 */}
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
              />
            </CardContent>
          </Card>

          {/* 參數設定 */}
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
              />
            </CardContent>
          </Card>

          {/* 生成按鈕 */}
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
