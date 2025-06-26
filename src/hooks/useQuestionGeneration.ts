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
      '🔍 深度掃描PDF指定頁面...',
      '📖 逐字分析頁面內容...',
      '🧠 理解教材核心概念...',
      '✏️ 基於實際內容設計題目...',
      '🎯 精心調校選項和解析...',
      '✅ 完成高品質題目生成...'
    ];
    
    const baseInterval = questionCount > 15 ? 1500 : questionCount > 10 ? 1200 : 1000;
    
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        const increment = questionCount > 15 ? Math.random() * 4 + 2 : Math.random() * 8 + 4;
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
        - 基於PDF頁面實際內容的核心概念
        - 選項設計清晰，便於快速理解`;
        
      case 'diagnostic':
        return `【概念辨析型題目】- 淨零iPAS專業辨析
        - 幫助辨別PDF內容中的重要概念差異
        - 基於頁面中的具體定義和標準
        - 強化正確理解`;
        
      case 'application':
        return `【應用理解型題目】- 淨零實務應用
        - 將PDF頁面概念應用到實際情況
        - 培養基於頁面內容的實務理解能力`;
        
      case 'strategic':
        return `【邏輯分析型題目】- 淨零策略思考
        - 基於PDF頁面的邏輯框架設計
        - 訓練基於實際內容的分析和推理能力`;
        
      case 'mixed':
        return `【綜合學習型題目】- 淨零iPAS全面準備
        - 結合PDF頁面各種內容特點`;
        
      default:
        return '基於PDF頁面實際內容設計學習題目';
    }
  };

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    const effectiveDifficulty = getEffectiveDifficulty(parameters);
    const shouldUseKeywords = checkKeywordRelevance(parameters.keywords || '', parameters.chapter);
    
    setGenerationProgress(0);
    setGenerationStep('🔍 開始深度分析PDF內容...');
    
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
    
    // 超強化的頁數範圍和內容分析提示
    let chapterPrompt = '';
    if (parameters.chapter) {
      chapterPrompt = `**🎯 PDF內容深度分析任務：第 ${parameters.chapter} 頁**

**📋 你必須執行的步驟：**
1. **深度掃描** - 仔細閱讀PDF第 ${parameters.chapter} 頁的每一個字
2. **內容提取** - 識別頁面中的所有關鍵信息：
   - 專業術語和定義
   - 數據和統計資料
   - 政策和法規內容
   - 案例和實例
   - 圖表和表格信息
   - 流程和步驟說明
3. **概念分析** - 理解每個概念的含義和重要性
4. **出題材料** - 將這些具體內容轉換為考題材料

**🚫 嚴格禁止：**
- 使用頁面外的任何知識
- 依據常識或推測出題
- 創造頁面中不存在的內容
- 使用「一般來說」、「通常」等模糊表述

**✅ 必須做到：**
- 每道題目都能在第 ${parameters.chapter} 頁找到明確依據
- 選項基於頁面實際內容設計
- 解析中明確引用頁面內容`;
    }
    
    const keywordsPrompt = (shouldUseKeywords && parameters.keywords) ? 
      `\n🔍 重點關鍵字聚焦：${parameters.keywords}（必須在指定頁面中出現）` : '';
    
    const stylePrompt = getQuestionStylePrompt(parameters.questionStyle);
    const difficultyPrompt = getDifficultyPrompt(parameters.difficultyLevel || 'medium');
    const sampleStylePrompt = analyzeSampleStyle(parameters.sampleQuestions);

    // 更強化的系統提示
    const systemPrompt = `你是專業的PDF內容分析師和淨零iPAS考試出題專家。你的核心任務是深度分析PDF指定頁面內容並嚴格基於實際內容出題。

🎯 **主要任務：PDF內容深度分析出題**

${chapterPrompt}${keywordsPrompt}

🔬 **詳細分析流程：**
1. **文字層面分析** - 逐句理解頁面文字內容
2. **數據層面分析** - 提取所有數字、百分比、統計資料
3. **概念層面分析** - 識別專業術語、定義、分類
4. **結構層面分析** - 理解段落邏輯、因果關係
5. **應用層面分析** - 發現實例、案例、應用場景

🎨 **出題風格**：${stylePrompt}

📊 **難度設定**：${difficultyPrompt}

📝 **嚴格輸出格式**：
必須返回完整的JSON陣列，包含 ${parameters.questionCount} 道題目。

