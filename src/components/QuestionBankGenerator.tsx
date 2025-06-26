import React, { useState, useEffect } from 'react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { QuestionDisplay } from './QuestionDisplay';
import { APIKeySettings } from './APIKeySettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, FileText, Settings, Zap, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

export const QuestionBankGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [parameters, setParameters] = useState({
    chapter: '',
    difficulty: 'medium',
    questionCount: 10,
    questionTypes: ['multiple-choice'],
    sampleQuestions: [] as SampleQuestion[],
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
    } as WeightingConfig
  });
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // 載入儲存的 API 密鑰
  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      // 使用簡單的 user_id（可以是瀏覽器 session ID 或其他識別符）
      const userId = getOrCreateUserId();
      
      const { data, error } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('service_name', 'openai')
        .single();

      if (data && !error) {
        setApiKey(data.api_key);
      }
    } catch (error) {
      console.log('載入 API 密鑰時發生錯誤:', error);
    }
  };

  const saveApiKey = async (key: string) => {
    try {
      const userId = getOrCreateUserId();
      
      // 先檢查是否已存在
      const { data: existing } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('service_name', 'openai')
        .single();

      if (existing) {
        // 更新現有記錄
        await supabase
          .from('api_keys')
          .update({ 
            api_key: key, 
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .eq('service_name', 'openai');
      } else {
        // 建立新記錄
        await supabase
          .from('api_keys')
          .insert({
            user_id: userId,
            service_name: 'openai',
            api_key: key
          });
      }

      setApiKey(key);
    } catch (error) {
      console.error('儲存 API 密鑰時發生錯誤:', error);
      throw error;
    }
  };

  const getOrCreateUserId = () => {
    let userId = localStorage.getItem('quiz_creator_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('quiz_creator_user_id', userId);
    }
    return userId;
  };

  const generateQuestionsWithAI = async () => {
    if (!apiKey) {
      alert('請先設定 OpenAI API 密鑰');
      return;
    }

    const systemPrompt = `你是一位專業的教育測驗專家，需要根據提供的教材內容生成高品質的題目。

請根據以下參數生成題目：
- 章節：${parameters.chapter}
- 難度：${parameters.difficulty}
- 題目數量：${parameters.questionCount}
- 題型：${parameters.questionTypes.join(', ')}

難度分佈：
- 簡單題：${parameters.weightingConfig.difficultyDistribution.easy}%
- 中等題：${parameters.weightingConfig.difficultyDistribution.medium}%
- 困難題：${parameters.weightingConfig.difficultyDistribution.hard}%

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
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `請為「${parameters.chapter}」章節生成 ${parameters.questionCount} 道題目，PDF內容：${uploadedFile?.name || '未提供具體內容，請基於章節名稱生成相關題目'}`
            }
          ],
          temperature: 0.7,
          max_tokens: 3000
        })
      });

      if (!response.ok) {
        throw new Error(`API 請求失敗：${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
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
    
    if (apiKey) {
      await generateQuestionsWithAI();
    } else {
      // 模擬生成（開發測試用）
      setTimeout(() => {
        const mockQuestions: QuestionData[] = Array.from({ length: parameters.questionCount }, (_, index) => ({
          id: `q${index + 1}`,
          type: 'multiple-choice',
          question: `關於 ${parameters.chapter} 的第 ${index + 1} 題，以下何者正確？`,
          options: [
            '選項 A：這是第一個選項',
            '選項 B：這是第二個選項',
            '選項 C：這是第三個選項',
            '選項 D：這是第四個選項'
          ],
          answer: 'B',
          explanation: `根據教材內容，正確答案是 B。這是因為在 ${parameters.chapter} 中明確提到了相關概念...`,
          difficulty: parameters.difficulty,
          chapter: parameters.chapter,
          cognitiveLevel: 'understand'
        }));
        
        setGeneratedQuestions(mockQuestions);
      }, 3000);
    }
    
    setIsGenerating(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* 工作台主體 */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* 左側：檔案上傳與 API 設定 */}
        <div className="lg:col-span-1 space-y-6">
          {/* API 密鑰設定 */}
          <APIKeySettings 
            apiKey={apiKey}
            onApiKeyChange={saveApiKey}
          />

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
              {!apiKey && (
                <p className="text-sm text-amber-600 mt-2 text-center">
                  ⚠️ 未設定 API 密鑰，將使用模擬資料生成
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 中間：參數設定 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-600" />
                參數設定
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[80vh] overflow-y-auto">
              <ParameterSettings 
                parameters={parameters}
                onParametersChange={setParameters}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右側：生成結果 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                生成結果
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[80vh] overflow-y-auto">
              <QuestionDisplay questions={generatedQuestions} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
