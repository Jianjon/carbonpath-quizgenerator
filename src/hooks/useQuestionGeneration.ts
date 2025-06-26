import { useState } from 'react';
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

  // 預設的淨零iPAS樣題
  const defaultSampleQuestions = [
    {
      id: "sample-1",
      question: "「A公司在溫盤報告書提到盤查的範圍包含台灣廠與大陸廠。」請問這段描述內容描述的是界定何種邊界？",
      options: ["(A)營運邊界", "(B)組織邊界", "(C)報告邊界", "(D)以上皆非"],
      answer: "(B)"
    },
    {
      id: "sample-2", 
      question: "碳足跡計算是以生命週期概念計算，下列何者的目的排放量需要包含至總量中？",
      options: ["(A)最終產品處理", "(B)產品配送", "(C)生產製造", "(D)以上皆是"],
      answer: "(D)"
    },
    {
      id: "sample-3",
      question: "關於「再生能源」的定義，下列何者正確？",
      options: ["(A)100%不排放碳的能源", "(B)只使用太陽能和風能的能源", "(C)從持續不斷地補充的自然過程中得到的能量來源", "(D)由動植物質產生的能源"],
      answer: "(C)"
    },
    {
      id: "sample-4",
      question: "下列何者並非我國2050淨零排放路徑之四大轉型？",
      options: ["(A)能源轉型", "(B)產業轉型", "(C)生態轉型", "(D)社會轉型"],
      answer: "(C)"
    },
    {
      id: "sample-5",
      question: "根據 ISO 14064-1 標準，企業在進行碳排放盤查時，應納入哪一範圍的排放？",
      options: ["(A)只包括直接排放", "(B)包括直接和間接排放", "(C)只包括間接排放", "(D)只包括生產過程中的排放"],
      answer: "(B)"
    }
  ];

  // 改善進度模擬，根據題目數量調整時間
  const simulateProgress = (questionCount: number) => {
    let progress = 0;
    const steps = [
      '正在分析教材內容...',
      '學習題目風格和模式...',
      '生成淨零iPAS考試題目...',
      '設計選項和解析...',
      '檢查內容完整性...',
      '最終格式化處理...'
    ];
    
    // 根據題目數量調整進度間隔
    const baseInterval = questionCount > 15 ? 1200 : questionCount > 10 ? 1000 : 800;
    
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        const increment = questionCount > 15 ? Math.random() * 5 + 3 : Math.random() * 10 + 5;
        progress += increment;
        if (progress > 90) progress = 90;
        
        const stepIndex = Math.floor((progress / 90) * steps.length);
        setGenerationProgress(Math.round(progress));
        setGenerationStep(steps[stepIndex] || steps[steps.length - 1]);
      }
    }, baseInterval);
    
    return progressInterval;
  };

  // 取得最終使用的難度設定
  const getEffectiveDifficulty = (parameters: Parameters) => {
    // 如果用戶選擇了特定的難度等級，使用對應的分佈
    if (parameters.difficultyLevel) {
      switch (parameters.difficultyLevel) {
        case 'easy':
          return { easy: 70, medium: 25, hard: 5 };
        case 'medium':
          return { easy: 20, medium: 60, hard: 20 };
        case 'hard':
          return { easy: 5, medium: 25, hard: 70 };
        case 'mixed':
          return { easy: 33, medium: 34, hard: 33 };
        default:
          return { easy: 20, medium: 60, hard: 20 };
      }
    }

    // 如果有進階難度設定，優先使用
    const hasAdvancedDifficulty = parameters.weightingConfig.difficultyDistribution.easy !== 20 || 
                                  parameters.weightingConfig.difficultyDistribution.medium !== 60 || 
                                  parameters.weightingConfig.difficultyDistribution.hard !== 20;
    if (hasAdvancedDifficulty) {
      return parameters.weightingConfig.difficultyDistribution;
    }

    // 根據題目風格設定預設難度分佈
    switch (parameters.questionStyle) {
      case 'intuitive':
        return { easy: 60, medium: 30, hard: 10 };
      case 'application':
        return { easy: 20, medium: 60, hard: 20 };
      case 'diagnostic':
        return { easy: 10, medium: 50, hard: 40 };
      case 'strategic':
        return { easy: 5, medium: 25, hard: 70 };
      case 'mixed':
        return { easy: 25, medium: 50, hard: 25 };
      default:
        return { easy: 20, medium: 60, hard: 20 };
    }
  };

  // 取得難度等級的 prompt 描述
  const getDifficultyPrompt = (difficultyLevel: string) => {
    switch (difficultyLevel) {
      case 'easy':
        return `【簡單難度】
        - 題目聚焦基礎概念和定義
        - 答案較為直接明確，不需要複雜推理
        - 適合初學者和快速複習使用
        - 選項設計簡潔明瞭，干擾項容易排除`;
        
      case 'medium':
        return `【中等難度】
        - 題目涉及概念應用和基本分析
        - 需要一定的理解和判斷能力
        - 適合一般學習和考試準備
        - 選項設計有一定的辨識度要求`;
        
      case 'hard':
        return `【困難難度】
        - 題目需要深度思考和綜合分析
        - 涉及複雜概念整合和批判性思維
        - 適合進階學習和能力提升
        - 選項設計具有挑戰性，需要仔細分析`;
        
      case 'mixed':
        return `【混合難度】
        - 結合不同難度等級的題目
        - 提供循序漸進的學習體驗
        - 從基礎到進階的完整覆蓋
        - 適合全面性的學習和評估`;
        
      default:
        return '';
    }
  };

  // 檢查關鍵字與範圍的相關性
  const checkKeywordRelevance = (keywords: string, chapter: string): boolean => {
    if (!keywords || !chapter) return true;
    
    // 簡單的相關性檢查邏輯
    const keywordList = keywords.toLowerCase().split(/[,，\s]+/).filter(k => k.trim());
    const chapterText = chapter.toLowerCase();
    
    // 如果關鍵字太generic或與範圍完全不相關，則忽略
    const genericKeywords = ['題目', '問題', '考試', '測驗', '學習'];
    const validKeywords = keywordList.filter(k => !genericKeywords.includes(k));
    
    if (validKeywords.length === 0) return false;
    
    // 這裡可以加入更複雜的相關性檢查邏輯
    return true;
  };

  // 分析樣題風格
  const analyzeSampleStyle = (sampleQuestions: SampleQuestion[]): string => {
    // 如果用戶沒有提供樣題，使用預設的淨零iPAS樣題
    const questionsToAnalyze = sampleQuestions.length > 0 ? sampleQuestions : defaultSampleQuestions;
    
    let stylePrompt = `\n\n【重要：題目風格學習】\n請嚴格學習以下 ${questionsToAnalyze.length} 個淨零iPAS考試樣題的風格：\n\n`;
    
    questionsToAnalyze.forEach((sample, index) => {
      stylePrompt += `樣題 ${index + 1}：\n`;
      stylePrompt += `題目：${sample.question}\n`;
      if (sample.options) {
        sample.options.forEach(option => {
          stylePrompt += `${option}\n`;
        });
      }
      stylePrompt += `正確答案：${sample.answer}\n\n`;
    });
    
    stylePrompt += `【風格特徵分析】：\n`;
    stylePrompt += `- 題目表達直接自然，不使用「根據講義」等字眼\n`;
    stylePrompt += `- 專業術語使用準確，符合淨零碳排放專業領域\n`;
    stylePrompt += `- 選項設計清晰，使用 (A)(B)(C)(D) 格式\n`;
    stylePrompt += `- 題目涵蓋碳盤查、碳足跡、再生能源、ISO標準等重點\n`;
    stylePrompt += `- 包含實際案例和計算題型\n`;
    stylePrompt += `- 語言風格專業但易懂，適合iPAS考試\n\n`;
    stylePrompt += `請完全按照以上樣題的風格、用詞習慣、題目結構來生成新題目。\n`;
    
    return stylePrompt;
  };

  // 強化題目風格提示
  const getQuestionStylePrompt = (style: string) => {
    switch (style) {
      case 'intuitive':
        return `【直覺學習型題目】- 淨零iPAS考試風格
        - 題目簡潔直接，重點突出
        - 基於淨零碳排放核心概念
        - 選項設計清晰，便於快速理解
        - 適合iPAS基礎學習和概念確認`;
        
      case 'diagnostic':
        return `【概念辨析型題目】- 淨零iPAS專業辨析
        - 幫助辨別碳排放相關概念差異
        - 基於ISO標準和淨零政策的重要定義
        - 強化正確理解`;
        
      case 'application':
        return `【應用理解型題目】- 淨零實務應用
        - 將淨零概念應用到實際情況
        - 培養碳盤查實務理解能力`;
        
      case 'strategic':
        return `【邏輯分析型題目】- 淨零策略思考
        - 基於淨零轉型邏輯框架設計
        - 訓練分析和推理能力`;
        
      case 'mixed':
        return `【綜合學習型題目】- 淨零iPAS全面準備
        - 結合各種題型特點`;
        
      default:
        return '基於淨零iPAS考試內容設計學習題目';
    }
  };

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    const effectiveDifficulty = getEffectiveDifficulty(parameters);
    const shouldUseKeywords = checkKeywordRelevance(parameters.keywords || '', parameters.chapter);
    
    setGenerationProgress(0);
    setGenerationStep('🚀 開始分析教材內容...');
    
    // 檢查是否有指定頁數範圍
    if (!parameters.chapter || parameters.chapter.trim() === '') {
      toast({
        title: "請指定PDF頁數範圍",
        description: "必須輸入要出題的PDF頁數範圍，例如：1-5, 10, 15-20",
        variant: "destructive"
      });
      throw new Error('請指定PDF頁數範圍才能開始生成題目');
    }
    
    const progressInterval = simulateProgress(parameters.questionCount);
    
    // 更積極的頁數範圍提示
    let chapterPrompt = '';
    if (parameters.chapter) {
      chapterPrompt = `**📚 出題範圍：PDF第 ${parameters.chapter} 頁內容**

**AI任務：積極生成題目**
- 你是專業的淨零iPAS考試出題專家
- 請基於PDF第 ${parameters.chapter} 頁的內容積極生成 ${parameters.questionCount} 道題目
- 即使內容有限，也要發揮專業能力，從現有內容中挖掘出題重點
- 可以結合該頁面的概念、定義、數據、案例等進行出題
- 不要輕易說"內容不足"，要努力從現有內容中找出題點

**出題要求：**
- 每道題目都要有明確的知識點
- 選項設計要有辨識度
- 解析要清楚說明答案依據
- 符合淨零iPAS考試水準`;
    }
    
    const keywordsPrompt = (shouldUseKeywords && parameters.keywords) ? 
      `\n🎯 重點關鍵字：${parameters.keywords}` : '';
    
    const stylePrompt = getQuestionStylePrompt(parameters.questionStyle);
    const difficultyPrompt = getDifficultyPrompt(parameters.difficultyLevel || 'medium');
    const sampleStylePrompt = analyzeSampleStyle(parameters.sampleQuestions);

    // 更積極的系統提示
    const systemPrompt = `你是頂尖的淨零iPAS考試出題專家和PDF內容分析師。你的任務是積極主動地基於PDF內容生成高品質的考試題目。

🎯 **核心使命：絕不輕言放棄，積極生成題目**

${chapterPrompt}${keywordsPrompt}

🔍 **出題策略：**
1. 認真閱讀指定頁面的每一個字、每一個概念
2. 從文字中挖掘出所有可能的出題點
3. 即使內容看似簡單，也要運用專業知識設計有意義的題目
4. 結合淨零iPAS專業領域知識，豐富題目內容
5. 絕不輕易回覆"內容不足"，要積極想辦法出題

🎨 **出題風格**：${stylePrompt}

📊 **難度設定**：${difficultyPrompt}

📝 **輸出格式**：必須返回JSON陣列格式，包含 ${parameters.questionCount} 道題目：
[
  {
    "id": "1",
    "content": "基於PDF內容的具體題目...",
    "options": {"A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D"},
    "correct_answer": "A",
    "explanation": "詳細解析...",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "淨零iPAS",
    "source_pdf": "${uploadedFile?.name || ''}",
    "page_range": "${parameters.chapter}",
    "tags": ["相關標籤"]
  }
]

${sampleStylePrompt}

**🚀 重要提醒：你是專業出題專家，請積極主動地生成題目，不要輕易說內容不足！**`;

    try {
      console.log('🎯 積極主動的題目生成開始');
      console.log('📋 設定參數:', {
        頁數範圍: parameters.chapter,
        風格: parameters.questionStyle,
        題數: parameters.questionCount,
        PDF檔案: uploadedFile?.name || '無'
      });
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `**🎯 積極出題任務：請基於PDF第 ${parameters.chapter} 頁內容生成 ${parameters.questionCount} 道高品質題目**

**執行指令：**
1️⃣ 仔細閱讀PDF第 ${parameters.chapter} 頁的所有內容
2️⃣ 識別出所有可能的出題重點和知識點
3️⃣ 積極主動地設計 ${parameters.questionCount} 道題目
4️⃣ 即使內容有限，也要發揮專業能力創造有意義的題目
5️⃣ 絕不輕易說"內容不足"，要努力從現有內容中挖掘出題點

**出題重點：**
- 每道題目都要有明確的學習目標
- 選項設計要有挑戰性和辨識度
- 解析要清楚說明答案理由
- 符合淨零iPAS專業水準

**現在請開始積極生成 ${parameters.questionCount} 道題目！**`,
          model: 'gpt-4.1-2025-04-14'
        }
      });

      clearInterval(progressInterval);
      
      console.log('📨 AI回應狀態:', response);

      if (response.error) {
        console.error('❌ 生成服務錯誤:', response.error);
        throw new Error(response.error.message || '服務錯誤');
      }

      if (!response.data) {
        throw new Error('系統回應格式異常，請重新嘗試');
      }

      // 移除內容不足的特殊處理，讓AI積極生成題目
      if (!response.data.generatedText) {
        throw new Error('系統回應格式異常，請重新嘗試');
      }

      setGenerationProgress(95);
      setGenerationStep('✅ 驗證生成的題目品質...');

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('✅ 題目解析成功:', questions.length, '道');
      } catch (parseError) {
        console.error('❌ 格式解析失敗:', parseError);
        throw new Error(`題目格式處理失敗，請重新嘗試生成`);
      }

      if (!Array.isArray(questions)) {
        questions = [questions];
      }

      const validQuestions = questions.filter(q => 
        q && 
        typeof q === 'object' && 
        q.content && 
        q.content.length > 5 && 
        q.correct_answer && 
        q.explanation && 
        q.explanation.length > 10 && 
        q.options &&
        Object.keys(q.options).length >= 2
      );

      console.log('📊 題目品質檢驗:', {
        原始數量: questions.length,
        有效數量: validQuestions.length,
        目標數量: parameters.questionCount,
        完成率: Math.round((validQuestions.length / parameters.questionCount) * 100) + '%'
      });

      // 更寬鬆的成功標準
      if (validQuestions.length === 0) {
        throw new Error('生成的題目品質不符合要求，請重新嘗試');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 題目生成完成！');
      
      const successRate = validQuestions.length / parameters.questionCount;
      const successMessage = successRate >= 0.6 ? 
        `✅ 成功生成 ${validQuestions.length} 道題目` :
        `⚠️ 生成 ${validQuestions.length} 道題目（期望：${parameters.questionCount}道）`;
      
      toast({
        title: "生成完成",
        description: successMessage + '，已保存至題庫',
        variant: "default"
      });

      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 3000);

      return validQuestions;
      
    } catch (error) {
      console.error('❌ 生成過程失敗:', error);
      clearInterval(progressInterval);
      setGenerationProgress(0);
      setGenerationStep('');
      
      toast({
        title: "生成失敗",
        description: error.message || '請重新嘗試',
        variant: "destructive"
      });
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
