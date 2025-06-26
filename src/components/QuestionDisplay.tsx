import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, Circle, FileText, Tag, Download, Eye, Edit, Check, X } from 'lucide-react';
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
  onQuestionsChange?: (questions: QuestionData[]) => void;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ 
  questions, 
  parameters, 
  onQuestionsChange 
}) => {
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [showFullPage, setShowFullPage] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 檢測手機版
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 獲取用戶IP位址
  const getUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get IP:', error);
      return 'unknown';
    }
  };

  // 自動保存到資料庫
  useEffect(() => {
    if (questions.length > 0) {
      saveQuestionsAutomatically();
    }
  }, [questions]);

  const saveQuestionsAutomatically = async () => {
    try {
      const userIP = await getUserIP();
      
      // 創建生成會話
      const { data: session, error: sessionError } = await supabase
        .from('generation_sessions')
        .insert({
          session_name: `自動保存_${new Date().toISOString().split('T')[0]}_${userIP}`,
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

      console.log(`自動保存成功: ${questions.length} 道題目已保存`);
    } catch (error) {
      console.error('自動保存失敗:', error);
    }
  };

  // 獲取題目風格標籤
  const getQuestionStyleLabel = (style: string) => {
    switch (style) {
      case 'intuitive': return '直覺刷題';
      case 'application': return '素養應用';
      case 'diagnostic': return '錯誤診斷';
      case 'strategic': return '策略推演';
      case 'mixed': return '混合應用';
      default: return '選擇題';
    }
  };

  // 開始編輯題目
  const handleEditQuestion = (question: QuestionData) => {
    setEditingQuestionId(question.id);
    setEditingQuestion({ ...question });
  };

  // 取消編輯
  const handleCancelEdit = () => {
    setEditingQuestionId(null);
    setEditingQuestion(null);
  };

  // 確認修改
  const handleConfirmEdit = () => {
    if (!editingQuestion) return;

    const updatedQuestions = questions.map(q => 
      q.id === editingQuestion.id ? editingQuestion : q
    );
    
    onQuestionsChange?.(updatedQuestions);
    setEditingQuestionId(null);
    setEditingQuestion(null);
    
    toast({
      title: "修改成功",
      description: "題目已更新"
    });
  };

  // 更新編輯中的題目
  const updateEditingQuestion = (field: string, value: any) => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      [field]: value
    });
  };

  // 更新選項
  const updateOption = (key: string, value: string) => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      options: {
        ...editingQuestion.options,
        [key]: value
      }
    });
  };

  // 手機版優化的下載功能
  const downloadAsPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>題庫</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 10px; 
            line-height: 1.4; 
            font-size: ${isMobile ? '14px' : '16px'}; 
          }
          .question { 
            margin-bottom: 20px; 
            page-break-inside: avoid; 
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 5px;
          }
          .question-title { 
            font-weight: bold; 
            margin-bottom: 8px; 
            font-size: ${isMobile ? '16px' : '18px'}; 
          }
          .options { margin: 8px 0; }
          .option { 
            margin: 3px 0; 
            padding: 3px 0; 
            font-size: ${isMobile ? '13px' : '15px'};
          }
          .answer { 
            font-weight: bold; 
            margin: 8px 0; 
            padding: 8px; 
            background: #f0f0f0; 
            border-radius: 5px; 
          }
          .explanation { 
            background: #f5f5f5; 
            padding: 8px; 
            margin-top: 8px; 
            border-radius: 5px; 
            font-size: ${isMobile ? '12px' : '14px'};
          }
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
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
        <FileText className={`${isMobile ? 'h-12 w-12' : 'h-16 w-16'} mb-4 text-gray-300`} />
        <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-medium mb-2 text-center`}>尚未生成題目</h3>
        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-center px-2`}>
          請完成設定並點擊「開始生成題庫」按鈕
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
        <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-800`}>
          生成題目總數：{questions.length} 題
        </h2>
        
        <div className={`flex ${isMobile ? 'flex-wrap' : ''} gap-2`}>
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "sm"} 
            onClick={downloadAsPDF}
            className={isMobile ? 'flex-1 min-w-0' : ''}
          >
            <Download className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
            {isMobile ? 'PDF' : '下載PDF'}
          </Button>
          
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "sm"} 
            onClick={downloadAsExcel}
            className={isMobile ? 'flex-1 min-w-0' : ''}
          >
            <Download className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
            {isMobile ? 'Excel' : '下載Excel'}
          </Button>
          
          <Dialog open={showFullPage} onOpenChange={setShowFullPage}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size={isMobile ? "sm" : "sm"}
                className={isMobile ? 'flex-1 min-w-0' : ''}
              >
                <Eye className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
                {isMobile ? '預覽' : '全屏預覽'}
              </Button>
            </DialogTrigger>
            <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh]' : 'max-w-4xl max-h-[80vh]'} overflow-y-auto`}>
              <DialogHeader>
                <DialogTitle className={isMobile ? 'text-base' : 'text-lg'}>題庫完整預覽</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <Card key={question.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className={`${isMobile ? 'pb-2' : 'pb-3'}`}>
                      <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'} flex items-start justify-between gap-2`}>
                        <span className="font-medium text-gray-800 flex-1">
                          第 {index + 1} 題
                        </span>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                            {question.difficulty_label || '中等'}
                          </Badge>
                          <Badge variant="secondary" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                            {getQuestionStyleLabel(parameters?.questionStyle || 'choice')}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={`space-y-${isMobile ? '3' : '4'}`}>
                      <div className={`${isMobile ? 'p-3' : 'p-4'} bg-gray-50 rounded-lg`}>
                        <p className={`text-gray-800 leading-relaxed font-medium ${isMobile ? 'text-sm' : ''}`}>
                          {question.content}
                        </p>
                      </div>

                      {question.options && (
                        <div className={`space-y-${isMobile ? '1' : '2'}`}>
                          {Object.entries(question.options).map(([key, value]) => (
                            <div
                              key={key}
                              className={`flex items-center space-x-2 ${isMobile ? 'p-2' : 'p-3'} rounded-lg border bg-white border-gray-200`}
                            >
                              <Circle className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-gray-400 flex-shrink-0`} />
                              <span className={`font-medium text-gray-700 ${isMobile ? 'min-w-[15px] text-sm' : 'min-w-[20px]'}`}>
                                {key}.
                              </span>
                              <span className={`text-gray-800 flex-1 ${isMobile ? 'text-sm' : ''}`}>{value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={`${isMobile ? 'p-2' : 'p-3'} bg-green-50 rounded-lg border border-green-200`}>
                        <div className={`font-medium text-green-900 ${isMobile ? 'text-sm' : ''}`}>
                          正確答案：{question.correct_answer}
                        </div>
                      </div>

                      {question.explanation && (
                        <div className={`${isMobile ? 'p-3' : 'p-4'} bg-blue-50 rounded-lg border border-blue-200`}>
                          <h4 className={`font-medium text-blue-900 mb-2 ${isMobile ? 'text-sm' : ''}`}>解析：</h4>
                          <p className={`text-blue-800 leading-relaxed ${isMobile ? 'text-xs' : ''}`}>
                            {question.explanation}
                          </p>
                        </div>
                      )}

                      <div className={`flex flex-wrap gap-1 pt-2 border-t border-gray-100`}>
                        {question.tags && question.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className={`${isMobile ? 'h-2 w-2' : 'h-3 w-3'} text-gray-500`} />
                            <div className="flex gap-1 flex-wrap">
                              {question.tags.map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="outline" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {question.source_pdf && (
                          <Badge variant="secondary" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                            來源：{isMobile ? question.source_pdf.substring(0, 10) + '...' : question.source_pdf}
                          </Badge>
                        )}
                        
                        {question.page_range && (
                          <Badge variant="secondary" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
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

      {/* 題目顯示區 */}
      <div className="space-y-3">
        {questions.map((question, index) => (
          <Card key={question.id} className="border-l-4 border-l-blue-500">
            <CardHeader className={`${isMobile ? 'pb-2' : 'pb-3'}`}>
              <CardTitle className={`${isMobile ? 'text-sm' : 'text-base'} flex items-start justify-between gap-2`}>
                <span className="font-medium text-gray-800 flex-1">
                  第 {index + 1} 題
                </span>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                    {question.difficulty_label || '中等'}
                  </Badge>
                  <Badge variant="secondary" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                    [{getQuestionStyleLabel(parameters?.questionStyle || 'choice')}]
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className={`space-y-${isMobile ? '3' : '4'}`}>
              {editingQuestionId === question.id ? (
                // 編輯模式
                <div className={`space-y-3 ${isMobile ? 'p-3' : 'p-4'} bg-yellow-50 border border-yellow-200 rounded-lg`}>
                  <div>
                    <Label htmlFor="question-content" className={isMobile ? 'text-sm' : ''}>題目內容</Label>
                    <Textarea
                      id="question-content"
                      value={editingQuestion?.content || ''}
                      onChange={(e) => updateEditingQuestion('content', e.target.value)}
                      className={`mt-1 ${isMobile ? 'text-sm' : ''}`}
                      rows={isMobile ? 2 : 3}
                    />
                  </div>

                  <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                    {editingQuestion?.options && Object.entries(editingQuestion.options).map(([key, value]) => (
                      <div key={key}>
                        <Label htmlFor={`option-${key}`} className={isMobile ? 'text-sm' : ''}>選項 {key}</Label>
                        <Input
                          id={`option-${key}`}
                          value={value}
                          onChange={(e) => updateOption(key, e.target.value)}
                          className={`mt-1 ${isMobile ? 'text-sm' : ''}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label htmlFor="correct-answer" className={isMobile ? 'text-sm' : ''}>正確答案</Label>
                    <Input
                      id="correct-answer"
                      value={editingQuestion?.correct_answer || ''}
                      onChange={(e) => updateEditingQuestion('correct_answer', e.target.value)}
                      className={`mt-1 ${isMobile ? 'text-sm' : ''}`}
                      placeholder="例如：A"
                    />
                  </div>

                  <div>
                    <Label htmlFor="explanation" className={isMobile ? 'text-sm' : ''}>解析</Label>
                    <Textarea
                      id="explanation"
                      value={editingQuestion?.explanation || ''}
                      onChange={(e) => updateEditingQuestion('explanation', e.target.value)}
                      className={`mt-1 ${isMobile ? 'text-sm' : ''}`}
                      rows={isMobile ? 2 : 3}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleConfirmEdit}
                      className={`bg-green-600 hover:bg-green-700 ${isMobile ? 'flex-1 text-xs' : ''}`}
                    >
                      <Check className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
                      確認修改
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      className={isMobile ? 'flex-1 text-xs' : ''}
                    >
                      <X className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                // 顯示模式
                <>
                  <div className={`${isMobile ? 'p-3' : 'p-4'} bg-gray-50 rounded-lg`}>
                    <p className={`text-gray-800 leading-relaxed font-medium ${isMobile ? 'text-sm' : ''}`}>
                      {question.content}
                    </p>
                  </div>

                  {question.options && (
                    <div className={`space-y-${isMobile ? '1' : '2'}`}>
                      {Object.entries(question.options).map(([key, value]) => (
                        <div
                          key={key}
                          className={`flex items-center space-x-2 ${isMobile ? 'p-2' : 'p-3'} rounded-lg border bg-white border-gray-200`}
                        >
                          <Circle className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-gray-400 flex-shrink-0`} />
                          <span className={`font-medium text-gray-700 ${isMobile ? 'min-w-[15px] text-sm' : 'min-w-[20px]'}`}>
                            {key}.
                          </span>
                          <span className={`text-gray-800 flex-1 ${isMobile ? 'text-sm' : ''}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`${isMobile ? 'p-2' : 'p-3'} bg-green-50 rounded-lg border border-green-200`}>
                    <div className={`font-medium text-green-900 ${isMobile ? 'text-sm' : ''}`}>
                      正確答案：{question.correct_answer}
                    </div>
                  </div>

                  {question.explanation && (
                    <div className={`${isMobile ? 'p-3' : 'p-4'} bg-blue-50 rounded-lg border border-blue-200`}>
                      <h4 className={`font-medium text-blue-900 mb-2 ${isMobile ? 'text-sm' : ''}`}>解析：</h4>
                      <p className={`text-blue-800 leading-relaxed ${isMobile ? 'text-xs' : ''}`}>
                        {question.explanation}
                      </p>
                    </div>
                  )}

                  {/* 題目操作按鈕 */}
                  <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} pt-2 border-t border-gray-100`}>
                    <div className="flex flex-wrap gap-1">
                      {question.tags && question.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className={`${isMobile ? 'h-2 w-2' : 'h-3 w-3'} text-gray-500`} />
                          <div className="flex gap-1 flex-wrap">
                            {question.tags.map((tag, tagIndex) => (
                              <Badge key={tagIndex} variant="outline" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {question.source_pdf && (
                        <Badge variant="secondary" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                          來源：{isMobile ? question.source_pdf.substring(0, 8) + '...' : question.source_pdf}
                        </Badge>
                      )}
                      
                      {question.page_range && (
                        <Badge variant="secondary" className={`${isMobile ? 'text-xs px-1' : 'text-xs'}`}>
                          頁數：{question.page_range}
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditQuestion(question)}
                        className={`text-blue-600 hover:text-blue-700 hover:bg-blue-50 ${isMobile ? 'text-xs px-2' : ''}`}
                      >
                        <Edit className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
                        修改此題
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
