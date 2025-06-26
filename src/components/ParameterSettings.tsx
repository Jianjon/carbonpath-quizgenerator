import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Settings2, Info } from 'lucide-react';
import { SampleQuestions } from './SampleQuestions';
import { WeightingSystem } from './WeightingSystem';
import { PDFOutlineSelector } from './PDFOutlineSelector';
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
type ChapterType = 'topic' | 'pages';
interface Parameters {
  chapter: string;
  chapterType: ChapterType;
  difficulty: string;
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: SampleQuestion[];
  weightingConfig: WeightingConfig;
  keywords?: string; // 新增關鍵字欄位
}
interface ParameterSettingsProps {
  parameters: Parameters;
  onParametersChange: (parameters: Parameters) => void;
  uploadedFile?: File | null;
}
export const ParameterSettings: React.FC<ParameterSettingsProps> = ({
  parameters,
  onParametersChange,
  uploadedFile
}) => {
  const updateParameter = <K extends keyof Parameters,>(key: K, value: Parameters[K]) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };
  const updateQuestionCount = (newCount: number) => {
    // 更新題目數量時，同時更新權重配置中的相關數量
    const updatedConfig = {
      ...parameters.weightingConfig,
      chapterWeights: parameters.weightingConfig.chapterWeights.map(chapter => ({
        ...chapter,
        questions: Math.round(chapter.weight / 100 * newCount)
      }))
    };
    onParametersChange({
      ...parameters,
      questionCount: newCount,
      weightingConfig: updatedConfig
    });
  };
  const updateWeightingConfig = (config: WeightingConfig) => {
    updateParameter('weightingConfig', config);
  };

  // 處理 PDF 主題選擇
  const handleTopicsChange = (selectedTopics: string[]) => {
    // 將選中的主題轉換為章節字符串
    const topicsString = selectedTopics.join(', ');
    updateParameter('chapter', topicsString);
  };

  // 檢查是否啟用進階難度設定
  const isAdvancedDifficultyEnabled = () => {
    const {
      easy,
      medium,
      hard
    } = parameters.weightingConfig.difficultyDistribution;
    return !(easy === 20 && medium === 60 && hard === 20);
  };

  // 計算難度分佈的總題數
  const getDifficultyTotal = () => {
    const {
      easy,
      medium,
      hard
    } = parameters.weightingConfig.difficultyDistribution;
    return Math.round(parameters.questionCount * easy / 100) + Math.round(parameters.questionCount * medium / 100) + Math.round(parameters.questionCount * hard / 100);
  };

  // 計算認知層次的總題數
  const getCognitiveTotal = () => {
    const {
      remember,
      understand,
      apply,
      analyze
    } = parameters.weightingConfig.cognitiveDistribution;
    return Math.round(parameters.questionCount * remember / 100) + Math.round(parameters.questionCount * understand / 100) + Math.round(parameters.questionCount * apply / 100) + Math.round(parameters.questionCount * analyze / 100);
  };

  // 初始化章節權重（如果章節名稱改變）
  React.useEffect(() => {
    if (parameters.chapter && !parameters.weightingConfig.chapterWeights.find(ch => ch.name === parameters.chapter)) {
      const newConfig = {
        ...parameters.weightingConfig,
        chapterWeights: [{
          name: parameters.chapter,
          weight: 100,
          questions: parameters.questionCount
        }]
      };
      updateParameter('weightingConfig', newConfig);
    }
  }, [parameters.chapter]);
  return <div className="space-y-6">
      {/* 基本設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600" />
            基本設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 第一行：出題範圍設定 */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chapterType" className="text-sm font-medium text-gray-700">
                出題範圍類型
              </Label>
              <Select value={parameters.chapterType} onValueChange={(value: ChapterType) => updateParameter('chapterType', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="選擇範圍類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="topic">主題範圍</SelectItem>
                  <SelectItem value="pages">PDF 頁數</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="chapter" className="text-sm font-medium text-gray-700">
                {parameters.chapterType === 'pages' ? 'PDF 頁數範圍' : '主題或章節名稱'}
              </Label>
              <Input 
                id="chapter" 
                className="mt-1"
                placeholder={parameters.chapterType === 'pages' ? "例如：1-5, 10, 15-20" : "例如：第一章 - 基礎概念"} 
                value={parameters.chapter} 
                onChange={e => updateParameter('chapter', e.target.value)} 
              />
              <p className="text-xs text-gray-500 mt-1">
                {parameters.chapterType === 'pages' 
                  ? "指定要出題的 PDF 頁數，可用逗號分隔多個頁數或範圍" 
                  : "描述出題的主題範圍，這將作為 AI 生成題目的重要參考"
                }
              </p>
            </div>
          </div>

          {/* 第二行：難度與題目數設定 */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="difficulty" className="text-sm font-medium text-gray-700">
                基本難度等級
                {isAdvancedDifficultyEnabled() && (
                  <span className="text-xs text-amber-600 ml-2 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    (進階設定已啟用)
                  </span>
                )}
              </Label>
              <Select 
                value={parameters.difficulty} 
                onValueChange={value => updateParameter('difficulty', value)} 
                disabled={isAdvancedDifficultyEnabled()}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="選擇難度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">簡單</SelectItem>
                  <SelectItem value="medium">中等</SelectItem>
                  <SelectItem value="hard">困難</SelectItem>
                  <SelectItem value="expert">專家</SelectItem>
                </SelectContent>
              </Select>
              {isAdvancedDifficultyEnabled() && (
                <p className="text-xs text-amber-600 mt-1">
                  進階設定中的難度分佈將覆蓋此基本設定
                </p>
              )}
              {!isAdvancedDifficultyEnabled() && (
                <p className="text-xs text-gray-500 mt-1">
                  若未使用進階設定，將套用此基本難度等級
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                題目數量：{parameters.questionCount} 題
              </Label>
              <div className="mt-2">
                <Slider 
                  value={[parameters.questionCount]} 
                  onValueChange={value => updateQuestionCount(value[0])} 
                  max={50} 
                  min={5} 
                  step={5} 
                  className="w-full" 
                />
              </div>
              <div className="text-xs text-gray-500 mt-2 space-y-1">
                <div>難度分佈總計：{getDifficultyTotal()} 題</div>
                <div>認知層次總計：{getCognitiveTotal()} 題</div>
                {(getDifficultyTotal() !== parameters.questionCount || getCognitiveTotal() !== parameters.questionCount) && (
                  <div className="text-amber-600 font-medium">
                    ⚠️ 總題數不一致，請調整進階設定中的百分比
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 題型說明區塊 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <Settings2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 text-base">題型設定</h3>
                <p className="text-blue-700 text-sm mt-1">系統專門生成選擇題</p>
                <p className="text-blue-600 text-xs mt-1">
                  所有題目將採用 A、B、C、D 四個選項的標準選擇題格式
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF 大綱選擇 */}
      {uploadedFile && (
        <PDFOutlineSelector 
          pdfFile={uploadedFile} 
          selectedTopics={parameters.chapter ? parameters.chapter.split(', ') : []} 
          onTopicsChange={handleTopicsChange} 
          chapterType={parameters.chapterType} 
          chapterInput={parameters.chapter} 
        />
      )}

      {/* 進階設定 - 可摺疊 */}
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>進階設定</span>
                <ChevronDown className="h-5 w-5" />
              </CardTitle>
            </CardHeader>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">數量對應說明：</p>
                <p>基本設定的題目數量應等於難度分佈和認知層次各自的總題數。調整百分比時請確保總和為 100%，系統會自動計算對應題數。</p>
              </div>
            </div>
          </div>

          {/* 關鍵字設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-purple-600" />
                關鍵字聚焦
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="keywords">出題關鍵字</Label>
                <Input 
                  id="keywords" 
                  placeholder="例如：機器學習, 深度學習, 神經網路" 
                  value={parameters.keywords || ''} 
                  onChange={e => updateParameter('keywords', e.target.value)} 
                />
                <p className="text-xs text-gray-500 mt-1">
                  輸入希望題目聚焦的關鍵字，用逗號分隔多個關鍵字。這將幫助 AI 生成更符合特定主題的題目。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 樣題參考 */}
          <SampleQuestions 
            sampleQuestions={parameters.sampleQuestions} 
            onSampleQuestionsChange={questions => updateParameter('sampleQuestions', questions)} 
          />

          {/* 權重分配 */}
          <WeightingSystem 
            config={parameters.weightingConfig} 
            onConfigChange={updateWeightingConfig} 
            totalQuestions={parameters.questionCount} 
          />
        </CollapsibleContent>
      </Collapsible>
    </div>;
};
