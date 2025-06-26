
import React, { useState } from 'react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { QuestionDisplay } from './QuestionDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, FileText, Settings } from 'lucide-react';

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

export const QuestionBankGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parameters, setParameters] = useState({
    chapter: '',
    difficulty: 'medium',
    questionCount: 10,
    questionTypes: ['multiple-choice']
  });
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!uploadedFile) {
      alert('請先上傳 PDF 檔案');
      return;
    }

    setIsGenerating(true);
    
    // 模擬 AI 生成過程
    setTimeout(() => {
      const mockQuestions: QuestionData[] = Array.from({ length: parameters.questionCount }, (_, index) => ({
        id: `q${index + 1}`,
        type: 'multiple-choice',
        question: `關於 ${parameters.chapter} 的第 ${index + 1} 題，以下何者正確？`,
        options: [
          '選項 A：這是第一個選項',
          '選項 B：這是第二個選項',
          '選項 C：這是第三個選項',
          '選項 D：這是第四個選項'
        ],
        answer: 'B',
        explanation: `根據教材內容，正確答案是 B。這是因為在 ${parameters.chapter} 中明確提到了相關概念...`,
        difficulty: parameters.difficulty,
        chapter: parameters.chapter
      }));
      
      setGeneratedQuestions(mockQuestions);
      setIsGenerating(false);
    }, 3000);
  };

  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Brain className="h-6 w-6 text-blue-600" />
          題庫生成工作台
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              上傳檔案
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              參數設定
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              生成結果
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <PDFUploader 
              uploadedFile={uploadedFile}
              onFileUpload={setUploadedFile}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <ParameterSettings 
              parameters={parameters}
              onParametersChange={setParameters}
            />
            <div className="mt-6 text-center">
              <Button 
                onClick={handleGenerate}
                disabled={!uploadedFile || isGenerating}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {isGenerating ? '生成中...' : '開始生成題庫'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="results" className="mt-6">
            <QuestionDisplay questions={generatedQuestions} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
