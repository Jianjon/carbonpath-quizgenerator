import React, { useState, useEffect } from 'react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { QuestionDisplay } from './QuestionDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Brain, FileText, Settings, Zap, Loader2, AlertCircle, Menu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarInset,
  SidebarTrigger
} from '@/components/ui/sidebar';

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
type ChapterType = 'pages';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 檢測是否為手機版
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 初始化使用者會話
  useEffect(() => {
    initializeUserSession();
  }, []);

  const initializeUserSession = async () => {
    try {
      const userIP = await getUserIP();
      const userAgent = navigator.userAgent;
      
      // 創建或更新使用者會話
      const { data: existingSession, error: fetchError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_ip', userIP)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingSession) {
        // 更新最後活動時間
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', existingSession.id);
      } else {
        // 創建新會話
        const { data: newSession, error: createError } = await supabase
          .from('user_sessions')
          .insert({
            user_ip: userIP,
            user_agent: userAgent
          })
          .select()
          .single();

        if (createError) throw createError;
      }
    } catch (error) {
      console.error('初始化使用者會話失敗:', error);
    }
  };

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
      case 'mixed':
        return {
          easy: 25,
          medium: 50,
          hard: 25
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
        
      case 'mixed':
        return `【混合應用型】
        - 智慧性地融合四種題型風格，創造豐富多元的學習體驗
        - 約25%直覺刷題型：快速確認基礎概念，語言簡潔直白
        - 約25%素養應用型：真實情境案例，培養實務應用能力
        - 約25%錯誤診斷型：識別常見迷思，強化概念釐清
        - 約25%策略推演型：多步驟邏輯推理，訓練批判思維
        - 運用教育心理學原理，針對不同認知層次設計題目
        - 體現AI在教育測驗上的專業智慧，讓每道題都有其獨特價值
        - 確保題目間的風格轉換自然流暢，維持整體一致性`;
        
      default:
        return '題目應簡單清楚，聚焦單一知識點，讓學生用直覺作答，不須綜合思考';
    }
  };

  // 處理上傳完成事件
  const handleUploadComplete = () => {
    if (!parameters.chapter) {
      toast({
        title: "請設定出題範圍",
        description: "請在基本設定中輸入出題的PDF頁數範圍"
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
    if (parameters.chapter) {
      chapterPrompt = `請針對 PDF 文件的第 ${parameters.chapter} 頁內容出題`;
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
    "page_range": "${parameters.chapter}",
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
        description: "請上傳 PDF 檔案或輸入頁數範圍",
        variant: "destructive"
      });
      return;
    }
    setIsGenerating(true);
    await generateQuestionsWithAI();
    setIsGenerating(false);
  };

  // 修改自動保存功能
  const saveQuestionsAutomatically = async () => {
    try {
      const userIP = await getUserIP();
      const userAgent = navigator.userAgent;
      
      // 創建生成會話
      const { data: session, error: sessionError } = await supabase
        .from('generation_sessions')
        .insert({
          session_name: `自動保存_${new Date().toISOString().split('T')[0]}_${userIP}`,
          parameters: parameters || {},
          question_count: questions.length,
          user_ip: userIP,
          user_agent: userAgent,
          auto_saved: true
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      setSessionId(session.id);

      // 保存題目
      const questionsToSave = questions.map(q => ({
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type,
        difficulty: q.difficulty,
        difficulty_label: q.difficulty_label,
        bloom_level: q.bloom_level,
        chapter: q.chapter,
        source_pdf: q.source_pdf,
        page_range: q.page_range,
        tags: q.tags,
        session_id: session.id,
        auto_generated: true,
        user_ip: userIP
      }));

      const { error: questionsError } = await supabase
        .from('question_bank')
        .insert(questionsToSave);

      if (questionsError) throw questionsError;

      // 更新使用者會話的題目總數
      await supabase
        .from('user_sessions')
        .update({ 
          total_questions: questions.length,
          last_activity: new Date().toISOString()
        })
        .eq('user_ip', userIP);

      console.log(`自動保存成功: ${questions.length} 道題目已保存`);
    } catch (error) {
      console.error('自動保存失敗:', error);
    }
  };

  // 處理題目更新（也要自動保存）
  const handleQuestionsChange = (updatedQuestions: QuestionData[]) => {
    setGeneratedQuestions(updatedQuestions);
    
    // 當題目被修改時，也要自動更新到資料庫
    if (sessionId && updatedQuestions.length > 0) {
      updateQuestionsInDatabase(updatedQuestions);
    }
  };

  const updateQuestionsInDatabase = async (updatedQuestions: QuestionData[]) => {
    try {
      const userIP = await getUserIP();
      
      // 刪除舊的題目
      await supabase
        .from('question_bank')
        .delete()
        .eq('session_id', sessionId);

      // 插入更新後的題目
      const questionsToSave = updatedQuestions.map(q => ({
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type,
        difficulty: q.difficulty,
        difficulty_label: q.difficulty_label,
        bloom_level: q.bloom_level,
        chapter: q.chapter,
        source_pdf: q.source_pdf,
        page_range: q.page_range,
        tags: q.tags,
        session_id: sessionId,
        auto_generated: true,
        user_ip: userIP
      }));

      await supabase
        .from('question_bank')
        .insert(questionsToSave);

      console.log('題目更新已自動保存到資料庫');
    } catch (error) {
      console.error('更新題目到資料庫失敗:', error);
    }
  };

  // 取得用戶IP位址
  const getUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get IP:', error);
      return 'unknown';
    }
  };

  const SidebarContent = () => (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4 text-blue-600" />
            教材上傳
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PDFUploader 
            uploadedFile={uploadedFile} 
            onFileUpload={setUploadedFile} 
            onUploadComplete={handleUploadComplete}
            pageRange={parameters.chapter}
            generatedQuestionsCount={generatedQuestions.length}
          />
        </CardContent>
      </Card>

      <ParameterSettings 
        parameters={parameters} 
        onParametersChange={setParameters} 
        uploadedFile={uploadedFile} 
      />

      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* 生成時間說明 */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">生成時間說明</p>
                <p className="text-xs">題目生成時間依據題數而定：</p>
                <ul className="mt-1 text-xs space-y-0.5">
                  <li>• 5-10題：約 30-60 秒</li>
                  <li>• 11-20題：約 1-2 分鐘</li>
                  <li>• 21-30題：約 2-3 分鐘</li>
                  <li>• 31題以上：約 3-5 分鐘</li>
                </ul>
              </div>
            </div>
          </div>

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
            <Zap className="h-4 w-4 mr-2" />
            {isGenerating ? '生成中...' : '開始生成題庫'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (isMobile) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <Sidebar className="border-r">
            <SidebarHeader className="border-b p-4">
              <h2 className="font-semibold text-lg">題庫生成設定</h2>
            </SidebarHeader>
            <SidebarContent>
              <SidebarContent />
            </SidebarContent>
          </Sidebar>
          
          <SidebarInset className="flex-1">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <h1 className="text-lg font-semibold">生成結果與預覽</h1>
            </header>
            
            <div className="flex-1 p-4">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-4 w-4 text-purple-600" />
                    題庫預覽
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full overflow-auto">
                  <QuestionDisplay 
                    questions={generatedQuestions} 
                    parameters={parameters}
                    onQuestionsChange={handleQuestionsChange}
                  />
                </CardContent>
              </Card>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  // 桌面版保持原有布局
  return (
    <div className="max-w-full mx-auto p-4">
      <div className="flex gap-6">
        {/* 左側：教材上傳與參數設定 (1/3) */}
        <div className="w-1/3 space-y-6 overflow-y-auto">
          <SidebarContent />
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
            <CardContent>
              <QuestionDisplay 
                questions={generatedQuestions} 
                parameters={parameters}
                onQuestionsChange={handleQuestionsChange}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
