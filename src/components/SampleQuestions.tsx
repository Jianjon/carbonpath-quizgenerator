
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface SampleQuestion {
  id: string;
  question: string;
  type: string;
  options?: string[];
  answer: string;
}

interface SampleQuestionsProps {
  sampleQuestions: SampleQuestion[];
  onSampleQuestionsChange: (questions: SampleQuestion[]) => void;
}

export const SampleQuestions: React.FC<SampleQuestionsProps> = ({
  sampleQuestions,
  onSampleQuestionsChange
}) => {
  const [textInput, setTextInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const onDrop = (acceptedFiles: File[]) => {
    setUploadedFiles(prev => [...prev, ...acceptedFiles]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  const parseAdvancedSampleText = () => {
    const lines = textInput.split('\n').filter(line => line.trim());
    const parsed: SampleQuestion[] = [];
    const errors: string[] = [];
    
    let currentQuestion = '';
    let currentOptions: string[] = [];
    let currentAnswer = '';
    let questionIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 檢測題目開始（數字 + 點或題目關鍵字）
      if (line.match(/^\d+[\.\)、]/) || line.match(/^題目\d*[：:]/)) {
        // 先保存前一個題目
        if (currentQuestion) {
          if (currentOptions.length > 0 && currentAnswer) {
            parsed.push({
              id: `sample-${parsed.length + 1}`,
              question: currentQuestion,
              type: 'multiple-choice',
              options: currentOptions,
              answer: currentAnswer
            });
          } else {
            errors.push(`題目 ${questionIndex} 缺少選項或答案`);
          }
        }
        
        // 開始新題目
        questionIndex++;
        currentQuestion = line.replace(/^\d+[\.\)、]/, '').replace(/^題目\d*[：:]/, '').trim();
        currentOptions = [];
        currentAnswer = '';
      }
      // 檢測選項（A、B、C、D 或 (A)、(B) 格式）
      else if (line.match(/^[\(（]?[A-Da-d][\)）]?[\.\)、]?/)) {
        const optionText = line.replace(/^[\(（]?[A-Da-d][\)）]?[\.\)、]?/, '').trim();
        currentOptions.push(line.trim());
      }
      // 檢測答案（答案、正確答案、解答等關鍵字）
      else if (line.match(/^(答案|正確答案|解答|答)[：:]/)) {
        currentAnswer = line.replace(/^(答案|正確答案|解答|答)[：:]/, '').trim();
      }
      // 如果是答案但沒有關鍵字，檢查是否只有單一字母
      else if (line.match(/^[A-Da-d]$/)) {
        currentAnswer = line.trim();
      }
      // 如果當前有題目但沒有選項，可能是題目的延續
      else if (currentQuestion && currentOptions.length === 0) {
        currentQuestion += ' ' + line;
      }
    }
    
    // 處理最後一個題目
    if (currentQuestion) {
      if (currentOptions.length > 0 && currentAnswer) {
        parsed.push({
          id: `sample-${parsed.length + 1}`,
          question: currentQuestion,
          type: 'multiple-choice',
          options: currentOptions,
          answer: currentAnswer
        });
      } else {
        errors.push(`題目 ${questionIndex} 缺少選項或答案`);
      }
    }
    
    setParseErrors(errors);
    
    if (parsed.length > 0) {
      onSampleQuestionsChange([...sampleQuestions, ...parsed]);
      setTextInput('');
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearSamples = () => {
    onSampleQuestionsChange([]);
    setParseErrors([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            樣題參考設定
          </span>
          {sampleQuestions.length > 0 && (
            <Badge variant="secondary">{sampleQuestions.length} 道樣題</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">樣題解析說明：</p>
              <p>AI 會學習您提供的樣題風格，包括：</p>
              <ul className="mt-1 text-xs space-y-0.5 ml-4">
                <li>• 題目表達方式和語言風格</li>
                <li>• 選項設計邏輯和干擾項策略</li>
                <li>• 解析說明的詳細程度</li>
                <li>• 題目難度和思考層次</li>
              </ul>
            </div>
          </div>
        </div>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">直接貼上</TabsTrigger>
            <TabsTrigger value="upload">上傳檔案</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4">
            <div>
              <Label htmlFor="sampleText">貼上樣題內容</Label>
              <Textarea
                id="sampleText"
                placeholder={`請貼上樣題內容，支援多種格式：

格式1：
1. 以下何者為正確的程式語言概念？
A. 變數是用來儲存資料的容器
B. 函數只能回傳數字
C. 迴圈無法巢狀使用
D. 陣列只能儲存相同類型資料
答案：A

格式2：
題目：關於物件導向程式設計的描述，何者正確？
(A) 只能使用 Java 語言
(B) 封裝是隱藏實作細節的技術
(C) 繼承會降低程式效能
(D) 多型只能在編譯時期決定
正確答案：B`}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            {parseErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">解析錯誤：</p>
                    <ul className="space-y-1">
                      {parseErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={parseAdvancedSampleText} disabled={!textInput.trim()}>
                解析樣題
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="h-4 w-4 mr-1" />
                {showPreview ? '隱藏' : '預覽'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-gray-700">
                {isDragActive ? '放開以上傳檔案' : '拖放檔案到此處或點擊上傳'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                支援 PDF, Word, Excel, TXT 格式，最大 10MB
              </p>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>已上傳檔案：</Label>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {sampleQuestions.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">已解析樣題</h4>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <Button variant="outline" size="sm" onClick={clearSamples}>
                <Trash2 className="h-4 w-4 mr-1" />
                清除全部
              </Button>
            </div>
            {showPreview && (
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {sampleQuestions.map((question, index) => (
                  <div key={question.id} className="p-3 bg-white rounded border text-sm">
                    <p className="font-medium">{index + 1}. {question.question}</p>
                    {question.options && question.options.length > 0 && (
                      <div className="mt-1 text-gray-600">
                        {question.options.map((option, i) => (
                          <p key={i} className="ml-2">{option}</p>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-green-600 font-medium">答案：{question.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
