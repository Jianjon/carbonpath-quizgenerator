
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Brain } from 'lucide-react';
import { SidebarContentComponent } from './SidebarContentComponent';
import { QuestionDisplay } from './QuestionDisplay';

interface DesktopLayoutProps {
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  handleUploadComplete: () => void;
  parameters: any;
  setParameters: (parameters: any) => void;
  generatedQuestions: any[];
  isGenerating: boolean;
  generationProgress: number;
  generationStep: string;
  onGenerate: () => void;
  onQuestionsChange: (questions: any[]) => void;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  uploadedFile,
  setUploadedFile,
  handleUploadComplete,
  parameters,
  setParameters,
  generatedQuestions,
  isGenerating,
  generationProgress,
  generationStep,
  onGenerate,
  onQuestionsChange
}) => {
  return (
    <div className="max-w-full mx-auto p-4">
      <div className="flex gap-6">
        {/* 左側：教材上傳與參數設定 (1/3) */}
        <div className="w-1/3 space-y-6 overflow-y-auto">
          <SidebarContentComponent
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            handleUploadComplete={handleUploadComplete}
            parameters={parameters}
            setParameters={setParameters}
            generatedQuestions={generatedQuestions}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
            generationStep={generationStep}
            onGenerate={onGenerate}
          />
        </div>

        {/* 右側：生成結果與預覽 (2/3) */}
        <div className="w-2/3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Brain className="h-5 w-5 text-purple-600" />
                生成結果與預覽
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionDisplay 
                questions={generatedQuestions} 
                parameters={parameters}
                onQuestionsChange={onQuestionsChange}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
