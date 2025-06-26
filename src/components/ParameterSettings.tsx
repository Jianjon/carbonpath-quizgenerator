import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Settings2, Info } from 'lucide-react';
import { SampleQuestions } from './SampleQuestions';
import { WeightingSystem } from './WeightingSystem';

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
  chapterType: string;
  difficulty: string;
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: SampleQuestion[];
  weightingConfig: WeightingConfig;
}

interface ParameterSettingsProps {
  parameters: Parameters;
  onParametersChange: (parameters: Parameters) => void;
}

export const ParameterSettings: React.FC<ParameterSettingsProps> = ({
  parameters,
  onParametersChange
}) => {
  const updateParameter = (key: keyof Parameters, value: any) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };

  const toggleQuestionType = (type: string, checked: boolean) => {
    const newTypes = checked
      ? [...parameters.questionTypes, type]
      : parameters.questionTypes.filter(t => t !== type);
    updateParameter('questionTypes', newTypes);
  };

  const updateWeightingConfig = (config: WeightingConfig) => {
    updateParameter('weightingConfig', config);
  };

  // 檢查是否啟用進階難度設定
  const isAdvancedDifficultyEnabled = () => {
    const { easy, medium, hard } = parameters.weightingConfig.difficultyDistribution;
    return !(easy === 20 && medium === 60 && hard === 20);
  };

  // 初始化章節權重（如果章節名稱改變）
  React.useEffect(() => {
    if (parameters.chapter && !parameters.weightingConfig.chapterWeights.find(ch => ch.name === parameters.chapter)) {
      const newConfig = {
        ...parameters.weightingConfig,
        chapterWeights: [
          { name: parameters.chapter, weight: 100, questions: parameters.questionCount }
        ]
      };
      updateParameter('weightingConfig', newConfig);
    }
  }, [parameters.chapter]);

  return (
    <div className="space-y-6">
      {/* 基本設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600" />
            基本設定
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="chapterType">出題範圍類型</Label>
              <Select 
                value={parameters.chapterType} 
                onValueChange={(value) => updateParameter('chapterType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇範圍類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="topic">主題範圍</SelectItem>
                  <SelectItem value="pages">PDF 頁數</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="chapter">
                {parameters.chapterType === 'pages' ? 'PDF 頁數範圍' : '主題或章節名稱'}
              </Label>
              <Input
                id="chapter"
                placeholder={
                  parameters.chapterType === 'pages' 
                    ? "例如：1-5, 10, 15-20" 
                    : "例如：第一章 - 基礎概念"
                }
                value={parameters.chapter}
                onChange={(e) => updateParameter('chapter', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                {parameters.chapterType === 'pages' 
                  ? "指定要出題的 PDF 頁數，可用逗號分隔多個頁數或範圍"
                  : "描述出題的主題範圍，這將作為 AI 生成題目的重要參考"}
              </p>
            </div>
            
            <div>
              <Label htmlFor="difficulty">
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
                onValueChange={(value) => updateParameter('difficulty', value)}
                disabled={isAdvancedDifficultyEnabled()}
              >
                <SelectTrigger>
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
              <Label>題目數量：{parameters.questionCount} 題</Label>
              <div className="mt-2">
                <Slider
                  value={[parameters.questionCount]}
                  onValueChange={(value) => updateParameter('questionCount', value[0])}
                  max={50}
                  min={5}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label>題型選擇</Label>
            {[
              { id: 'multiple-choice', label: '選擇題', description: '單選題型，提供 4 個選項' },
              { id: 'true-false', label: '是非題', description: '判斷題型，對錯選擇' },
              { id: 'short-answer', label: '簡答題', description: '需要簡短文字回答' },
              { id: 'essay', label: '問答題', description: '需要詳細解答說明' }
            ].map((type) => (
              <div key={type.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                <Checkbox
                  id={type.id}
                  checked={parameters.questionTypes.includes(type.id)}
                  onCheckedChange={(checked) => toggleQuestionType(type.id, checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor={type.id} className="font-medium">
                    {type.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {type.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                <p className="font-medium mb-1">優先級說明：</p>
                <p>若進階設定中的難度分佈有自訂值，將優先使用進階設定；否則使用基本設定的難度等級。</p>
              </div>
            </div>
          </div>

          {/* 樣題參考 */}
          <SampleQuestions
            sampleQuestions={parameters.sampleQuestions}
            onSampleQuestionsChange={(questions) => updateParameter('sampleQuestions', questions)}
          />

          {/* 權重分配 */}
          <WeightingSystem
            config={parameters.weightingConfig}
            onConfigChange={updateWeightingConfig}
            totalQuestions={parameters.questionCount}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
