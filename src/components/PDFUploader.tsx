
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

interface PDFUploaderProps {
  uploadedFile: File | null;
  onFileUpload: (file: File | null) => void;
  onUploadComplete?: () => void;
  pageRange?: string;
  generatedQuestionsCount?: number;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({
  uploadedFile,
  onFileUpload,
  onUploadComplete,
  pageRange = '',
  generatedQuestionsCount = 0
}) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setUploadStatus('uploading');
      // 模擬上傳過程
      setTimeout(() => {
        onFileUpload(file);
        setUploadStatus('success');
        onUploadComplete?.();
      }, 1000);
    } else {
      setUploadStatus('error');
    }
  }, [onFileUpload, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const removeFile = () => {
    onFileUpload(null);
    setUploadStatus('idle');
  };

  return (
    <div className="space-y-4">
      {!uploadedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            {isDragActive ? '拖放 PDF 檔案到這裡' : '上傳教材 PDF'}
          </p>
          <p className="text-sm text-gray-500">
            拖放檔案或點擊選擇 PDF 檔案
          </p>
          {uploadStatus === 'uploading' && (
            <p className="text-blue-600 mt-2">上傳中...</p>
          )}
          {uploadStatus === 'error' && (
            <p className="text-red-600 mt-2">請上傳有效的 PDF 檔案</p>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              教材摘要與狀態
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 檔案資訊 */}
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{uploadedFile.name}</p>
                  <p className="text-sm text-green-700">
                    {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={removeFile}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* 頁數範圍狀態 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">目前設定頁數範圍：</span>
                {pageRange ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    第 {pageRange} 頁
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    尚未設定
                  </Badge>
                )}
              </div>
              
              {/* 已生成題目數量 */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">已生成題目數量：</span>
                <Badge variant="outline" 
                  className={generatedQuestionsCount > 0 ? "bg-green-100 text-green-800 border-green-200" : "text-gray-600"}>
                  {generatedQuestionsCount} 題
                </Badge>
              </div>
            </div>

            {/* 狀態說明 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">教材已就緒</p>
                  <p>請在左側設定出題參數後開始生成題庫</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
