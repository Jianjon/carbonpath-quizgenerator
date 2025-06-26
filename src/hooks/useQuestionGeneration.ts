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
    if (sampleQuestions.length === 0) return '';
    
    const styleAnalysis = {
      questionLength: 0,
      hasScenario: 0,
      hasCalculation: 0,
      hasConcept: 0,
      hasApplication: 0
    };
    
    sampleQuestions.forEach(sample => {
      styleAnalysis.questionLength += sample.question.length;
      
      if (sample.question.includes('情境') || sample.question.includes('案例') || sample.question.includes('假設')) {
        styleAnalysis.hasScenario++;
      }
      
      if (sample.question.includes('計算') || sample.question.includes('數值') || /\d+/.test(sample.question)) {
        styleAnalysis.hasCalculation++;
      }
      
      if (sample.question.includes('概念') || sample.question.includes('定義') || sample.question.includes('原理')) {
        styleAnalysis.hasConcept++;
      }
      
      if (sample.question.includes('應用') || sample.question.includes('實務') || sample.question.includes('如何')) {
        styleAnalysis.hasApplication++;
      }
    });
    
    const avgLength = styleAnalysis.questionLength / sampleQuestions.length;
    const total = sampleQuestions.length;
    
    let stylePrompt = `\n\n根據提供的 ${total} 個樣題，AI 應該學習以下風格特徵：\n`;
    
    if (avgLength > 50) {
      stylePrompt += `- 題目長度偏長（平均 ${Math.round(avgLength)} 字），應採用詳細描述\n`;
    } else {
      stylePrompt += `- 題目長度偏短（平均 ${Math.round(avgLength)} 字），應採用簡潔表達\n`;
    }
    
    if (styleAnalysis.hasScenario / total > 0.3) {
      stylePrompt += `- 經常使用情境案例（${Math.round(styleAnalysis.hasScenario / total * 100)}%），應融入實際場景\n`;
    }
    
    if (styleAnalysis.hasCalculation / total > 0.2) {
      stylePrompt += `- 包含計算或數值（${Math.round(styleAnalysis.hasCalculation / total * 100)}%），應加入量化元素\n`;
    }
    
    if (styleAnalysis.hasConcept / total > 0.4) {
      stylePrompt += `- 聚焦概念理解（${Math.round(styleAnalysis.hasConcept / total * 100)}%），應強調理論基礎\n`;
    }
    
    if (styleAnalysis.hasApplication / total > 0.3) {
      stylePrompt += `- 重視實務應用（${Math.round(styleAnalysis.hasApplication / total * 100)}%），應結合實際運用\n`;
    }
    
    return stylePrompt;
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

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    const effectiveDifficulty = getEffectiveDifficulty(parameters);
    const effectiveCognitive = parameters.weightingConfig.cognitiveDistribution;
    const hasAdvancedSettings = parameters.keywords || parameters.sampleQuestions.length > 0;
    
    // 檢查關鍵字相關性
    const shouldUseKeywords = checkKeywordRelevance(parameters.keywords || '', parameters.chapter);
    
    setGenerationProgress(0);
    setGenerationStep('準備生成參數...');
    
    let chapterPrompt = '';
    if (parameters.chapter) {
      chapterPrompt = `請針對 PDF 文件的第 ${parameters.chapter} 頁內容出題`;
    }
    
    const keywordsPrompt = (shouldUseKeywords && parameters.keywords) ? 
      `\n請特別聚焦在以下關鍵字相關的內容：${parameters.keywords}` : 
      (parameters.keywords ? '\n（注意：提供的關鍵字與指定範圍關聯性較低，將忽略關鍵字限制）' : '');
    
    const stylePrompt = getQuestionStylePrompt(parameters.questionStyle);
    const difficultyPrompt = getDifficultyPrompt(parameters.difficultyLevel || 'medium');
    const sampleStylePrompt = analyzeSampleStyle(parameters.sampleQuestions);
    
    setGenerationProgress(20);
    setGenerationStep('構建提示內容...');
    
    let advancedSettingsPrompt = '';
    if (hasAdvancedSettings) {
      advancedSettingsPrompt = `

🎯 進階設定配置：
- 關鍵字聚焦：${shouldUseKeywords ? (parameters.keywords || '無') : '已忽略（與範圍不相關）'}
- 樣題參考數量：${parameters.sampleQuestions.length} 個
- 樣題風格學習：${parameters.sampleQuestions.length > 0 ? '啟用' : '未啟用'}`;
    }

    const systemPrompt = `你是一位專業的教育測驗專家和學習心理學家。請根據指定的題目風格和難度生成高品質的教育測驗題目。

📋 出題要求：
${chapterPrompt}${keywordsPrompt}
- 題目數量：${parameters.questionCount}
- 題型：選擇題（四選一，選項標示為 A、B、C、D）

🎨 題目風格要求：
${stylePrompt}

📊 難度等級要求：
${difficultyPrompt}

🤖 AI 智慧表達要求：
- 運用教育心理學原理，針對不同學習階段設計適合的認知負荷
- 善用布魯姆分類法，讓題目層次分明
- 融入最新的學習科學研究成果
- 每個選項都要有其設計邏輯和教育目的
- 解析要展現深度思考，不只是標準答案的重述${sampleStylePrompt}

📝 回傳格式必須是純 JSON 陣列，不包含任何其他文字：

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
📚 參考樣題風格學習：
請仔細學習以下樣題的出題風格、語言表達、選項設計邏輯：

${parameters.sampleQuestions.map((q, i) => `
樣題 ${i + 1}：${q.question}
${q.options ? q.options.join('\n') : ''}
正確答案：${q.answer}
`).join('\n')}

⚠️ 重要：請學習樣題的風格和邏輯，但不要直接複製內容。要根據指定的頁數範圍和主題創造全新的題目。
` : ''}

🔥 重要提醒：
1. 每種題目風格都有其獨特的教育目的和設計邏輯
2. 要充分展現 AI 在教育測驗設計上的專業能力
3. 難度等級要與所選擇的難度設定相符
4. 樣題參考是用來學習風格，不是用來複製內容
5. 只回傳 JSON 陣列，不要有任何解釋或其他文字！`;

    try {
      setGenerationProgress(40);
      setGenerationStep('呼叫 AI 生成服務...');
      console.log('🎯 樣題參考數量:', parameters.sampleQuestions.length);
      console.log('🔑 關鍵字聚焦:', shouldUseKeywords ? parameters.keywords : '已忽略');
      console.log('📝 開始呼叫 AI 生成題目...');
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `請嚴格按照上述 JSON 格式生成 ${parameters.questionCount} 道選擇題。${parameters.sampleQuestions.length > 0 ? '請學習參考樣題的風格但創造全新內容。' : ''}只回傳 JSON 陣列，不要有任何其他內容。`,
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
      console.log('✅ 有效題目數量:', validQuestions.length);
      
      toast({
        title: "生成成功",
        description: `成功生成 ${validQuestions.length} 道選擇題${parameters.sampleQuestions.length > 0 ? '（已學習樣題風格）' : ''}`
      });

      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);

      return validQuestions;
    } catch (error) {
      console.error('生成題目時發生錯誤:', error);
      setGenerationProgress(0);
      setGenerationStep('');
      toast({
        title: "生成失敗",
        description: error.message || '請檢查網路連接後重新嘗試',
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
