
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Zap, Loader2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GenerationControlsProps {
  uploadedFile: File | null;
  chapter: string;
  isGenerating: boolean;
  generationProgress: number;
  generationStep: string;
  onGenerate: () => void;
}

export const GenerationControls: React.FC<GenerationControlsProps> = ({
  uploadedFile,
  chapter,
  isGenerating,
  generationProgress,
  generationStep,
  onGenerate
}) => {
  const handleGenerate = () => {
    if (!uploadedFile && !chapter) {
      toast({
        title: "請先完成設定",
        description: "請上傳 PDF 檔案或輸入頁數範圍",
        variant: "destructive"
      });
      return;
    }
    onGenerate();
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* 生成時間說明 */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">生成時間說明</p>
              <p className="text-xs">題目生成時間依據題數而定：</p>
              <ul className="mt-1 text-xs space-y-0.5">
                <li>• 5-10題：約 30-60 秒</li>
                <li>• 11-20題：約 1-2 分鐘</li>
                <li>• 21-30題：約 2-3 分鐘</li>
                <li>• 31題以上：約 3-5 分鐘</li>
              </ul>
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
            <Progress value={generationProgress} className="h-2" />
            <div className="text-xs text-gray-500 text-center">
              {generationProgress}% 完成
            </div>
          </div>
        )}
        
        <Button 
          onClick={handleGenerate} 
          disabled={!uploadedFile && !chapter || isGenerating} 
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
