import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, Save, FileText, FileSpreadsheet, CheckCircle, Lightbulb, Maximize2, ExternalLink } from 'lucide-react';
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
  const [expandedView, setExpandedView] = useState(false);

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

  const handleOpenInNewWindow = () => {
    const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (!newWindow) return;

    const htmlContent = generateFullPageHTML();
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  };

  const generateFullPageHTML = () => {
    return `
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>題庫預覽 - ${new Date().toLocaleDateString('zh-TW')}</title>
        <style>
          body { 
            font-family: 'Microsoft JhengHei', sans-serif; 
            margin: 0; 
            padding: 20px; 
            line-height: 1.6; 
            background: #f8fafc;
          }
          .header { 
            text-align: center; 
            margin-bottom: 40px; 
            padding: 30px; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .question-container { 
            background: white; 
            margin-bottom: 30px; 
            padding: 30px; 
            border-radius: 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            page-break-inside: avoid; 
          }
          .question-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #e2e8f0; 
            padding-bottom: 15px;
          }
          .question-number { 
            font-size: 24px; 
            font-weight: bold; 
            color: #2563eb; 
          }
          .badges { 
            display: flex; 
            gap: 8px; 
          }
          .badge { 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: 500; 
          }
          .badge-chapter { background: #f1f5f9; color: #475569; }
          .badge-易 { background: #dcfce7; color: #166534; }
          .badge-中 { background: #fef3c7; color: #92400e; }
          .badge-難 { background: #fecaca; color: #991b1b; }
          .badge-bloom { background: #e0e7ff; color: #3730a3; }
          .question-content { 
            font-size: 18px; 
            font-weight: 500; 
            margin-bottom: 25px; 
            color: #1e293b;
          }
          .options { 
            margin-bottom: 25px; 
          }
          .option { 
            display: flex; 
            align-items: flex-start; 
            gap: 12px; 
            padding: 15px; 
            margin: 12px 0; 
            background: #f8fafc; 
            border-radius: 8px; 
            border-left: 4px solid #cbd5e1;
          }
          .option-label { 
            font-weight: bold; 
            color: #475569; 
            min-width: 30px; 
          }
          .option-text { 
            color: #334155; 
          }
          .answer-section { 
            background: #f0fdf4; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #22c55e; 
            margin-bottom: 15px;
          }
          .answer-header { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            margin-bottom: 10px; 
          }
          .answer-text { 
            font-size: 18px; 
            font-weight: bold; 
            color: #15803d; 
          }
          .explanation-section { 
            background: #eff6ff; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #3b82f6;
          }
          .explanation-header { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            margin-bottom: 10px; 
          }
          .explanation-text { 
            color: #1e40af; 
            line-height: 1.7; 
          }
          .tags { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 8px; 
            margin-top: 20px; 
          }
          .tag { 
            background: #f1f5f9; 
            color: #64748b; 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 11px; 
          }
          @media print {
            body { background: white; }
            .question-container { 
              box-shadow: none; 
              border: 1px solid #e2e8f0; 
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="color: #1e293b; margin: 0 0 10px 0;">題庫預覽</h1>
          <p style="color: #64748b; margin: 0;">生成日期：${new Date().toLocaleDateString('zh-TW')} | 題目數量：${questions.length} 題</p>
        </div>
        ${questions.map((question, index) => `
          <div class="question-container">
            <div class="question-header">
              <div class="question-number">${index + 1}.</div>
              <div class="badges">
                <span class="badge badge-chapter">${question.chapter}</span>
                <span class="badge badge-${question.difficulty_label}">${question.difficulty_label}</span>
                <span class="badge badge-bloom">${getBloomLevelLabel(question.bloom_level)}</span>
              </div>
            </div>
            <div class="question-content">${question.content}</div>
            ${Object.keys(question.options).length > 0 ? `
              <div class="options">
                ${Object.entries(question.options).map(([key, value]) => `
                  <div class="option">
                    <span class="option-label">${key}.</span>
                    <span class="option-text">${value}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            <div class="answer-section">
              <div class="answer-header">
                <span style="color: #22c55e;">✅</span>
                <span style="font-weight: bold; color: #15803d;">正確答案</span>
              </div>
              <div class="answer-text">${question.correct_answer}</div>
            </div>
            <div class="explanation-section">
              <div class="explanation-header">
                <span style="color: #3b82f6;">💡</span>
                <span style="font-weight: bold; color: #1e40af;">解釋說明</span>
              </div>
              <div class="explanation-text">${question.explanation}</div>
            </div>
            ${question.tags && question.tags.length > 0 ? `
              <div class="tags">
                ${question.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `;
  };

  const handleExportPDF = async () => {
    const htmlContent = generateFullPageHTML();
    const newWindow = window.open('', '_blank');
    newWindow?.document.write(htmlContent);
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
          <Button variant="outline" onClick={() => setExpandedView(!expandedView)} size="sm">
            <Maximize2 className="h-4 w-4 mr-2" />
            {expandedView ? '縮小' : '放大'}
          </Button>
          <Button variant="outline" onClick={handleOpenInNewWindow} size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            新視窗開啟
          </Button>
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

      {/* 題目列表 */}
      <div className={`space-y-6 pb-6 ${expandedView ? 'text-lg' : ''}`}>
        {questions.map((question, index) => (
          <Card key={question.id} className={`hover:shadow-md transition-shadow ${expandedView ? 'text-lg' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className={`font-bold text-gray-900 ${expandedView ? 'text-2xl' : 'text-xl'}`}>
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
              <div className={`font-medium text-gray-900 leading-relaxed ${expandedView ? 'text-xl' : 'text-lg'}`}>
                {question.content}
              </div>

              {/* A~D 選項 */}
              {Object.keys(question.options).length > 0 && (
                <div className="space-y-3">
                  {Object.entries(question.options).map(([key, value]) => (
                    <div key={key} className={`flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300 ${expandedView ? 'p-4' : ''}`}>
                      <span className={`font-semibold text-gray-600 min-w-[20px] ${expandedView ? 'text-lg' : ''}`}>{key}.</span>
                      <span className={`text-gray-700 ${expandedView ? 'text-lg' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* ✅ 正確答案 */}
              <div className={`bg-green-50 p-4 rounded-lg border-l-4 border-green-400 ${expandedView ? 'p-6' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className={`text-green-600 ${expandedView ? 'h-6 w-6' : 'h-5 w-5'}`} />
                  <span className={`font-semibold text-green-700 ${expandedView ? 'text-lg' : ''}`}>正確答案</span>
                </div>
                <p className={`text-green-600 font-bold ${expandedView ? 'text-xl' : 'text-lg'}`}>{question.correct_answer}</p>
              </div>

              {/* 💡 解釋說明 */}
              <div className={`bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400 ${expandedView ? 'p-6' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className={`text-blue-600 ${expandedView ? 'h-6 w-6' : 'h-5 w-5'}`} />
                  <span className={`font-semibold text-blue-700 ${expandedView ? 'text-lg' : ''}`}>解釋說明</span>
                </div>
                <p className={`text-blue-600 leading-relaxed ${expandedView ? 'text-lg' : ''}`}>{question.explanation}</p>
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
