
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Zap, Loader2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GenerationControlsProps {
  uploadedFile: File | null;
  chapter?: string;
  isGenerating: boolean;
  generationProgress: number;
  generationStep: string;
  onGenerate: () => void;
}

export const GenerationControls: React.FC<GenerationControlsProps> = ({
  uploadedFile,
  isGenerating,
  generationProgress,
  generationStep,
  onGenerate
}) => {
  const handleGenerate = () => {
    if (!uploadedFile) {
      toast({
        title: "請先上傳PDF檔案",
        description: "需要先上傳PDF檔案才能開始生成題目",
        variant: "destructive"
      });
      return;
    }
    onGenerate();
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* 簡化的提示 */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">生成說明</p>
              <p className="text-xs">系統將讀取整份PDF並生成題目，推薦生成5-15題</p>
            </div>
          </div>
        </div>

        {/* 進度顯示 */}
        {isGenerating && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">{generationStep}</span>
            </div>
            <Progress 
              value={generationProgress} 
              className="h-2 transition-all duration-500 ease-in-out" 
            />
            <div className="text-xs text-gray-500 text-center animate-pulse">
              {generationProgress}% 完成
            </div>
          </div>
        )}
        
        <Button 
          onClick={handleGenerate} 
          disabled={!uploadedFile || isGenerating} 
          size="lg" 
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <Zap className="h-4 w-4 mr-2" />
          {isGenerating ? '生成中...' : '開始生成題庫'}
        </Button>
      </CardContent>
    </Card>
  );
};
