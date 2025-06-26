
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

interface PDFUploaderProps {
  uploadedFile: File | null;
  onFileUpload: (file: File | null) => void;
  onUploadComplete?: () => void;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({
  uploadedFile,
  onFileUpload,
  onUploadComplete
}) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const simulateUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadComplete(false);

    // 模擬上傳進度
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsUploading(false);
    setUploadComplete(true);
    onFileUpload(file);
    
    toast({
      title: "上傳完成",
      description: `${file.name} 已成功上傳`,
    });

    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      simulateUpload(acceptedFiles[0]);
    }
  }, [onFileUpload, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  const removeFile = () => {
    onFileUpload(null);
    setUploadProgress(0);
    setUploadComplete(false);
  };

  if (uploadedFile && uploadComplete) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  {uploadedFile.name}
                  <span className="text-green-600 text-sm">✓ 上傳完成</span>
                </h3>
                <p className="text-sm text-gray-500">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={removeFile}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4 mr-1" />
              移除
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isUploading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">正在上傳...</h3>
                <p className="text-sm text-gray-500">請稍候</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>上傳進度</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-blue-100 p-4 rounded-full">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive ? '放開以上傳檔案' : '上傳 PDF 教材'}
              </h3>
              <p className="text-gray-500 mb-4">
                拖放 PDF 檔案到此處，或點擊選擇檔案
              </p>
              <p className="text-sm text-gray-400">
                支援格式：PDF，檔案大小限制：50MB
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
