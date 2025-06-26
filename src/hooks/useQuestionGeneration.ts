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
    
    // 檢查題目數量並給出建議
    if (parameters.questionCount > 20) {
      toast({
        title: "建議調整題目數量",
        description: "超過20題可能會影響生成品質，建議分批生成或減少到15題以下",
        variant: "default"
      });
    }
    
    const progressInterval = simulateProgress(parameters.questionCount);
    
    // 強化頁數範圍的提示
    let chapterPrompt = '';
    if (parameters.chapter) {
      chapterPrompt = `**重要限制：只能從PDF的第 ${parameters.chapter} 頁內容出題**
      - 這裡的頁數是指PDF閱讀器顯示的實際頁碼（如Adobe Reader、瀏覽器PDF顯示的頁數）
      - 絕對不可以從其他頁數的内容出題
      - 如果指定頁數內容不足，請基於現有內容出題，不要擴展到其他頁數`;
    }
    
    const keywordsPrompt = (shouldUseKeywords && parameters.keywords) ? 
      `\n🎯 重點內容：${parameters.keywords}` : '';
    
    const stylePrompt = getQuestionStylePrompt(parameters.questionStyle);
    const difficultyPrompt = getDifficultyPrompt(parameters.difficultyLevel || 'medium');
    const sampleStylePrompt = analyzeSampleStyle(parameters.sampleQuestions);

    // 針對大量題目優化的系統提示
    const systemPrompt = `你是專業的PDF內容分析師和題目設計師，專門基於PDF具體內容製作考試題目。

🚨 **嚴格內容限制 - 這是最重要的規則**：
${chapterPrompt}${keywordsPrompt}
- **絕對禁止**：不得使用PDF指定頁數範圍外的任何內容
- **絕對禁止**：不得編造、推測或使用常識性內容出題
- **絕對禁止**：不得使用其他資料來源或背景知識
- **必須做到**：每道題目都必須直接基於PDF第 ${parameters.chapter} 頁的具體文字內容

📋 **頁數範圍嚴格說明**：
- 頁數是指PDF閱讀器顯示的實際頁碼（如Adobe Reader、瀏覽器PDF顯示的頁數）
- 不是PDF文件內文標註的章節頁數或目錄頁數
- 如果指定頁數內沒有足夠內容出 ${parameters.questionCount} 道題，請明確回覆內容不足
- **嚴格禁止**：擴展到其他頁數或使用外部知識補充

🔍 **出題要求**：
- 仔細閱讀PDF第 ${parameters.chapter} 頁的每一段文字
- 題目必須直接引用或基於該頁面的具體內容
- 題目描述中可以提及「根據本頁內容」來確保範圍限制
- 如果頁面內容主要是圖表，請基於圖表說明文字出題
- 如果頁面內容不足以出題，請回覆「指定頁數內容不足以生成足夠題目」

🎨 **出題風格**：${stylePrompt}

📊 **難度規劃**：${difficultyPrompt}

⚡ **製作要求**：
1. 每道題目包含：基於PDF具體內容的題目描述、四個選項（A/B/C/D）、正確答案、基於該頁內容的解析
2. 題目開頭可以使用「根據本頁內容」、「頁面中提到」等字眼來確保範圍限制
3. 解析必須引用PDF該頁的具體文字或概念
4. 如果該頁內容無法支撐 ${parameters.questionCount} 道題目，請減少題目數量並說明原因
5. **關鍵檢查**：每道題目完成後，請自我檢查是否真的來自指定頁數範圍

📝 **回覆格式**：
如果PDF指定頁數內容充足，返回JSON陣列格式：
[
  {
    "id": "1",
    "content": "根據第X頁內容，關於[具體內容主題]，下列何者正確？",
    "options": {"A": "選項A內容", "B": "選項B內容", "C": "選項C內容", "D": "選項D內容"},
    "correct_answer": "A",
    "explanation": "根據第X頁提到的[具體內容]，正確答案為A...",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "第${parameters.chapter}頁內容",
    "source_pdf": "${uploadedFile?.name || ''}",
    "page_range": "${parameters.chapter}",
    "tags": ["PDF第${parameters.chapter}頁"]
  }
]

如果指定頁數內容不足，請直接回覆：
"指定頁數（第${parameters.chapter}頁）內容不足以生成${parameters.questionCount}道題目。該頁面主要包含：[簡述頁面內容]。建議減少題目數量到X道，或擴大頁數範圍。"

${sampleStylePrompt}

**請嚴格檢查：每道題目是否真的來自PDF第 ${parameters.chapter} 頁的具體內容？如果不是，請不要生成該題目。**`;

    try {
      console.log('🎯 強化頁數限制的題目生成開始');
      console.log('📋 設定參數:', {
        頁數範圍: parameters.chapter,
        風格: parameters.questionStyle,
        題數: parameters.questionCount,
        PDF檔案: uploadedFile?.name || '無'
      });
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `**嚴格基於PDF第 ${parameters.chapter} 頁的具體文字內容**製作 ${parameters.questionCount} 道題目。

**重要檢查清單**：
✅ 是否仔細閱讀了PDF第 ${parameters.chapter} 頁的所有內容？
✅ 每道題目是否直接基於該頁面的具體文字或概念？
✅ 是否避免了使用外部知識或其他頁面的內容？
✅ 如果該頁內容不足，是否誠實回報？

**製作指示**：
- 逐字逐句分析PDF第 ${parameters.chapter} 頁的內容
- 只基於該頁面出現的具體文字、概念、數據、圖表說明出題
- 如果該頁面是目錄、封面、或內容過少，請明確說明無法出題
- 題目可以用「根據本頁內容」開頭來確保範圍限制
- ${parameters.questionCount > 15 ? '由於題目數量較多，請特別確保每題都來自指定頁面。' : ''}

請現在開始分析PDF第 ${parameters.chapter} 頁並出題，或者說明內容不足的原因。`,
          model: 'gpt-4o-mini'
        }
      });

      clearInterval(progressInterval);
      
      console.log('📨 AI回應狀態:', response);

      if (response.error) {
        console.error('❌ 生成服務錯誤:', response.error);
        
        let errorMessage = '題目生成遇到問題';
        
        if (response.error.message) {
          if (response.error.message.includes('內容不足')) {
            errorMessage = `PDF第 ${parameters.chapter} 頁內容不足以生成 ${parameters.questionCount} 道題目。\n建議：\n1. 減少題目數量\n2. 擴大頁數範圍（例如：${parameters.chapter.split('-')[0]}-${parseInt(parameters.chapter.split('-')[1] || parameters.chapter) + 2}）\n3. 檢查頁數範圍是否正確`;
          } else if (response.error.message.includes('題目數量過多') || response.error.message.includes('減少到15題')) {
            errorMessage = `題目數量過多導致生成問題，建議：\n1. 減少題目數量到10-15道\n2. 確認PDF第 ${parameters.chapter} 頁有足夠內容\n3. 分批生成題目`;
          } else {
            errorMessage = response.error.message;
          }
        }
        
        throw new Error(errorMessage);
      }

      if (!response.data?.generatedText) {
        throw new Error('系統回應格式異常，請重新嘗試');
      }

      setGenerationProgress(95);
      setGenerationStep('✅ 驗證題目是否符合頁數範圍...');

      // 檢查是否是內容不足的回覆
      if (response.data.generatedText.includes('內容不足') || response.data.generatedText.includes('不足以生成')) {
        throw new Error(response.data.generatedText);
      }

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('✅ 題目解析成功:', questions.length, '道');
      } catch (parseError) {
        console.error('❌ 格式解析失敗:', parseError);
        throw new Error(`題目格式處理失敗。可能原因：\n1. PDF第 ${parameters.chapter} 頁內容不足\n2. 頁數範圍不正確\n3. 建議減少題目數量到5-10道重試`);
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

      if (validQuestions.length === 0) {
        throw new Error('生成的題目品質不符合要求，請調整設定後重試');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 淨零iPAS題庫生成完成！');
      
      const successRate = validQuestions.length / parameters.questionCount;
      const successMessage = successRate >= 0.8 ? 
        `✅ 成功生成 ${validQuestions.length} 道完整題目` :
        successRate >= 0.6 ?
        `⚠️ 生成 ${validQuestions.length} 道題目（期望：${parameters.questionCount}道），建議減少題目數量以提高成功率` :
        `⚠️ 僅生成 ${validQuestions.length} 道題目（期望：${parameters.questionCount}道），強烈建議減少題目數量到15題以下`;
      
      toast({
        title: "生成完成",
        description: successMessage + '，已保存至題庫',
        variant: successRate >= 0.8 ? "default" : "destructive"
      });

      // 如果成功率低，額外提示
      if (successRate < 0.8 && parameters.questionCount > 15) {
        setTimeout(() => {
          toast({
            title: "生成建議",
            description: "大量題目生成可能不穩定，建議單次生成不超過15題以確保品質",
            variant: "default"
          });
        }, 2000);
      }

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
        description: error.message || '請檢查PDF頁數範圍是否正確',
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
