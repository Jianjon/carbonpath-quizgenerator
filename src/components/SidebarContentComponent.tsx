
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { PDFUploader } from './PDFUploader';
import { ParameterSettings } from './ParameterSettings';
import { GenerationControls } from './GenerationControls';
import { SampleQuestion, ChapterWeight, WeightingConfig, Parameters } from '@/types/question';

interface SidebarContentComponentProps {
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  handleUploadComplete: () => void;
  parameters: Parameters;
  setParameters: (parameters: Parameters) => void;
  generatedQuestions: any[];
  isGenerating: boolean;
  generationProgress: number;
  generationStep: string;
  onGenerate: () => void;
}

export const SidebarContentComponent: React.FC<SidebarContentComponentProps> = ({
  uploadedFile,
  setUploadedFile,
  handleUploadComplete,
  parameters,
  setParameters,
  generatedQuestions,
  isGenerating,
  generationProgress,
  generationStep,
  onGenerate
}) => {
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4 text-blue-600" />
            教材上傳
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PDFUploader 
            uploadedFile={uploadedFile} 
            onFileUpload={setUploadedFile} 
            onUploadComplete={handleUploadComplete}
            pageRange={parameters.chapter}
            generatedQuestionsCount={generatedQuestions.length}
          />
        </CardContent>
      </Card>

      <ParameterSettings 
        parameters={parameters} 
        onParametersChange={setParameters} 
        uploadedFile={uploadedFile} 
      />

      <GenerationControls
        uploadedFile={uploadedFile}
        chapter={parameters.chapter}
        isGenerating={isGenerating}
        generationProgress={generationProgress}
        generationStep={generationStep}
        onGenerate={onGenerate}
      />
    </div>
  );
};
