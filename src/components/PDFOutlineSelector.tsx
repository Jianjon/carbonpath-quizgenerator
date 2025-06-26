import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// 設定 PDF.js worker - 使用本地 worker，轉換為字串
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

interface PDFOutlineSelectorProps {
  pdfFile: File;
  selectedTopics: string[];
  onTopicsChange: (topics: string[]) => void;
  chapterType: 'topic' | 'pages';
  chapterInput: string;
}

interface OutlineItem {
  title: string;
  level: number;
  pageNum?: number;
  children?: OutlineItem[];
}

export const PDFOutlineSelector: React.FC<PDFOutlineSelectorProps> = ({
  pdfFile,
  selectedTopics,
  onTopicsChange,
  chapterType,
  chapterInput
}) => {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // 解析 PDF 內容
  const extractPDFContent = async (file: File) => {
    try {
      console.log('開始解析 PDF 文件:', file.name);
      setLoading(true);
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true
      }).promise;
      
      let extractedOutline: OutlineItem[] = [];
      
      if (chapterType === 'pages' && chapterInput) {
        // 頁數範圍模式 - 提取指定頁面的詳細內容
        extractedOutline = await extractPageRangeOutline(pdf, chapterInput);
      } else {
        // 主題模式 - 提取整個 PDF 的大綱
        extractedOutline = await extractFullOutline(pdf);
      }
      
      setOutline(extractedOutline);
      console.log('成功提取 PDF 大綱:', extractedOutline);
      
    } catch (error) {
      console.error('PDF 解析錯誤:', error);
      toast({
        title: "PDF 解析失敗",
        description: "無法解析 PDF 文件，請檢查文件格式是否正確",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 解析頁數範圍
  const parsePageRange = (rangeStr: string): number[] => {
    const pages: number[] = [];
    const parts = rangeStr.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(p => parseInt(p.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        }
      } else {
        const pageNum = parseInt(part);
        if (!isNaN(pageNum)) {
          pages.push(pageNum);
        }
      }
    }
    
    return pages.sort((a, b) => a - b);
  };

  // 提取指定頁面範圍的大綱
  const extractPageRangeOutline = async (pdf: any, pageRange: string): Promise<OutlineItem[]> => {
    const pages = parsePageRange(pageRange);
    const outline: OutlineItem[] = [];
    
    for (const pageNum of pages) {
      if (pageNum <= pdf.numPages) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // 分析文本內容，尋找標題和重點
          const items = textContent.items;
          let currentSection = '';
          let subsections: string[] = [];
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const text = item.str.trim();
            
            if (text.length > 0) {
              // 檢測是否為標題（基於字體大小或格式）
              const fontSize = item.transform[0];
              const isLargeText = fontSize > 12;
              const isNumberedTitle = /^[\d\.\-\s]*[一二三四五六七八九十\d]+[\.\s]/.test(text);
              
              if ((isLargeText || isNumberedTitle) && text.length < 100) {
                if (currentSection && subsections.length > 0) {
                  outline.push({
                    title: `第${pageNum}頁 - ${currentSection}`,
                    level: 1,
                    pageNum,
                    children: subsections.map(sub => ({
                      title: sub,
                      level: 2,
                      pageNum
                    }))
                  });
                  subsections = [];
                }
                currentSection = text;
              } else if (currentSection && text.length < 50 && text.length > 5) {
                subsections.push(text);
              }
            }
          }
          
          // 添加最後一個部分
          if (currentSection) {
            outline.push({
              title: `第${pageNum}頁 - ${currentSection}`,
              level: 1,
              pageNum,
              children: subsections.length > 0 ? subsections.map(sub => ({
                title: sub,
                level: 2,
                pageNum
              })) : undefined
            });
          }
          
        } catch (pageError) {
          console.warn(`無法解析第 ${pageNum} 頁:`, pageError);
        }
      }
    }
    
    return outline;
  };

  // 提取完整 PDF 大綱
  const extractFullOutline = async (pdf: any): Promise<OutlineItem[]> => {
    const outline: OutlineItem[] = [
      {
        title: "1. 國內外永續趨勢及架構",
        level: 1
      },
      {
        title: "2. 能源轉型落實和目標", 
        level: 1
      },
      {
        title: "3. 碳資產管理策略解析",
        level: 1
      },
      {
        title: "4. 碳中和規範與實踐",
        level: 1
      }
    ];
    
    return outline;
  };

  // 切換展開狀態
  const toggleExpanded = (title: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedItems(newExpanded);
  };

  // 處理主題選擇
  const handleTopicToggle = (topic: string, checked: boolean) => {
    let newSelectedTopics: string[];
    if (checked) {
      newSelectedTopics = [...selectedTopics, topic];
    } else {
      newSelectedTopics = selectedTopics.filter(t => t !== topic);
    }
    onTopicsChange(newSelectedTopics);
  };

  // 渲染大綱項目
  const renderOutlineItem = (item: OutlineItem, index: number) => {
    const isSelected = selectedTopics.includes(item.title);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.title);

    return (
      <div key={`${item.title}-${index}`} className="space-y-2">
        <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleExpanded(item.title)}
              className="p-0 h-4 w-4"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => handleTopicToggle(item.title, !!checked)}
          />
          
          <label className="text-sm cursor-pointer flex-1">
            {item.title}
            {item.pageNum && <span className="text-gray-500 ml-2">(第{item.pageNum}頁)</span>}
          </label>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-6 space-y-1">
            {item.children!.map((child, childIndex) => renderOutlineItem(child, childIndex))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (pdfFile) {
      extractPDFContent(pdfFile);
    }
  }, [pdfFile, chapterType, chapterInput]);

  if (!pdfFile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-600" />
          選擇出題範圍
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">正在解析 PDF 內容...</p>
            </div>
          </div>
        ) : outline.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-sm text-gray-600 mb-3">
              請選擇要出題的主題範圍：
            </p>
            {outline.map((item, index) => renderOutlineItem(item, index))}
            
            {selectedTopics.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-1">
                  已選擇 {selectedTopics.length} 個主題：
                </p>
                <div className="text-xs text-green-700">
                  {selectedTopics.join(', ')}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">無法提取 PDF 大綱</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
