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

  // 改善進度模擬，更平滑的進度更新
  const simulateProgress = () => {
    let progress = 0;
    const steps = [
      '正在分析PDF內容...',
      '提取關鍵段落和概念...',
      '學習出題風格和模式...',
      '構建題目框架...',
      '生成選項和解析...',
      '檢查內容完整性...',
      '最終格式化處理...'
    ];
    
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 10 + 5; // 每次增加5-15%
        if (progress > 90) progress = 90;
        
        const stepIndex = Math.floor((progress / 90) * steps.length);
        setGenerationProgress(Math.round(progress));
        setGenerationStep(steps[stepIndex] || steps[steps.length - 1]);
      }
    }, 800); // 更頻繁的更新
    
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

  // 強化題目風格提示
  const getQuestionStylePrompt = (style: string) => {
    switch (style) {
      case 'intuitive':
        return `【直覺刷題型】- 嚴格使用PDF原文
        - 題目必須直接引用PDF中的完整句子和段落
        - 專業術語、定義完全照搬PDF原文，不得改寫
        - 選項設計基於PDF中的原文對比概念
        - 解析要大量引用PDF原文內容`;
        
      case 'diagnostic':
        return `【錯誤診斷型】- 完全依據PDF原文
        - 錯誤選項來自PDF中提到的對比概念或常見誤解
        - 題目用詞必須與PDF完全一致
        - 不創造PDF未提及的概念或術語
        - 解析詳細引用PDF原文進行辨析`;
        
      case 'application':
        return `【素養應用型】- 基於PDF核心內容
        - 保持PDF核心術語和概念框架
        - 應用情境符合PDF提到的範疇
        - 答案解析回歸PDF理論基礎`;
        
      case 'strategic':
        return `【策略推演型】- 運用PDF邏輯框架
        - 基於PDF分析方法設計推理題
        - 推理過程符合PDF邏輯脈絡
        - 結論與PDF策略建議一致`;
        
      case 'mixed':
        return `【混合應用型】- 全面運用PDF內容
        - 各種題型都要嚴格使用PDF原文
        - 保持專業術語一致性`;
        
      default:
        return '嚴格使用PDF原文內容，保持專業術語和表達方式完全一致';
    }
  };

  const generateQuestionsWithAI = async (parameters: Parameters, uploadedFile: File | null): Promise<QuestionData[]> => {
    const effectiveDifficulty = getEffectiveDifficulty(parameters);
    const shouldUseKeywords = checkKeywordRelevance(parameters.keywords || '', parameters.chapter);
    
    setGenerationProgress(0);
    setGenerationStep('🚀 開始初始化...');
    
    const progressInterval = simulateProgress();
    
    let chapterPrompt = '';
    if (parameters.chapter) {
      chapterPrompt = `請為 PDF 文件的第 ${parameters.chapter} 頁內容製作學習題目`;
    }
    
    const keywordsPrompt = (shouldUseKeywords && parameters.keywords) ? 
      `\n🎯 重點內容：${parameters.keywords}（請基於PDF原文製作相關題目）` : 
      (parameters.keywords ? '\n（關鍵字與指定範圍關聯性較低，已忽略關鍵字限制）' : '');
    
    const stylePrompt = getQuestionStylePrompt(parameters.questionStyle);
    const difficultyPrompt = getDifficultyPrompt(parameters.difficultyLevel || 'medium');
    const sampleStylePrompt = analyzeSampleStyle(parameters.sampleQuestions);

    // 修改系統提示，使其更溫和且教育導向
    const systemPrompt = `你是專業的教育測驗專家，專門為學習者製作高品質的學習評量題目。

🎯 **製作任務**：
${chapterPrompt}${keywordsPrompt}
- 題目數量：製作 ${parameters.questionCount} 道完整的學習評量題目
- 題型：選擇題（四個選項，標示為 A、B、C、D）

📚 **內容製作原則**：
- 題目內容應基於提供的學習材料
- 使用教育性和學術性的語言
- 確保題目有助於學習者理解和記憶重要概念
- 選項設計要有教育意義，幫助學習者辨別相關概念

🎨 學習風格：${stylePrompt}

📊 難度設計：${difficultyPrompt}

⚠️ **製作要求**：
1. 請製作完整的 ${parameters.questionCount} 道學習題目
2. 每題包含：題目描述、四個學習選項、正確答案、學習解析
3. 確保所有題目都有教育價值
4. 使用學術和教育的表達方式

📝 **回傳格式（請只提供JSON陣列）**：
[
  {
    "id": "1",
    "content": "學習題目內容",
    "options": {"A": "學習選項A", "B": "學習選項B", "C": "學習選項C", "D": "學習選項D"},
    "correct_answer": "A",
    "explanation": "學習解析說明",
    "question_type": "choice",
    "difficulty": 0.5,
    "difficulty_label": "中",
    "bloom_level": 2,
    "chapter": "學習章節",
    "source_pdf": "${uploadedFile?.name || ''}",
    "page_range": "${parameters.chapter}",
    "tags": ["學習標籤"]
  }
]

${sampleStylePrompt}

**請確實製作 ${parameters.questionCount} 道完整的學習評量題目，謝謝！**`;

    try {
      console.log('🎯 目標生成:', parameters.questionCount, '道題目');
      console.log('📋 參數設定:', {
        章節: parameters.chapter,
        風格: parameters.questionStyle,
        關鍵字: parameters.keywords,
        樣題數量: parameters.sampleQuestions.length
      });
      
      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt: `請為學習者製作 ${parameters.questionCount} 道有教育價值的學習評量題目。每道題目都要包含完整的題目、選項、答案和解析。請直接提供JSON格式的題目陣列。${parameters.sampleQuestions.length > 0 ? '請參考提供的學習樣題風格。' : ''}`,
          model: 'gpt-4o-mini'
        }
      });

      clearInterval(progressInterval);
      
      console.log('📨 收到回應:', response);

      if (response.error) {
        console.error('❌ Supabase function error:', response.error);
        
        let errorMessage = '生成題目時發生錯誤';
        
        if (response.error.message) {
          if (response.error.message.includes('內容政策') || response.error.message.includes('安全政策')) {
            errorMessage = '內容被AI安全政策限制，請嘗試調整出題參數';
          } else if (response.error.message.includes('配額') || response.error.message.includes('quota')) {
            errorMessage = 'OpenAI API 配額已用完，請檢查您的 OpenAI 帳戶餘額';
          } else if (response.error.message.includes('金鑰') || response.error.message.includes('key')) {
            errorMessage = 'OpenAI API 金鑰無效，請檢查設定';
          } else if (response.error.message.includes('權限') || response.error.message.includes('permission')) {
            errorMessage = 'OpenAI API 權限不足，請檢查帳戶狀態';
          } else {
            errorMessage = response.error.message;
          }
        }
        
        throw new Error(errorMessage);
      }

      if (!response.data?.generatedText) {
        throw new Error('AI 回應格式錯誤：缺少生成內容');
      }

      setGenerationProgress(95);
      setGenerationStep('✅ 驗證題目品質...');

      let questions;
      try {
        questions = JSON.parse(response.data.generatedText);
        console.log('✅ 成功解析題目:', questions.length, '道');
      } catch (parseError) {
        console.error('❌ 前端解析錯誤:', parseError);
        throw new Error(`題目格式解析失敗：${parseError.message}`);
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

      console.log('📊 品質檢查結果:', {
        生成數量: questions.length,
        有效數量: validQuestions.length,
        目標數量: parameters.questionCount
      });

      if (validQuestions.length === 0) {
        throw new Error('生成的題目格式不完整，請重新嘗試');
      }

      setGenerationProgress(100);
      setGenerationStep('🎉 生成完成！');
      
      const successMessage = validQuestions.length >= Math.floor(parameters.questionCount * 0.8) ? 
        `✅ 成功生成 ${validQuestions.length} 道完整題目` :
        `⚠️ 生成 ${validQuestions.length} 道題目（目標：${parameters.questionCount}道）`;
      
      toast({
        title: "生成完成",
        description: successMessage + (parameters.sampleQuestions.length > 0 ? '（已學習樣題風格）' : ''),
        variant: validQuestions.length >= Math.floor(parameters.questionCount * 0.8) ? "default" : "destructive"
      });

      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
      }, 2000);

      return validQuestions;
      
    } catch (error) {
      console.error('❌ 生成失敗:', error);
      clearInterval(progressInterval);
      setGenerationProgress(0);
      setGenerationStep('');
      
      toast({
        title: "生成失敗",
        description: error.message || '請檢查 OpenAI API 設定後重新嘗試',
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
