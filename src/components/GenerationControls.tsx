
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, Loader2, AlertCircle, FileText, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GenerationControlsProps {
  uploadedFile: File | null;
  isGenerating: boolean;
  generationProgress: number;
  generationStep: string;
  pdfPreview?: string;
  onGenerate: () => void;
}

export const GenerationControls: React.FC<GenerationControlsProps> = ({
  uploadedFile,
  isGenerating,
  generationProgress,
  generationStep,
  pdfPreview,
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
      <CardContent className="pt-4 space-y-4">
        {/* PDF 預覽區域 */}
        {pdfPreview && !isGenerating && (
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">PDF 內容預覽：</p>
                <div className="text-xs bg-gray-50 p-2 rounded border max-h-20 overflow-y-auto">
                  {pdfPreview}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 使用說明 */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">生成說明</p>
              <ul className="text-xs space-y-1">
                <li>• 系統將自動讀取整份 PDF（最多10頁）</li>
                <li>• 推薦生成 5-15 題，避免內容不足</li>
                <li>• 請確保 PDF 為文字版，非掃描圖片</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 檔案資訊 */}
        {uploadedFile && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span>檔案：{uploadedFile.name}</span>
            <span className="text-gray-400">
              ({(uploadedFile.size / 1024 / 1024).toFixed(1)} MB)
            </span>
          </div>
        )}

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
