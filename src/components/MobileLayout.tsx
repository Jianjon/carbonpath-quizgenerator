
import React from 'react';
import { MobileStepFlow } from './MobileStepFlow';

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

export const MobileLayout: React.FC<MobileLayoutProps> = (props) => {
  return <MobileStepFlow {...props} />;
};
