
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Target, Brain } from 'lucide-react';

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

interface WeightingSystemProps {
  config: WeightingConfig;
  onConfigChange: (config: WeightingConfig) => void;
  totalQuestions: number;
}

export const WeightingSystem: React.FC<WeightingSystemProps> = ({
  config,
  onConfigChange,
  totalQuestions
}) => {
  const updateChapterWeight = (index: number, weight: number) => {
    const newChapterWeights = [...config.chapterWeights];
    newChapterWeights[index].weight = weight;
    
    // 重新計算題目數量
    const totalWeight = newChapterWeights.reduce((sum, ch) => sum + ch.weight, 0);
    newChapterWeights.forEach(ch => {
      ch.questions = Math.round((ch.weight / totalWeight) * totalQuestions);
    });
    
    onConfigChange({
      ...config,
      chapterWeights: newChapterWeights
    });
  };

  const updateDifficultyDistribution = (type: keyof typeof config.difficultyDistribution, value: number) => {
    onConfigChange({
      ...config,
      difficultyDistribution: {
        ...config.difficultyDistribution,
        [type]: value
      }
    });
  };

  const updateCognitiveDistribution = (type: keyof typeof config.cognitiveDistribution, value: number) => {
    onConfigChange({
      ...config,
      cognitiveDistribution: {
        ...config.cognitiveDistribution,
        [type]: value
      }
    });
  };

  const getDifficultyColor = (type: string) => {
    switch (type) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCognitiveColor = (type: string) => {
    switch (type) {
      case 'remember': return 'bg-blue-100 text-blue-800';
      case 'understand': return 'bg-indigo-100 text-indigo-800';
      case 'apply': return 'bg-purple-100 text-purple-800';
      case 'analyze': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-orange-600" />
          考試範圍權重分配
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chapters" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chapters">章節權重</TabsTrigger>
            <TabsTrigger value="difficulty">難度分佈</TabsTrigger>
            <TabsTrigger value="cognitive">認知層次</TabsTrigger>
          </TabsList>

          <TabsContent value="chapters" className="space-y-4">
            <div className="space-y-4">
              {config.chapterWeights.map((chapter, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>{chapter.name}</Label>
                    <div className="flex gap-2">
                      <Badge variant="outline">{chapter.weight}%</Badge>
                      <Badge variant="secondary">{chapter.questions} 題</Badge>
                    </div>
                  </div>
                  <Slider
                    value={[chapter.weight]}
                    onValueChange={(value) => updateChapterWeight(index, value[0])}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <Target className="h-4 w-4 inline mr-1" />
                總權重：{config.chapterWeights.reduce((sum, ch) => sum + ch.weight, 0)}%
              </p>
            </div>
          </TabsContent>

          <TabsContent value="difficulty" className="space-y-4">
            <div className="grid gap-4">
              {Object.entries(config.difficultyDistribution).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>
                      {key === 'easy' ? '簡單題' : key === 'medium' ? '中等題' : '困難題'}
                    </Label>
                    <Badge className={getDifficultyColor(key)}>
                      {value}% ({Math.round(totalQuestions * value / 100)} 題)
                    </Badge>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(newValue) => updateDifficultyDistribution(key as any, newValue[0])}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                建議比例：簡單 20% | 中等 60% | 困難 20%
              </p>
            </div>
          </TabsContent>

          <TabsContent value="cognitive" className="space-y-4">
            <div className="grid gap-4">
              {Object.entries(config.cognitiveDistribution).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>
                      {key === 'remember' ? '記憶' : 
                       key === 'understand' ? '理解' : 
                       key === 'apply' ? '應用' : '分析'}
                    </Label>
                    <Badge className={getCognitiveColor(key)}>
                      {value}% ({Math.round(totalQuestions * value / 100)} 題)
                    </Badge>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(newValue) => updateCognitiveDistribution(key as any, newValue[0])}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <p className="text-sm text-indigo-700 flex items-center">
                <Brain className="h-4 w-4 mr-1" />
                布魯姆分類法：記憶 → 理解 → 應用 → 分析
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