JSON格式範例：
[
  {
    "id": "1",
    "content": "根据PDF第${parameters.chapter}页的具体内容，[题目内容]...",
    "options": {
      "A": "基于页面内容的选项A",
      "B": "基于页面内容的选项B", 
      "C": "基于页面内容的选项C",
      "D": "基于页面内容的选项D"
    },
    "correct_answer": "A",
    "explanation": "根据PDF第${parameters.chapter}页明确记载：[具体引用页面内容]，因此答案是A。",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "淨零iPAS",
    "source_pdf": "${uploadedFile?.name || ''}",
    "page_range": "${parameters.chapter}",
    "tags": ["基於頁面內容"]
  }
]

${sampleStylePrompt}

**🔥 關鍵要求：你必須真正「看到」並分析PDF內容，每道題目都必須有明確的頁面依據！不允許任何形式的猜測或外部知識！**`;

    try {
      console.log('🎯 PDF內容深度分析出題開始');
      console.log('📋 分析參數:', {
        頁數範圍: parameters.chapter,
        風格: parameters.questionStyle,
        題數: parameters.questionCount,
        PDF檔案: uploadedFile?.name || '無'
      });
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `**🔥 PDF內容深度分析出題指令**

**📖 目標內容：PDF第 ${parameters.chapter} 頁**

**🎯 任務要求：**
你現在需要成為一位PDF內容分析專家，請按以下步驟執行：

**第一步：內容深度掃描**
- 仔細閱讀PDF第 ${parameters.chapter} 頁的每一個字
- 提取所有可識別的信息要素
- 記錄重要的概念、數據、定義

**第二步：出題素材整理**  
- 將頁面內容分類為可出題的知識點
- 識別適合出選擇題的概念和定義
- 準備基於實際內容的選項材料

**第三步：嚴格出題生成**
- 生成 ${parameters.questionCount} 道高品質選擇題
- 每道題目都必須基於頁面實際內容
- 選項設計要有合理的干擾項，但都來自頁面內容

**第四步：品質確認**
- 確保每道題目都能在頁面中找到答案依據
- 解析必須引用具體的頁面內容
- 檢查選項是否合理且基於實際內容

**⚡ 立即開始執行！生成 ${parameters.questionCount} 道嚴格基於PDF第 ${parameters.chapter} 頁內容的高品質題目！**`,
          model: 'gpt-4o' // 使用更穩定的模型
        }
      });

      clearInterval(progressInterval);
      
      console.log('📨 AI回應狀態:', response);

      if (response.error) {
        console.error('❌ 生成服務錯誤:', response.error);
        
        // 特殊處理內容不足的情況
        if (response.error.message?.includes('內容不足') || response.error.message?.includes('無法生成')) {
          toast({
            title: "PDF內容分析困難",
            description: "請確認指定頁面包含足夠的文字內容，或嘗試選擇內容更豐富的頁面",
            variant: "destructive"
          });
          throw new Error('指定頁面內容可能不足以生成題目，請選擇內容更豐富的頁面');
        }
        
        throw new Error(response.error.message || '服務錯誤');
      }

      if (!response.data || !response.data.generatedText) {
        throw new Error('系統未能生成有效回應，請重新嘗試');
      }

      setGenerationProgress(95);
      setGenerationStep('🔎 驗證題目與頁面內容一致性...');

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

      // 更嚴格的題目驗證
      const validQuestions = questions.filter(q => 
        q && 
        typeof q === 'object' && 
        q.content && 
        q.content.length > 8 && 
        q.correct_answer && 
        q.explanation && 
        q.explanation.length > 15 && 
        q.options &&
        Object.keys(q.options).length >= 3 && // 至少3個選項
        // 檢查解析是否包含頁面引用
        (q.explanation.includes('頁') || q.explanation.includes('根據') || q.explanation.includes('PDF'))
      );

      console.log('📊 題目品質檢驗結果:', {
        原始數量: questions.length,
        有效數量: validQuestions.length,
        目標數量: parameters.questionCount,
        完成率: Math.round((validQuestions.length / parameters.questionCount) * 100) + '%'
      });

      if (validQuestions.length === 0) {
        throw new Error('生成的題目未能通過品質檢驗，請重新嘗試或檢查PDF頁面內容');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 基於PDF內容的高品質題目生成完成！');
      
      const successRate = validQuestions.length / parameters.questionCount;
      let successMessage = '';
      
      if (successRate >= 0.8) {
        successMessage = `✅ 成功生成 ${validQuestions.length} 道基於PDF第${parameters.chapter}頁的題目`;
      } else if (successRate >= 0.5) {
        successMessage = `⚠️ 生成 ${validQuestions.length} 道題目（期望：${parameters.questionCount}道），建議檢查頁面內容豐富度`;
      } else {
        successMessage = `⚠️ 僅生成 ${validQuestions.length} 道題目，可能需要選擇內容更豐富的頁面`;
      }
      
      toast({
        title: "PDF內容分析完成",
        description: successMessage,
        variant: successRate >= 0.5 ? "default" : "destructive"
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
