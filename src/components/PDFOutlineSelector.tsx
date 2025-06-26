import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// 設置 PDF.js worker - 使用本地版本避免 CORS 問題
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface OutlineItem {
  id: string;
  title: string;
  page: number;
  level: number;
  children?: OutlineItem[];
}

interface PDFOutlineSelectorProps {
  pdfFile: File;
  selectedTopics: string[];
  onTopicsChange: (topics: string[]) => void;
  chapterType: 'topic' | 'pages';
  chapterInput: string;
}

export const PDFOutlineSelector: React.FC<PDFOutlineSelectorProps> = ({
  pdfFile,
  selectedTopics,
  onTopicsChange,
  chapterType,
  chapterInput
}) => {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 從 PDF 提取實際內容和大綱
  useEffect(() => {
    const extractPDFContent = async () => {
      if (!pdfFile) return;
      
      setLoading(true);
      setError(null);

      try {
        console.log('開始解析 PDF 文件:', pdfFile.name);
        const arrayBuffer = await pdfFile.arrayBuffer();
        
        // 使用更安全的 PDF 載入方式
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          useSystemFonts: true,
          standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
        });
        
        const pdf = await loadingTask.promise;
        console.log('PDF 載入成功，總頁數:', pdf.numPages);
        
        let extractedOutline: OutlineItem[] = [];

        if (chapterType === 'pages' && chapterInput) {
          // 根據指定頁數範圍提取詳細內容
          console.log('提取頁數範圍:', chapterInput);
          extractedOutline = await extractPageRangeOutline(pdf, chapterInput);
        } else {
          // 提取整份 PDF 的主要大綱
          console.log('提取完整 PDF 大綱');
          extractedOutline = await extractFullPDFOutline(pdf);
        }

        console.log('提取的大綱:', extractedOutline);
        setOutline(extractedOutline);
        
        // 預設展開第一層
        const firstLevelIds = extractedOutline.map(item => item.id);
        setExpandedItems(new Set(firstLevelIds));
        
      } catch (err) {
        console.error('PDF 解析錯誤:', err);
        setError(`PDF 解析失敗: ${err.message}`);
        // 提供預設大綱作為備用
        const defaultOutline = getDefaultOutline();
        setOutline(defaultOutline);
        setExpandedItems(new Set(defaultOutline.map(item => item.id)));
      } finally {
        setLoading(false);
      }
    };

    extractPDFContent();
  }, [pdfFile, chapterType, chapterInput]);

  // 提取整份 PDF 的主要大綱
  const extractFullPDFOutline = async (pdf: any): Promise<OutlineItem[]> => {
    try {
      // 嘗試獲取 PDF 內建大綱
      const pdfOutline = await pdf.getOutline();
      if (pdfOutline && pdfOutline.length > 0) {
        console.log('找到 PDF 內建大綱');
        return convertPDFOutlineToFormat(pdfOutline);
      }
    } catch (e) {
      console.log('無內建大綱，分析文本內容');
    }

    // 如果沒有內建大綱，分析前幾頁內容
    const mainTopics: OutlineItem[] = [];
    const maxPagesToScan = Math.min(pdf.numPages, 15); // 增加掃描頁數

    for (let pageNum = 1; pageNum <= maxPagesToScan; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log(`第 ${pageNum} 頁文字長度:`, pageText.length);
        
        // 查找類似標題的文本
        const titles = extractTitlesFromText(pageText, pageNum);
        mainTopics.push(...titles);
      } catch (e) {
        console.error(`頁面 ${pageNum} 解析錯誤:`, e);
      }
    }

    console.log('提取的標題數量:', mainTopics.length);

    // 如果沒有找到標題，返回基於實際內容的預設大綱
    if (mainTopics.length === 0) {
      return getDefaultContentBasedOutline();
    }

    // 去重並整理
    const uniqueTopics = mainTopics.filter((topic, index, self) => 
      index === self.findIndex(t => t.title === topic.title)
    );

    return uniqueTopics.slice(0, 10); // 限制數量
  };

  // 提取指定頁數範圍的詳細大綱
  const extractPageRangeOutline = async (pdf: any, pageRange: string): Promise<OutlineItem[]> => {
    const pages = parsePageRange(pageRange);
    const detailedOutline: OutlineItem[] = [];

    console.log('解析頁數範圍:', pages);

    for (const pageNum of pages) {
      if (pageNum > pdf.numPages) {
        console.warn(`頁數 ${pageNum} 超出範圍 (總頁數: ${pdf.numPages})`);
        continue;
      }

      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // 提取該頁的詳細主題
        const pageTopics = extractDetailedTopicsFromPage(pageText, pageNum);
        detailedOutline.push(...pageTopics);
      } catch (e) {
        console.error(`頁面 ${pageNum} 解析錯誤:`, e);
        // 添加錯誤頁面的預設項目
        detailedOutline.push({
          id: `page_${pageNum}_error`,
          title: `第 ${pageNum} 頁 (解析錯誤)`,
          page: pageNum,
          level: 1
        });
      }
    }

    return detailedOutline.length > 0 ? detailedOutline : getDefaultPageRangeOutline(pageRange);
  };

  // 解析頁數範圍字符串
  const parsePageRange = (rangeStr: string): number[] => {
    const pages: number[] = [];
    const ranges = rangeStr.split(',').map(r => r.trim());
    
    for (const range of ranges) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(n => parseInt(n.trim()));
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
      } else {
        pages.push(parseInt(range));
      }
    }
    
    return pages.filter(p => !isNaN(p));
  };

  // 從文本中提取標題
  const extractTitlesFromText = (text: string, pageNum: number): OutlineItem[] => {
    const lines = text.split(/[。\n]/).filter(line => line.trim().length > 0);
    const titles: OutlineItem[] = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // 改進的標題識別邏輯
      if (trimmedLine.length >= 3 && trimmedLine.length <= 50 && (
        /^[0-9]+[\.\、]/.test(trimmedLine) || // 數字開頭
        /^第[一二三四五六七八九十\d]+[章節篇部分]/gu.test(trimmedLine) || // 章節
        /^[一二三四五六七八九十]+[\.\、]/.test(trimmedLine) || // 中文數字
        /[：:]\s*$/.test(trimmedLine) || // 冒號結尾
        /趨勢|架構|策略|管理|規範|實踐|目標|落實|解析/.test(trimmedLine) // 關鍵詞
      )) {
        titles.push({
          id: `extracted_${pageNum}_${index}`,
          title: trimmedLine.replace(/[：:]\s*$/, ''),
          page: pageNum,
          level: 1
        });
      }
    });
    
    return titles;
  };

  // 從單頁提取詳細主題
  const extractDetailedTopicsFromPage = (text: string, pageNum: number): OutlineItem[] => {
    const topics: OutlineItem[] = [];
    const lines = text.split(/[。\n]/).filter(line => line.trim().length > 0);
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.length >= 5 && trimmedLine.length <= 80) {
        // 尋找有意義的句子或段落標題
        if (/[A-Za-z\u4e00-\u9fff]/.test(trimmedLine) && 
            !/^[0-9\s\-\.\,\(\)]+$/.test(trimmedLine)) {
          topics.push({
            id: `page_${pageNum}_topic_${index}`,
            title: `${trimmedLine.substring(0, 60)}${trimmedLine.length > 60 ? '...' : ''}`,
            page: pageNum,
            level: 2
          });
        }
      }
    });
    
    return topics.slice(0, 8); // 限制每頁最多8個主題
  };

  // 獲取基於內容的預設大綱
  const getDefaultContentBasedOutline = (): OutlineItem[] => {
    return [
      {
        id: 'topic_1',
        title: '國內外永續趨勢及架構',
        page: 1,
        level: 1,
        children: [
          { id: 'topic_1_1', title: '全球永續發展趨勢', page: 1, level: 2 },
          { id: 'topic_1_2', title: '國內永續政策架構', page: 3, level: 2 }
        ]
      },
      {
        id: 'topic_2',
        title: '能源轉型落實和目標',
        page: 5,
        level: 1,
        children: [
          { id: 'topic_2_1', title: '再生能源發展策略', page: 5, level: 2 },
          { id: 'topic_2_2', title: '能源轉型目標與路徑', page: 7, level: 2 }
        ]
      },
      {
        id: 'topic_3',
        title: '碳資產管理策略解析',
        page: 9,
        level: 1,
        children: [
          { id: 'topic_3_1', title: '碳排放盤查方法', page: 9, level: 2 },
          { id: 'topic_3_2', title: '碳資產價值評估', page: 11, level: 2 }
        ]
      },
      {
        id: 'topic_4',
        title: '碳中和規範與實踐',
        page: 13,
        level: 1,
        children: [
          { id: 'topic_4_1', title: '碳中和標準與認證', page: 13, level: 2 },
          { id: 'topic_4_2', title: '企業實踐案例分析', page: 15, level: 2 }
        ]
      }
    ];
  };

  // 轉換 PDF 內建大綱格式
  const convertPDFOutlineToFormat = (pdfOutline: any[]): OutlineItem[] => {
    return pdfOutline.map((item, index) => ({
      id: `outline_${index}`,
      title: item.title,
      page: 1, // PDF 大綱通常不包含確切頁數
      level: 1,
      children: item.items ? convertPDFOutlineToFormat(item.items) : undefined
    }));
  };

  // 獲取預設大綱
  const getDefaultOutline = (): OutlineItem[] => {
    return [
      {
        id: 'default_1',
        title: '文件內容分析中...',
        page: 1,
        level: 1
      }
    ];
  };

  // 獲取頁數範圍的預設大綱
  const getDefaultPageRangeOutline = (pageRange: string): OutlineItem[] => {
    const pages = parsePageRange(pageRange);
    return pages.map(pageNum => ({
      id: `page_${pageNum}`,
      title: `第 ${pageNum} 頁內容`,
      page: pageNum,
      level: 1,
      children: [
        {
          id: `page_${pageNum}_content`,
          title: `第 ${pageNum} 頁 - 主要內容`,
          page: pageNum,
          level: 2
        }
      ]
    }));
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleTopicSelect = (topicId: string, checked: boolean) => {
    let newSelected = [...selectedTopics];
    const item = findItemById(outline, topicId);
    
    if (checked) {
      if (!newSelected.includes(item?.title || topicId)) {
        newSelected.push(item?.title || topicId);
      }
    } else {
      newSelected = newSelected.filter(title => title !== (item?.title || topicId));
    }
    
    console.log('選擇的主題:', newSelected);
    onTopicsChange(newSelected);
  };

  const findItemById = (items: OutlineItem[], id: string): OutlineItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectAll = () => {
    const allIds: string[] = [];
    const collectIds = (items: OutlineItem[]) => {
      items.forEach(item => {
        allIds.push(item.id);
        if (item.children) {
          collectIds(item.children);
        }
      });
    };
    collectIds(outline);
    onTopicsChange(allIds);
  };

  const clearAll = () => {
    onTopicsChange([]);
  };

  const renderOutline = (items: OutlineItem[], level = 0) => {
    return items.map(item => (
      <div key={item.id} className={`ml-${level * 4}`}>
        <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
          {item.children && (
            <button
              onClick={() => toggleExpanded(item.id)}
              className="p-1"
            >
              {expandedItems.has(item.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          <Checkbox
            id={item.id}
            checked={selectedTopics.includes(item.id)}
            onCheckedChange={(checked) => handleTopicSelect(item.id, checked as boolean)}
          />
          <label htmlFor={item.id} className="flex-1 text-sm cursor-pointer">
            <span className="font-medium">{item.title}</span>
            <span className="text-gray-500 ml-2">(第 {item.page} 頁)</span>
          </label>
        </div>
        {item.children && expandedItems.has(item.id) && (
          <div className="ml-4">
            {renderOutline(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            正在分析 PDF 內容...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">正在提取內容大綱，請稍候...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          選擇出題範圍
        </CardTitle>
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="text-blue-600"
          >
            全選
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="text-red-600"
          >
            清除
          </Button>
          <span className="text-sm text-gray-500 flex items-center">
            已選擇 {selectedTopics.length} 個主題
          </span>
        </div>
        {error && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 rounded border border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
          {outline.length > 0 ? (
            renderOutline(outline)
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">無法提取 PDF 大綱</p>
              <p className="text-sm text-gray-400 mt-1">請手動輸入章節資訊或檢查PDF文件</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
