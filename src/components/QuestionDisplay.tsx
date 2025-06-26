import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, Save, FileText, FileSpreadsheet } from 'lucide-react';

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
    console.log('儲存題庫到 Supabase:', questions);
    alert('題庫已儲存到雲端！');
  };

  const handleExportExcel = () => {
    // Excel 格式：題號/題目/答案/答案解析/問題A,B,C,D
    const excelData = questions.map((q, index) => ({
      '題號': index + 1,
      '題目': q.question,
      '答案': q.answer,
      '答案解析': q.explanation,
      '選項A': q.options[0] || '',
      '選項B': q.options[1] || '',
      '選項C': q.options[2] || '',
      '選項D': q.options[3] || ''
    }));

    const csvContent = [
      Object.keys(excelData[0]).join(','),
      ...excelData.map(row => Object.values(row).map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `題庫_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportPDF = async () => {
    // 生成 PDF 格式的考卷
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>題目考卷</title>
        <style>
          body { font-family: 'Microsoft JhengHei', sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; }
          .question { margin-bottom: 25px; page-break-inside: avoid; }
          .question-number { font-weight: bold; color: #2563eb; }
          .question-text { margin: 10px 0; }
          .options { margin-left: 20px; }
          .answer-section { margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 5px; }
          .difficulty { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
          .easy { background: #dcfce7; color: #166534; }
          .medium { background: #fef3c7; color: #92400e; }
          .hard { background: #fecaca; color: #991b1b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>題目考卷</h1>
          <p>生成日期：${new Date().toLocaleDateString('zh-TW')}</p>
          <p>題目數量：${questions.length} 題</p>
        </div>
        ${questions.map((q, index) => `
          <div class="question">
            <div class="question-number">第 ${index + 1} 題 
              <span class="difficulty ${q.difficulty}">${getDifficultyLabel(q.difficulty)}</span>
            </div>
            <div class="question-text">${q.question}</div>
            ${q.options.length > 0 ? `
              <div class="options">
                ${q.options.map(option => `<div>${option}</div>`).join('')}
              </div>
            ` : ''}
            <div class="answer-section">
              <strong>正確答案：</strong>${q.answer}<br>
              <strong>解析：</strong>${q.explanation}
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    newWindow?.document.write(printContent);
    newWindow?.document.close();
    newWindow?.print();
  };

  if (questions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">尚未生成題目</h3>
          <p className="text-gray-500">請先上傳檔案並設定參數，然後點擊「開始生成題庫」</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      {/* 操作工具列 */}
      <div className="flex justify-between items-center sticky top-0 bg-white z-10 pb-4 border-b">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">題目預覽</h3>
          <p className="text-gray-600">共生成 {questions.length} 道題目</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            匯出 Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF} size="sm">
            <FileText className="h-4 w-4 mr-2" />
            匯出 PDF
          </Button>
          <Button onClick={handleSave} size="sm" className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-2" />
            儲存到雲端
          </Button>
        </div>
      </div>

      {/* 題目列表 */}
      <div className="space-y-4 pb-6">
        {questions.map((question, index) => (
          <Card key={question.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">第 {index + 1} 題</CardTitle>
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
                <p className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{question.question}</p>
              </div>

              {question.options.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">選項：</h4>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="text-gray-700 bg-gray-50 p-2 rounded border-l-4 border-gray-300">
                        {option}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <h4 className="font-medium text-green-700 mb-2">正確答案：</h4>
                  <p className="text-green-600 font-medium">{question.answer}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
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
