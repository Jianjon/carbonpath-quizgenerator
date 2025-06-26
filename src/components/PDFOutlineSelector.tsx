
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';

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

  // 模擬從 PDF 提取大綱
  useEffect(() => {
    const generateOutline = () => {
      setLoading(true);
      
      // 模擬根據章節類型和輸入生成大綱
      let mockOutline: OutlineItem[] = [];
      
      if (chapterType === 'pages' && chapterInput) {
        // 根據頁數範圍生成主題
        const pages = chapterInput.split(',').map(p => p.trim());
        mockOutline = pages.map((pageRange, index) => ({
          id: `page_${index}`,
          title: `第 ${pageRange} 頁內容`,
          page: parseInt(pageRange.split('-')[0]) || index + 1,
          level: 1,
          children: [
            {
              id: `page_${index}_1`,
              title: `${pageRange} 頁 - 主要概念`,
              page: parseInt(pageRange.split('-')[0]) || index + 1,
              level: 2
            },
            {
              id: `page_${index}_2`,
              title: `${pageRange} 頁 - 實例分析`,
              page: parseInt(pageRange.split('-')[0]) || index + 1,
              level: 2
            }
          ]
        }));
      } else if (chapterType === 'topic' && chapterInput) {
        // 根據主題生成相關子主題
        mockOutline = [
          {
            id: 'main_topic',
            title: chapterInput,
            page: 1,
            level: 1,
            children: [
              {
                id: 'subtopic_1',
                title: `${chapterInput} - 基礎理論`,
                page: 1,
                level: 2
              },
              {
                id: 'subtopic_2',
                title: `${chapterInput} - 應用實例`,
                page: 3,
                level: 2
              },
              {
                id: 'subtopic_3',
                title: `${chapterInput} - 進階概念`,
                page: 5,
                level: 2
              }
            ]
          }
        ];
      } else {
        // 默認 PDF 大綱（當沒有指定範圍時）
        mockOutline = [
          {
            id: '1',
            title: '第一章 - 基礎概念',
            page: 1,
            level: 1,
            children: [
              { id: '1.1', title: '1.1 基本定義', page: 2, level: 2 },
              { id: '1.2', title: '1.2 核心原理', page: 5, level: 2 },
              { id: '1.3', title: '1.3 應用領域', page: 8, level: 2 }
            ]
          },
          {
            id: '2',
            title: '第二章 - 進階應用',
            page: 12,
            level: 1,
            children: [
              { id: '2.1', title: '2.1 實踐方法', page: 13, level: 2 },
              { id: '2.2', title: '2.2 案例分析', page: 16, level: 2 },
              { id: '2.3', title: '2.3 最佳實務', page: 20, level: 2 }
            ]
          },
          {
            id: '3',
            title: '第三章 - 未來發展',
            page: 25,
            level: 1,
            children: [
              { id: '3.1', title: '3.1 趨勢分析', page: 26, level: 2 },
              { id: '3.2', title: '3.2 技術展望', page: 29, level: 2 }
            ]
          }
        ];
      }
      
      setTimeout(() => {
        setOutline(mockOutline);
        setLoading(false);
      }, 1000);
    };

    if (pdfFile) {
      generateOutline();
    }
  }, [pdfFile, chapterType, chapterInput]);

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
    if (checked) {
      if (!newSelected.includes(topicId)) {
        newSelected.push(topicId);
      }
    } else {
      newSelected = newSelected.filter(id => id !== topicId);
    }
    onTopicsChange(newSelected);
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
            分析 PDF 內容中...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">正在提取內容大綱...</span>
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
        <div className="flex gap-2">
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
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto border rounded-lg p-4">
          {outline.length > 0 ? (
            renderOutline(outline)
          ) : (
            <p className="text-gray-500 text-center py-4">
              無法提取 PDF 大綱，請手動輸入章節資訊
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
