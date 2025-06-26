
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, Eye } from 'lucide-react';
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

  const parseSampleText = () => {
    // 簡單的文本解析邏輯
    const lines = textInput.split('\n').filter(line => line.trim());
    const parsed: SampleQuestion[] = [];
    
    let currentQuestion = '';
    let currentOptions: string[] = [];
    let currentAnswer = '';
    
    lines.forEach((line, index) => {
      if (line.match(/^\d+\./)) {
        // 如果有之前的題目，先保存
        if (currentQuestion) {
          parsed.push({
            id: `sample-${parsed.length + 1}`,
            question: currentQuestion,
            type: 'multiple-choice',
            options: currentOptions,
            answer: currentAnswer
          });
        }
        
        currentQuestion = line.replace(/^\d+\./, '').trim();
        currentOptions = [];
        currentAnswer = '';
      } else if (line.match(/^[A-D]\./)) {
        currentOptions.push(line);
      } else if (line.includes('答案') || line.includes('正確答案')) {
        currentAnswer = line.replace(/.*[：:]/, '').trim();
      }
    });
    
    // 保存最後一個題目
    if (currentQuestion) {
      parsed.push({
        id: `sample-${parsed.length + 1}`,
        question: currentQuestion,
        type: 'multiple-choice',
        options: currentOptions,
        answer: currentAnswer
      });
    }
    
    onSampleQuestionsChange([...sampleQuestions, ...parsed]);
    setTextInput('');
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearSamples = () => {
    onSampleQuestionsChange([]);
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
                placeholder={`請貼上樣題內容，格式例如：

1. 以下何者為正確的程式語言概念？
A. 變數是用來儲存資料的容器
B. 函數只能回傳數字
C. 迴圈無法巢狀使用
D. 陣列只能儲存相同類型資料
答案：A

2. 關於物件導向程式設計的描述，何者正確？
A. 只能使用 Java 語言
B. 封裝是隱藏實作細節的技術
C. 繼承會降低程式效能
D. 多型只能在編譯時期決定
答案：B`}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={parseSampleText} disabled={!textInput.trim()}>
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
              <h4 className="font-medium">已解析樣題</h4>
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
