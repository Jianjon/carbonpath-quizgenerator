import React, { useState, useEffect } from 'react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { QuestionDisplay } from './QuestionDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, FileText, Settings, Zap, Key, Eye, EyeOff } from 'lucide-react';
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
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>('loading');
  const [parameters, setParameters] = useState({
    chapter: '',
    chapterType: 'topic', // 'topic' 或 'pages'
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

  // 載入後台儲存的 API 密鑰
  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      setApiKeyStatus('loading');
      const userId = getOrCreateUserId();
      
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          method: 'GET',
          userId,
          serviceName: 'openai'
        }
      });

      if (error) {
        console.error('載入 API 密鑰時發生錯誤:', error);
        setApiKeyStatus('error');
        return;
      }

      if (data && data.apiKey) {
        setApiKey(data.apiKey);
        setApiKeyStatus('found');
        console.log('成功載入 API 密鑰');
      } else {
        setApiKeyStatus('not_found');
        console.log('未找到 API 密鑰');
      }
    } catch (error) {
      console.error('載入 API 密鑰時發生錯誤:', error);
      setApiKeyStatus('error');
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

  const saveApiKey = async () => {
    if (!tempApiKey.trim()) {
      alert('請輸入 API 密鑰');
      return;
    }

    try {
      const userId = getOrCreateUserId();
      
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: {
          method: 'POST',
          userId,
          serviceName: 'openai',
          apiKey: tempApiKey
        }
      });

      if (error) {
        console.error('儲存 API 密鑰時發生錯誤:', error);
        alert('儲存失敗，請稍後再試');
        return;
      }

      setApiKey(tempApiKey);
      setApiKeyStatus('found');
      setTempApiKey('');
      alert('API 密鑰已成功儲存');
    } catch (error) {
      console.error('儲存 API 密鑰時發生錯誤:', error);
      alert('儲存失敗，請稍後再試');
    }
  };

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
    if (!apiKey) {
      alert('請先設定 OpenAI API 密鑰');
      return;
    }

    const effectiveDifficulty = getEffectiveDifficulty();
    
    // 根據章節類型調整提示詞
    let chapterPrompt = '';
    if (parameters.chapterType === 'pages' && parameters.chapter) {
      chapterPrompt = `請針對 PDF 文件的第 ${parameters.chapter} 頁內容出題`;
    } else if (parameters.chapter) {
      chapterPrompt = `請針對「${parameters.chapter}」這個主題出題`;
    }

    const systemPrompt = `你是一位專業的教育測驗專家，需要根據提供的教材內容生成高品質的題目。

${chapterPrompt}
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
              content: `請生成 ${parameters.questionCount} 道題目，${uploadedFile?.name ? `參考 PDF 內容：${uploadedFile.name}` : chapterPrompt}`
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

  const getApiKeyStatusMessage = () => {
    switch (apiKeyStatus) {
      case 'loading':
        return { text: '正在檢查 API 密鑰...', color: 'text-blue-600' };
      case 'found':
        return { text: '✅ API 密鑰已設定', color: 'text-green-600' };
      case 'not_found':
        return { text: '⚠️ 未設定 API 密鑰，請聯繫管理員', color: 'text-amber-600' };
      case 'error':
        return { text: '❌ API 密鑰載入失敗', color: 'text-red-600' };
      default:
        return { text: '', color: '' };
    }
  };

  return (
    <div className="max-w-full mx-auto">
      {/* 新版面配置：左1/3右2/3 */}
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* 左側：API 設定、教材上傳與參數設定 (1/3) */}
        <div className="w-1/3 space-y-6 overflow-y-auto pr-4">
          {/* API 密鑰設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5 text-blue-600" />
                API 密鑰設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className={`text-sm font-medium ${getApiKeyStatusMessage().color}`}>
                  {getApiKeyStatusMessage().text}
                </div>
                
                {apiKeyStatus !== 'found' && (
                  <div className="space-y-3">
                    <Label htmlFor="apiKey">OpenAI API 密鑰</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="apiKey"
                          type={showApiKey ? "text" : "password"}
                          placeholder="請輸入您的 OpenAI API 密鑰"
                          value={tempApiKey}
                          onChange={(e) => setTempApiKey(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button onClick={saveApiKey} size="sm">
                        儲存
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      密鑰將安全儲存在後台，僅用於生成題目
                    </p>
                  </div>
                )}
                
                {apiKeyStatus === 'found' && (
                  <div className="text-xs text-gray-500">
                    API 密鑰已設定，可以使用 AI 生成功能
                  </div>
                )}
                
                {apiKeyStatus === 'error' && (
                  <button 
                    onClick={loadApiKey}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    重新檢查
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

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
                disabled={(!uploadedFile && !parameters.chapter) || isGenerating || apiKeyStatus !== 'found'}
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Zap className="h-5 w-5 mr-2" />
                {isGenerating ? '生成中...' : '開始生成題庫'}
              </Button>
              {apiKeyStatus !== 'found' && (
                <p className="text-sm text-amber-600 mt-2 text-center">
                  {apiKeyStatus === 'not_found' ? '⚠️ 需要設定 API 密鑰才能使用 AI 生成' : '⚠️ API 密鑰狀態異常'}
                </p>
              )}
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
