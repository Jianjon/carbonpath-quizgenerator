
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Brain, 
  ArrowLeft, 
  ArrowRight, 
  Check,
  FileText
} from 'lucide-react';
import { SidebarContentComponent } from './SidebarContentComponent';
import { QuestionDisplay } from './QuestionDisplay';

interface MobileStepFlowProps {
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

type FlowStep = 'setup' | 'results';

export const MobileStepFlow: React.FC<MobileStepFlowProps> = ({
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
  const [currentStep, setCurrentStep] = useState<FlowStep>('setup');

  // 當有題目生成時，自動切換到結果頁面
  React.useEffect(() => {
    if (generatedQuestions.length > 0 && !isGenerating && currentStep === 'setup') {
      setCurrentStep('results');
    }
  }, [generatedQuestions.length, isGenerating, currentStep]);

  const handleGenerate = async () => {
    await onGenerate();
  };

  const goToSetup = () => {
    setCurrentStep('setup');
  };

  const canProceed = uploadedFile || parameters.chapter;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-blue-100">
      {/* 步驟指示器 */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === 'setup' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {currentStep === 'setup' ? <Settings className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </div>
            <span className={`text-sm font-medium ${
              currentStep === 'setup' ? 'text-blue-600' : 'text-gray-500'
            }`}>
              題庫設定
            </span>
          </div>

          <div className="flex-1 h-px bg-gray-300 mx-4" />

          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              <Brain className="h-4 w-4" />
            </div>
            <span className={`text-sm font-medium ${
              currentStep === 'results' ? 'text-blue-600' : 'text-gray-500'
            }`}>
              生成結果
            </span>
          </div>
        </div>
      </div>

      {/* 主要內容區域 */}
      <div className="flex-1 p-4">
        {currentStep === 'setup' && (
          <div className="space-y-4">
            {/* 頁面標題 */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                題庫生成設定
              </h1>
              <p className="text-gray-600">
                請上傳教材並設定生成參數
              </p>
            </div>

            {/* 設定內容 */}
            <Card>
              <CardContent className="p-0">
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
                  onGenerate={handleGenerate}
                />
              </CardContent>
            </Card>

            {/* 進度提示 */}
            {!canProceed && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-amber-800 mb-1">
                        完成設定以繼續
                      </h3>
                      <p className="text-sm text-amber-700">
                        請上傳 PDF 檔案或輸入頁數範圍來開始生成題庫
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentStep === 'results' && (
          <div className="space-y-4">
            {/* 返回按鈕和標題 */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={goToSetup}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                修改設定
              </Button>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                {generatedQuestions.length} 題
              </Badge>
            </div>

            {/* 頁面標題 */}
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                生成結果與預覽
              </h1>
              <p className="text-gray-600">
                檢視並編輯您的題庫
              </p>
            </div>

            {/* 結果內容 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-4 w-4 text-purple-600" />
                  題庫預覽
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

            {/* 底部操作按鈕 */}
            <div className="pb-4">
              <Button
                onClick={goToSetup}
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                重新設定並生成
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
