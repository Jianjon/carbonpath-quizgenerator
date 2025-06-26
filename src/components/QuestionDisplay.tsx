
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, Save } from 'lucide-react';

interface QuestionData {
  id: string;
  type: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
  chapter: string;
}

interface QuestionDisplayProps {
  questions: QuestionData[];
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ questions }) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      case 'expert': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '簡單';
      case 'medium': return '中等';
      case 'hard': return '困難';
      case 'expert': return '專家';
      default: return difficulty;
    }
  };

  const handleSave = () => {
    // 這裡將整合 Supabase 儲存功能
    console.log('儲存題庫到 Supabase:', questions);
    alert('題庫已儲存到雲端！');
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(questions, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `題庫_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500 text-lg">尚未生成題目</p>
          <p className="text-gray-400 text-sm mt-2">請先上傳檔案並設定參數，然後點擊「開始生成題庫」</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">生成結果</h3>
          <p className="text-gray-600">共生成 {questions.length} 道題目</p>
        </div>
        <div className="space-x-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            匯出
          </Button>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-2" />
            儲存到雲端
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">題目 {index + 1}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">{question.chapter}</Badge>
                  <Badge className={getDifficultyColor(question.difficulty)}>
                    {getDifficultyLabel(question.difficulty)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">題目：</h4>
                <p className="text-gray-700 leading-relaxed">{question.question}</p>
              </div>

              {question.options.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">選項：</h4>
                  <div className="space-y-1">
                    {question.options.map((option, optionIndex) => (
                      <p key={optionIndex} className="text-gray-700 pl-2">
                        {option}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-green-700 mb-2">正確答案：</h4>
                  <p className="text-green-600 font-medium">{question.answer}</p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-700 mb-2">解析：</h4>
                  <p className="text-blue-600 text-sm leading-relaxed">{question.explanation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
