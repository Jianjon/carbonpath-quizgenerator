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

  // 模擬進度更新
  const simulateProgress = () => {
    let progress = 0;
    const steps = [
      '分析上傳內容...',
      '理解題目風格...',
      '生成題目結構...',
      '優化選項設計...',
      '完善解析內容...',
      '最終檢查與格式化...'
    ];
    
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 15 + 5; // 每次增加5-20%
        if (progress > 90) progress = 90;
        
        const stepIndex = Math.floor((progress / 90) * steps.length);
        setGenerationProgress(Math.round(progress));
        setGenerationStep(steps[stepIndex] || steps[steps.length - 1]);
      }
    }, 800);
    
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

  // 取得題目風格的完整 prompt 描述 - 優化版本
  const getQuestionStylePrompt = (style: string) => {
    switch (style) {
      case 'intuitive':
        return `【直覺刷題型】- 忠實使用原始教材內容
        - 直接使用教材中的專業用語和表達方式，不隨意改寫
        - 題目簡潔明瞭，聚焦單一概念
        - 答案應該是教材中明確提到的內容`;
        
      case 'application':
        return `【素養應用型】- 結合教材內容的實際應用
        - 基於教材中的案例或概念設計情境題
        - 保持教材的專業術語和核心概念不變
        - 將理論知識轉化為實際問題`;
        
      case 'diagnostic':
        return `【錯誤診斷型】- 嚴格按照教材內容設計
        - 使用教材中的原始概念和用語
        - 常見錯誤選項基於教材中提到的對比概念
        - 不自行創造教材外的錯誤概念`;
        
      case 'strategic':
        return `【策略推演型】- 深度運用教材邏輯
        - 基於教材中的分析框架設計推理題
        - 保持教材的思維邏輯和分析方法
        - 多步驟推理過程符合教材的邏輯脈絡`;
        
      case 'mixed':
        return `【混合應用型】- 綜合運用教材內容
        - 25% 直覺型：忠實呈現教材概念
        - 25% 應用型：教材案例實務化
        - 25% 診斷型：教材對比概念
        - 25% 策略型：教材邏輯推演`;
        
      default:
        return '題目應忠實使用教材內容，保持原有用詞和概念';
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
    
    // 開始進度模擬
    const progressInterval = simulateProgress();
    
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
    
    let advancedSettingsPrompt = '';
    if (hasAdvancedSettings) {
      advancedSettingsPrompt = `

🎯 進階設定配置：
- 關鍵字聚焦：${shouldUseKeywords ? (parameters.keywords || '無') : '已忽略（與範圍不相關）'}
- 樣題參考數量：${parameters.sampleQuestions.length} 個
- 樣題風格學習：${parameters.sampleQuestions.length > 0 ? '啟用' : '未啟用'}`;
    }

    const systemPrompt = `你是專業的教育測驗專家。請根據指定風格生成高品質題目。

📋 出題要求：
${chapterPrompt}${keywordsPrompt}
- 題目數量：${parameters.questionCount}
- 題型：選擇題（四選一，選項標示為 A、B、C、D）

🎨 題目風格：
${stylePrompt}

📊 難度等級：
${difficultyPrompt}

📝 回傳格式必須是純 JSON 陣列：

[
  {
    "id": "1",
    "content": "題目內容",
    "options": {"A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D"},
    "correct_answer": "A",
    "explanation": "詳細解析",
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
${parameters.sampleQuestions.map((q, i) => `
樣題 ${i + 1}：${q.question}
${q.options ? q.options.join('\n') : ''}
正確答案：${q.answer}
`).join('\n')}

⚠️ 重要：學習樣題風格但創造全新內容，嚴格使用指定範圍的教材內容。
` : ''}

只回傳 JSON 陣列，不要有任何其他文字！`;

    try {
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

      setGenerationProgress(95);
      setGenerationStep('解析生成的題目...');

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
