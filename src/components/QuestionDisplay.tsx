
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, Save, FileText, FileSpreadsheet, CheckCircle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case '易': return 'bg-green-100 text-green-800';
      case '中': return 'bg-yellow-100 text-yellow-800';
      case '難': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBloomLevelLabel = (level: number) => {
    const labels = ['', '記憶', '理解', '應用', '分析', '評鑑', '創造'];
    return labels[level] || `層級${level}`;
  };

  const handleSaveToSupabase = async () => {
    try {
      // 先儲存章節資訊
      const chapterData = {
        name: questions[0]?.chapter || '未命名章節',
        description: `包含 ${questions.length} 道題目`,
        pdf_source: questions[0]?.source_pdf || null
      };

      const { data: chapterResult, error: chapterError } = await supabase
        .from('chapters')
        .insert([chapterData])
        .select()
        .single();

      if (chapterError) {
        throw new Error('儲存章節失敗: ' + chapterError.message);
      }

      // 準備題目資料
      const questionsToSave = questions.map(q => ({
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type,
        difficulty: q.difficulty,
        difficulty_label: q.difficulty_label,
        bloom_level: q.bloom_level,
        chapter_id: chapterResult.id,
        source_pdf: q.source_pdf,
        page_range: q.page_range,
        tags: q.tags || [],
        created_by: null // 暫時設為 null，之後可加入使用者系統
      }));

      const { error: questionsError } = await supabase
        .from('question_bank')
        .insert(questionsToSave);

      if (questionsError) {
        throw new Error('儲存題目失敗: ' + questionsError.message);
      }

      alert('題庫已成功儲存到雲端！');
    } catch (error) {
      console.error('儲存失敗:', error);
      alert(`儲存失敗：${error.message}`);
    }
  };

  const handleExportExcel = () => {
    // 依照需求的 Excel 格式：題目 | 答案 | 選項1 | 選項2 | 選項3 | 選項4 | 答案精簡說明
    const excelData = questions.map((q, index) => {
      const optionKeys = Object.keys(q.options).sort();
      return {
        '題目': q.content,
        '答案': q.correct_answer,
        '選項1': q.options[optionKeys[0]] || '',
        '選項2': q.options[optionKeys[1]] || '',
        '選項3': q.options[optionKeys[2]] || '',
        '選項4': q.options[optionKeys[3]] || '',
        '答案精簡說明': q.explanation
      };
    });

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
    // 依照需求的顯示格式：題號 + 題目內容 + A~D 選項 + 正確答案 + 解釋說明
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>題目考卷</title>
        <style>
          body { font-family: 'Microsoft JhengHei', sans-serif; margin: 20px; line-height: 1.8; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .question { margin-bottom: 30px; page-break-inside: avoid; }
          .question-number { font-weight: bold; color: #2563eb; font-size: 18px; margin-bottom: 10px; }
          .question-content { margin: 15px 0; font-size: 16px; font-weight: 500; }
          .options { margin: 15px 0 20px 20px; }
          .option { margin: 8px 0; font-size: 15px; }
          .answer-section { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745; }
          .correct-answer { color: #28a745; font-weight: bold; margin-bottom: 10px; }
          .explanation { color: #495057; line-height: 1.6; }
          .difficulty { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-left: 10px; }
          .易 { background: #d4edda; color: #155724; }
          .中 { background: #fff3cd; color: #856404; }
          .難 { background: #f8d7da; color: #721c24; }
          .bloom-level { display: inline-block; padding: 2px 8px; background: #e9ecef; color: #495057; border-radius: 8px; font-size: 11px; margin-left: 5px; }
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
            <div class="question-number">
              ${index + 1}. 
              <span class="difficulty ${q.difficulty_label}">${q.difficulty_label}</span>
              <span class="bloom-level">${getBloomLevelLabel(q.bloom_level)}</span>
            </div>
            <div class="question-content">${q.content}</div>
            ${Object.keys(q.options).length > 0 ? `
              <div class="options">
                ${Object.entries(q.options).map(([key, value]) => `
                  <div class="option">${key}. ${value}</div>
                `).join('')}
              </div>
            ` : ''}
            <div class="answer-section">
              <div class="correct-answer">✅ 正確答案：${q.correct_answer}</div>
              <div class="explanation">💡 解釋說明：${q.explanation}</div>
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
          <Button onClick={handleSaveToSupabase} size="sm" className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-2" />
            儲存到雲端
          </Button>
        </div>
      </div>

      {/* 題目列表 - 依照平台/PDF 顯示格式 */}
      <div className="space-y-6 pb-6">
        {questions.map((question, index) => (
          <Card key={question.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl font-bold text-gray-900">
                  {index + 1}.
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">{question.chapter}</Badge>
                  <Badge className={getDifficultyColor(question.difficulty_label)}>
                    {question.difficulty_label}
                  </Badge>
                  <Badge variant="secondary">
                    {getBloomLevelLabel(question.bloom_level)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 題目內容 */}
              <div className="text-lg font-medium text-gray-900 leading-relaxed">
                {question.content}
              </div>

              {/* A~D 選項 */}
              {Object.keys(question.options).length > 0 && (
                <div className="space-y-3">
                  {Object.entries(question.options).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
                      <span className="font-semibold text-gray-600 min-w-[20px]">{key}.</span>
                      <span className="text-gray-700">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* ✅ 正確答案（顯示在題目下） */}
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700">正確答案</span>
                </div>
                <p className="text-green-600 font-bold text-lg">{question.correct_answer}</p>
              </div>

              {/* 💡 解釋說明（標準段落） */}
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-700">解釋說明</span>
                </div>
                <p className="text-blue-600 leading-relaxed">{question.explanation}</p>
              </div>

              {/* 標籤資訊 */}
              {question.tags && question.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {question.tags.map((tag, tagIndex) => (
                    <Badge key={tagIndex} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
