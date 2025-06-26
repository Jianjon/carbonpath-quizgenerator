import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Settings2, Info } from 'lucide-react';
import { SampleQuestions } from './SampleQuestions';
import { Checkbox } from '@/components/ui/checkbox';
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
  questionStyle: string; // 改為題目風格
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: SampleQuestion[];
  weightingConfig: WeightingConfig;
  keywords?: string;
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
  const [advancedSettingsEnabled, setAdvancedSettingsEnabled] = useState(false);

  const updateParameter = <K extends keyof Parameters,>(key: K, value: Parameters[K]) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };
  const updateQuestionCount = (newCount: number) => {
    onParametersChange({
      ...parameters,
      questionCount: newCount
    });
  };
  const updateWeightingConfig = (config: WeightingConfig) => {
    updateParameter('weightingConfig', config);
  };
  const handleAdvancedSettingsChange = (checked: boolean | "indeterminate") => {
    setAdvancedSettingsEnabled(checked === true);
  };
  const getEffectiveAdvancedConfig = () => {
    if (!advancedSettingsEnabled) {
      return {
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
        },
        keywords: '',
        sampleQuestions: []
      };
    }
    return {
      difficultyDistribution: parameters.weightingConfig.difficultyDistribution,
      cognitiveDistribution: parameters.weightingConfig.cognitiveDistribution,
      questionTypeWeights: parameters.weightingConfig.questionTypeWeights,
      keywords: parameters.keywords || '',
      sampleQuestions: parameters.sampleQuestions
    };
  };
  const getDifficultyTotal = () => {
    const {
      easy,
      medium,
      hard
    } = getEffectiveAdvancedConfig().difficultyDistribution;
    return Math.round(parameters.questionCount * easy / 100) + Math.round(parameters.questionCount * medium / 100) + Math.round(parameters.questionCount * hard / 100);
  };
  const getCognitiveTotal = () => {
    const {
      remember,
      understand,
      apply,
      analyze
    } = getEffectiveAdvancedConfig().cognitiveDistribution;
    return Math.round(parameters.questionCount * remember / 100) + Math.round(parameters.questionCount * understand / 100) + Math.round(parameters.questionCount * apply / 100) + Math.round(parameters.questionCount * analyze / 100);
  };
  return (
    <div className="space-y-6">
      {/* 基本設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Settings2 className="h-5 w-5 text-blue-600" />
            基本設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 出題範圍類型 */}
          <div className="w-full">
            <Label htmlFor="chapterType" className="text-sm font-medium text-gray-700">
              出題範圍類型
            </Label>
            <Select 
              value={parameters.chapterType} 
              onValueChange={(value: ChapterType) => updateParameter('chapterType', value)}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="選擇範圍類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="topic">主題範圍</SelectItem>
                <SelectItem value="pages">PDF 頁數</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 主題或章節名稱 */}
          <div className="w-full">
            <Label htmlFor="chapter" className="text-sm font-medium text-gray-700">
              {parameters.chapterType === 'pages' ? 'PDF 頁數範圍' : '主題或章節名稱'}
            </Label>
            <Textarea
              id="chapter"
              className="mt-1 min-h-[80px] w-full"
              placeholder={parameters.chapterType === 'pages' ? "例如：1-5, 10, 15-20" : "例如：第一章 - 基礎概念"}
              value={parameters.chapter}
              onChange={(e) => updateParameter('chapter', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              {parameters.chapterType === 'pages' 
                ? "指定要出題的 PDF 頁數，可用逗號分隔多個頁數或範圍" 
                : "描述出題的主題範圍，這將作為 AI 生成題目的重要參考"
              }
            </p>
          </div>

          {/* 題目風格 */}
          <div className="w-full">
            <Label htmlFor="questionStyle" className="text-sm font-medium text-gray-700">
              題目風格分類
            </Label>
            <Select 
              value={parameters.questionStyle} 
              onValueChange={(value) => updateParameter('questionStyle', value)}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="選擇題目風格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intuitive">直覺刷題型</SelectItem>
                <SelectItem value="application">素養應用型</SelectItem>
                <SelectItem value="diagnostic">錯誤診斷型</SelectItem>
                <SelectItem value="strategic">策略推演型</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <div><span className="font-medium">直覺刷題型：</span>簡潔明瞭，一眼看懂，快速刷題確認基礎概念</div>
              <div><span className="font-medium">素養應用型：</span>真實情境案例，培養理論轉實務的應用能力</div>
              <div><span className="font-medium">錯誤診斷型：</span>包含常見錯誤迷思，強化概念釐清與辨識</div>
              <div><span className="font-medium">策略推演型：</span>多步驟邏輯推理，訓練批判思維與決策分析</div>
            </div>
          </div>

          {/* 題目數量 */}
          <div className="w-full">
            <Label className="text-sm font-medium text-gray-700">
              題目數量：{parameters.questionCount} 題
            </Label>
            <div className="mt-2">
              <Slider
                value={[parameters.questionCount]}
                onValueChange={(value) => updateQuestionCount(value[0])}
                max={50}
                min={5}
                step={5}
                className="w-full"
              />
            </div>
          </div>

          {/* 題型說明區塊 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 w-full">
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

      {/* 進階設定 - 勾選啟用 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-purple-600" />
              進階設定
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="advanced-settings"
                checked={advancedSettingsEnabled}
                onCheckedChange={handleAdvancedSettingsChange}
              />
              <Label htmlFor="advanced-settings" className="text-sm font-medium">
                啟用進階設定
              </Label>
            </div>
          </CardTitle>
        </CardHeader>
        {advancedSettingsEnabled && (
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">進階功能說明：</p>
                  <p>您可以設定關鍵字聚焦和提供樣題參考，讓 AI 生成更符合您需求的題目。</p>
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
                    onChange={(e) => updateParameter('keywords', e.target.value)}
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
              onSampleQuestionsChange={(questions) => updateParameter('sampleQuestions', questions)}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
};
