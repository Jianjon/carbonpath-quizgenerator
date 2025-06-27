
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Settings2, Info } from 'lucide-react';
import { SampleQuestions } from './SampleQuestions';
import { Checkbox } from '@/components/ui/checkbox';
import { Parameters } from '@/types/question';

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

  const handleAdvancedSettingsChange = (checked: boolean | "indeterminate") => {
    setAdvancedSettingsEnabled(checked === true);
  };

  const getDifficultyDescription = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '題目較為基礎，適合初學者或快速複習';
      case 'medium':
        return '題目難度適中，適合一般學習和考試準備';
      case 'hard':
        return '題目較有挑戰性，適合深度學習和能力提升';
      case 'mixed':
        return '混合各種難度等級，提供多樣化的學習體驗';
      default:
        return '';
    }
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
          {/* 題目風格 */}
          <div className="w-full">
            <Label htmlFor="questionStyle" className="text-sm font-medium text-gray-700 rounded-none px-[4px] bg-gray-200">
              題目風格分類
            </Label>
            <Select value={parameters.questionStyle} onValueChange={value => updateParameter('questionStyle', value)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="選擇題目風格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intuitive">直覺刷題型</SelectItem>
                <SelectItem value="application">素養應用型</SelectItem>
                <SelectItem value="diagnostic">錯誤診斷型</SelectItem>
                <SelectItem value="strategic">策略推演型</SelectItem>
                <SelectItem value="mixed">混合應用型</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <div><span className="font-medium">直覺刷題型：</span>簡潔明瞭，一眼看懂，快速刷題確認基礎概念</div>
              <div><span className="font-medium">素養應用型：</span>真實情境案例，培養理論轉實務的應用能力</div>
              <div><span className="font-medium">錯誤診斷型：</span>包含常見錯誤迷思，強化概念釐清與辨識</div>
              <div><span className="font-medium">策略推演型：</span>多步驟邏輯推理，訓練批判思維與決策分析</div>
              <div><span className="font-medium">混合應用型：</span>綜合運用前四種風格，創造多元化的學習體驗</div>
            </div>
          </div>

          {/* 難度等級 */}
          <div className="w-full">
            <Label htmlFor="difficultyLevel" className="text-sm font-medium text-gray-700 bg-gray-200">
              難度等級
            </Label>
            <Select value={parameters.difficultyLevel || 'medium'} onValueChange={value => updateParameter('difficultyLevel', value)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="選擇難度等級" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">簡單</SelectItem>
                <SelectItem value="medium">中等</SelectItem>
                <SelectItem value="hard">困難</SelectItem>
                <SelectItem value="mixed">混合難度</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>{getDifficultyDescription(parameters.difficultyLevel || 'medium')}</span>
              </div>
            </div>
          </div>

          {/* 題目數量 - 更新上限為20 */}
          <div className="w-full">
            <Label className="text-sm font-medium text-gray-700 bg-gray-200">
              題目數量：{parameters.questionCount} 題
            </Label>
            <div className="mt-2">
              <Slider 
                value={[parameters.questionCount]} 
                onValueChange={value => updateQuestionCount(value[0])} 
                max={20} 
                min={5} 
                step={1} 
                className="w-full" 
              />
            </div>
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>5-10題：推薦範圍，生成穩定且品質最佳</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span>11-15題：適中範圍，品質良好</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span>16-20題：最大範圍，建議分批生成</span>
              </div>
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

          {/* PDF 處理說明 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 w-full">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full">
                <Info className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900 text-base">PDF 處理方式</h3>
                <p className="text-green-700 text-sm mt-1">系統將自動讀取整份 PDF 文件</p>
                <p className="text-green-600 text-xs mt-1">
                  最多處理 10 頁內容，確保生成題目的完整性和準確性
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
              <Checkbox id="advanced-settings" checked={advancedSettingsEnabled} onCheckedChange={handleAdvancedSettingsChange} />
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
                  <Input id="keywords" placeholder="例如：機器學習, 深度學習, 神經網路" value={parameters.keywords || ''} onChange={e => updateParameter('keywords', e.target.value)} />
                  <p className="text-xs text-gray-500 mt-1">
                    輸入希望題目聚焦的關鍵字，用逗號分隔多個關鍵字。這將幫助 AI 生成更符合特定主題的題目。
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 樣題參考 */}
            <SampleQuestions sampleQuestions={parameters.sampleQuestions} onSampleQuestionsChange={questions => updateParameter('sampleQuestions', questions)} />
          </CardContent>
        )}
      </Card>
    </div>
  );
};
