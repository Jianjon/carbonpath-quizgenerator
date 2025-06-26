
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain } from 'lucide-react';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarInset,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { SidebarContentComponent } from './SidebarContentComponent';
import { QuestionDisplay } from './QuestionDisplay';

interface MobileLayoutProps {
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

export const MobileLayout: React.FC<MobileLayoutProps> = ({
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r">
          <SidebarHeader className="border-b p-4">
            <h2 className="font-semibold text-lg">題庫生成設定</h2>
          </SidebarHeader>
          <SidebarContent>
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
          </SidebarContent>
        </Sidebar>
        
        <SidebarInset className="flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-lg font-semibold">生成結果與預覽</h1>
          </header>
          
          <div className="flex-1 p-4">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-4 w-4 text-purple-600" />
                  題庫預覽
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full overflow-auto">
                <QuestionDisplay 
                  questions={generatedQuestions} 
                  parameters={parameters}
                  onQuestionsChange={onQuestionsChange}
                />
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
