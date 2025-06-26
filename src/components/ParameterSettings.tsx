
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';

interface Parameters {
  chapter: string;
  difficulty: string;
  questionCount: number;
  questionTypes: string[];
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

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">基本設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="chapter">章節名稱</Label>
            <Input
              id="chapter"
              placeholder="例如：第一章 - 基礎概念"
              value={parameters.chapter}
              onChange={(e) => updateParameter('chapter', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="difficulty">難度等級</Label>
            <Select value={parameters.difficulty} onValueChange={(value) => updateParameter('difficulty', value)}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">題型選擇</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
};
