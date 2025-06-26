import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CheckCircle, Circle, FileText, Tag, Download, Eye, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  parameters?: any;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ questions, parameters }) => {
  const [sessionName, setSessionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showFullPage, setShowFullPage] = useState(false);

  // 保存到資料庫
  const saveToDatabase = async () => {
    if (!sessionName.trim()) {
      toast({
        title: "請輸入會話名稱",
        description: "請為這批題目輸入一個識別名稱",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // 創建生成會話
      const { data: session, error: sessionError } = await supabase
        .from('generation_sessions')
        .insert({
          session_name: sessionName,
          parameters: parameters || {},
          question_count: questions.length
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 保存題目
      const questionsToSave = questions.map(q => ({
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type,
        difficulty: q.difficulty,
        difficulty_label: q.difficulty_label,
        bloom_level: q.bloom_level,
        chapter: q.chapter,
        source_pdf: q.source_pdf,
        page_range: q.page_range,
        tags: q.tags,
        session_id: session.id
      }));

      const { error: questionsError } = await supabase
        .from('question_bank')
        .insert(questionsToSave);

      if (questionsError) throw questionsError;

      toast({
        title: "保存成功",
        description: `${questions.length} 道題目已保存到資料庫`
      });

      setSessionName('');
    } catch (error) {
      console.error('保存失敗:', error);
      toast({
        title: "保存失敗",
        description: error.message || "請重新嘗試",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 下載為PDF
  const downloadAsPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>題庫</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .question { margin-bottom: 30px; page-break-inside: avoid; }
          .question-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }
          .options { margin: 10px 0; }
          .option { margin: 5px 0; padding: 5px 0; }
          .answer { font-weight: bold; margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px; }
          .explanation { background: #f5f5f5; padding: 10px; margin-top: 10px; border-radius: 5px; }
          .explanation-title { font-weight: bold; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <h1>題庫 (${questions.length} 題)</h1>
        ${questions.map((q, index) => `
          <div class="question">
            <div class="question-title">第 ${index + 1} 題：${q.content}</div>
            <div class="options">
              ${Object.entries(q.options).map(([key, value]) => 
                `<div class="option">${key}. ${value}</div>`
              ).join('')}
            </div>
            <div class="answer">正確答案：${q.correct_answer}</div>
            <div class="explanation">
              <div class="explanation-title">答案精簡說明：</div>
              ${q.explanation}
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // 下載為Excel
  const downloadAsExcel = () => {
    const csvContent = [
      ['題目', '答案', '選項1', '選項2', '選項3', '選項4', '答案精簡說明'],
      ...questions.map((q) => [
        q.content,
        q.correct_answer,
        q.options.A || '',
        q.options.B || '',
        q.options.C || '',
        q.options.D || '',
        q.explanation
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `題庫_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

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
        
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                保存到資料庫
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>保存題庫</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">會話名稱</label>
                  <Input
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="例如：第一章測驗題庫"
                  />
                </div>
                <Button 
                  onClick={saveToDatabase} 
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? '保存中...' : '確認保存'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={downloadAsPDF}>
            <Download className="h-4 w-4 mr-2" />
            下載PDF
          </Button>
          
          <Button variant="outline" size="sm" onClick={downloadAsExcel}>
            <Download className="h-4 w-4 mr-2" />
            下載Excel
          </Button>
          
          <Dialog open={showFullPage} onOpenChange={setShowFullPage}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                全屏預覽
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>題庫完整預覽</DialogTitle>
              </DialogHeader>
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
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-800 leading-relaxed font-medium">
                          {question.content}
                        </p>
                      </div>

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

                      {question.explanation && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-900 mb-2">解析：</h4>
                          <p className="text-blue-800 leading-relaxed">
                            {question.explanation}
                          </p>
                        </div>
                      )}

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
            </DialogContent>
          </Dialog>
        </div>
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
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-800 leading-relaxed font-medium">
                  {question.content}
                </p>
              </div>

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

              {question.explanation && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">解析：</h4>
                  <p className="text-blue-800 leading-relaxed">
                    {question.explanation}
                  </p>
                </div>
              )}

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
