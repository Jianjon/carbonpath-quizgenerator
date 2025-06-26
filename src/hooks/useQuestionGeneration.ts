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

  // 模擬進度更新 - 改善進度顯示
  const simulateProgress = () => {
    let progress = 0;
    const steps = [
      '分析PDF內容結構...',
      '提取關鍵段落和原文...',
      '學習樣題出題風格...',
      '生成題目框架...',
      '完善選項和解析...',
      '檢查內容一致性...',
      '最終格式化題目...'
    ];
    
    const progressInterval = setInterval(() => {
      if (progress < 85) {
        progress += Math.random() * 12 + 8; // 每次增加8-20%
        if (progress > 85) progress = 85;
        
        const stepIndex = Math.floor((progress / 85) * steps.length);
        setGenerationProgress(Math.round(progress));
        setGenerationStep(steps[stepIndex] || steps[steps.length - 1]);
      }
    }, 1200); // 稍微放慢節奏讓用戶看到進度
    
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

  // 優化題目風格提示，強調使用原文
  const getQuestionStylePrompt = (style: string) => {
    switch (style) {
      case 'intuitive':
        return `【直覺刷題型】- 嚴格使用PDF原文內容
        - 必須直接引用PDF中的專業術語、定義和表達方式
        - 題目描述要使用PDF中的完整句子或段落，不可隨意改寫
        - 選項設計基於PDF中的對比概念和原文描述
        - 解析要引用PDF中的具體內容和說明`;
        
      case 'diagnostic':
        return `【錯誤診斷型】- 完全依據PDF原文設計
        - 使用PDF中提到的常見錯誤或對比概念作為干擾選項
        - 題目表述必須保持PDF原有的專業用語和描述方式
        - 不可創造PDF中未提及的錯誤概念或術語
        - 解析要詳細引用PDF中的正確說明和錯誤辨析`;
        
      case 'application':
        return `【素養應用型】- 基於PDF案例和概念
        - 將PDF中的理論概念轉化為實際應用情境
        - 保持PDF中的核心術語和概念框架不變
        - 案例設計要符合PDF中提到的應用範疇
        - 答案解析要回歸PDF中的理論基礎`;
        
      case 'strategic':
        return `【策略推演型】- 運用PDF邏輯框架
        - 基於PDF中的分析方法和思維邏輯設計推理題
        - 多步驟推理過程要符合PDF的邏輯脈絡
        - 使用PDF中的分析工具和評估標準
        - 結論要與PDF中的策略建議一致`;
        
      case 'mixed':
        return `【混合應用型】- 全面運用PDF內容
        - 25% 直覺型：完整引用PDF概念和定義
        - 25% 診斷型：使用PDF對比和錯誤分析
        - 25% 應用型：轉化PDF理論為實務情境
        - 25% 策略型：運用PDF邏輯進行推演`;
        
      default:
        return '嚴格使用PDF原文內容，保持專業術語和表達方式的一致性';
    }
  };

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    const effectiveDifficulty = getEffectiveDifficulty(parameters);
    const shouldUseKeywords = checkKeywordRelevance(parameters.keywords || '', parameters.chapter);
    
    setGenerationProgress(0);
    setGenerationStep('準備生成參數...');
    
    // 開始改善的進度模擬
    const progressInterval = simulateProgress();
    
    let chapterPrompt = '';
    if (parameters.chapter) {
      chapterPrompt = `請針對 PDF 文件的第 ${parameters.chapter} 頁內容出題`;
    }
    
    const keywordsPrompt = (shouldUseKeywords && parameters.keywords) ? 
      `\n請特別聚焦在以下關鍵字相關的內容：${parameters.keywords}，但必須使用PDF原文的完整描述` : 
      (parameters.keywords ? '\n（注意：提供的關鍵字與指定範圍關聯性較低，已忽略關鍵字限制）' : '');
    
    const stylePrompt = getQuestionStylePrompt(parameters.questionStyle);
    const difficultyPrompt = getDifficultyPrompt(parameters.difficultyLevel || 'medium');
    const sampleStylePrompt = analyzeSampleStyle(parameters.sampleQuestions);

    // 強化系統提示，要求更完整使用PDF內容
    const systemPrompt = `你是專業的教育測驗專家。請根據PDF原文內容生成高品質題目。

📋 出題要求：
${chapterPrompt}${keywordsPrompt}
- 題目數量：必須生成完整的 ${parameters.questionCount} 道題目
- 題型：選擇題（四選一，選項標示為 A、B、C、D）

🎯 **內容完整度要求**：
- 題目描述必須使用PDF中的完整句子或段落，不可只抓關鍵字
- 專業術語要與PDF原文完全一致，不可隨意改寫
- 選項設計要基於PDF中的具體概念和說明
- 解析要詳細引用PDF原文，提供完整的理論依據
- 特別是小範圍出題時，要更深度使用該範圍的所有相關內容

🎨 題目風格：
${stylePrompt}

📊 難度等級：
${difficultyPrompt}

⚠️ **重要生成規則**：
1. 必須生成指定數量的完整題目（${parameters.questionCount} 道）
2. 每題都要有完整的題目、四個選項、正確答案和詳細解析
3. 絕對不可只生成一題就停止
4. 如果內容不足，要從不同角度重新組織PDF內容來達到題目數量

📝 回傳格式必須是純 JSON 陣列：

[
  {
    "id": "1",
    "content": "完整的題目內容（使用PDF原文描述）",
    "options": {"A": "選項A（基於PDF內容）", "B": "選項B", "C": "選項C", "D": "選項D"},
    "correct_answer": "A",
    "explanation": "詳細解析（引用PDF原文說明）",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "章節名稱",
    "source_pdf": "${uploadedFile?.name || ''}",
    "page_range": "${parameters.chapter}",
    "tags": ["關鍵字1", "關鍵字2"]
  }
]

${parameters.sampleQuestions.length > 0 ? `
📚 參考樣題風格學習：
${parameters.sampleQuestions.map((q, i) => `
樣題 ${i + 1}：${q.question}
${q.options ? q.options.join('\n') : ''}
正確答案：${q.answer}
`).join('\n')}

⚠️ 重要：學習樣題的出題方式和風格，但內容必須完全來自指定PDF範圍。
` : ''}

**再次強調：必須生成完整的 ${parameters.questionCount} 道題目，每題都要內容完整，不可只生成一題！**

只回傳 JSON 陣列，不要有任何其他文字！`;

    try {
      console.log('🎯 目標題目數量:', parameters.questionCount);
      console.log('🎯 樣題參考數量:', parameters.sampleQuestions.length);
      console.log('🔑 關鍵字聚焦:', shouldUseKeywords ? parameters.keywords : '已忽略');
      console.log('📝 開始呼叫 AI 生成題目...');
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `請嚴格按照要求生成 ${parameters.questionCount} 道完整的選擇題。每題都要有詳細的題目描述、四個選項、正確答案和完整解析。絕對不可只生成一題！${parameters.sampleQuestions.length > 0 ? '請學習參考樣題的風格但內容必須來自PDF。' : ''}只回傳完整的JSON陣列。`,
          model: 'gpt-4o-mini'
        }
      });

      // 清除進度模擬
      clearInterval(progressInterval);
      
      console.log('AI 回應:', response);

      if (response.error) {
        console.error('Supabase function error:', response.error);
        throw new Error(response.error.message || '呼叫 AI 服務失敗');
      }

      if (!response.data?.generatedText) {
        throw new Error('AI 回應格式錯誤：缺少生成內容');
      }

      setGenerationProgress(90);
      setGenerationStep('驗證題目完整性...');

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('成功解析題目:', questions);
      } catch (parseError) {
        console.error('前端 JSON 解析錯誤:', parseError);
        throw new Error(`無法解析 AI 生成的題目：${parseError.message}`);
      }

      if (!Array.isArray(questions)) {
        questions = [questions];
      }

      // 嚴格驗證題目品質
      const validQuestions = questions.filter(q => 
        q && 
        typeof q === 'object' && 
        q.content && 
        q.content.length > 15 && // 確保題目有足夠長度
        q.correct_answer && 
        q.explanation && 
        q.explanation.length > 30 && // 確保解析有足夠詳細度
        q.question_type &&
        q.options &&
        Object.keys(q.options).length >= 4 // 確保有完整四個選項
      );

      console.log('✅ 有效題目數量:', validQuestions.length);
      console.log('🎯 目標題目數量:', parameters.questionCount);

      if (validQuestions.length === 0) {
        throw new Error('生成的題目格式不完整，請重新嘗試');
      }

      // 如果生成的題目數量明顯不足，給出警告
      if (validQuestions.length < parameters.questionCount * 0.8) {
        console.warn('⚠️ 生成題目數量不足，可能需要調整範圍或重新生成');
      }

      setGenerationProgress(100);
      setGenerationStep('生成完成！');
      
      const successMessage = validQuestions.length >= parameters.questionCount ? 
        `成功生成 ${validQuestions.length} 道完整題目` :
        `生成 ${validQuestions.length} 道題目（目標：${parameters.questionCount}道，建議重新生成以達到目標數量）`;
      
      toast({
        title: "生成完成",
        description: successMessage + (parameters.sampleQuestions.length > 0 ? '（已學習樣題風格）' : ''),
        variant: validQuestions.length >= parameters.questionCount ? "default" : "destructive"
      });

      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);

      return validQuestions;
    } catch (error) {
      console.error('生成題目時發生錯誤:', error);
      clearInterval(progressInterval);
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
