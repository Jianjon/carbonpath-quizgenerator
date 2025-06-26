import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, FileText, Tag } from 'lucide-react';

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

interface QuestionDisplayProps {
  questions: QuestionData[];
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ questions }) => {
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <FileText className="h-16 w-16 mb-4 text-gray-300" />
        <h3 className="text-lg font-medium mb-2">尚未生成題目</h3>
        <p className="text-sm text-center">
          請完成左側設定並點擊「開始生成題庫」按鈕
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">
          生成題目總數：{questions.length} 題
        </h2>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <Card key={question.id} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-start justify-between">
                <span className="font-medium text-gray-800">
                  第 {index + 1} 題
                </span>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {question.difficulty_label || '中等'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {question.question_type === 'choice' ? '選擇題' : question.question_type}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 題目內容 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-800 leading-relaxed font-medium">
                  {question.content}
                </p>
              </div>

              {/* 選項 */}
              {question.options && (
                <div className="space-y-2">
                  {Object.entries(question.options).map(([key, value]) => (
                    <div
                      key={key}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        key === question.correct_answer
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      {key === question.correct_answer ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-700 min-w-[20px]">
                        {key}.
                      </span>
                      <span className="text-gray-800 flex-1">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 解析 */}
              {question.explanation && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">解析：</h4>
                  <p className="text-blue-800 leading-relaxed">
                    {question.explanation}
                  </p>
                </div>
              )}

              {/* 標籤和來源資訊 */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {question.tags && question.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3 text-gray-500" />
                    <div className="flex gap-1">
                      {question.tags.map((tag, tagIndex) => (
                        <Badge key={tagIndex} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {question.source_pdf && (
                  <Badge variant="secondary" className="text-xs">
                    來源：{question.source_pdf}
                  </Badge>
                )}
                
                {question.page_range && (
                  <Badge variant="secondary" className="text-xs">
                    頁數：{question.page_range}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
