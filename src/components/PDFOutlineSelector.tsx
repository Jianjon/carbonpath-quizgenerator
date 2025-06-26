
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

// 設定 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.js';

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
  const [extractionMethod, setExtractionMethod] = useState<'built-in' | 'ai-generated' | 'failed'>('built-in');

  // 提取 PDF 內建大綱
  const extractBuiltInOutline = async (pdf: any): Promise<OutlineItem[]> => {
    try {
      console.log('嘗試提取 PDF 內建大綱...');
      const outline = await pdf.getOutline();
      
      if (!outline || outline.length === 0) {
        console.log('PDF 沒有內建大綱');
        return [];
      }

      const processOutlineItem = async (item: any, level: number = 1): Promise<OutlineItem> => {
        let pageNum: number | undefined;
        
        try {
          if (item.dest) {
            const dest = await pdf.getDestination(item.dest);
            if (dest && dest[0]) {
              const pageRef = dest[0];
              pageNum = await pdf.getPageIndex(pageRef) + 1;
            }
          }
        } catch (error) {
          console.warn('無法取得頁碼:', error);
        }

        const processedItem: OutlineItem = {
          title: item.title || '未命名章節',
          level,
          pageNum
        };

        if (item.items && item.items.length > 0) {
          processedItem.children = await Promise.all(
            item.items.map((child: any) => processOutlineItem(child, level + 1))
          );
        }

        return processedItem;
      };

      const processedOutline = await Promise.all(
        outline.map((item: any) => processOutlineItem(item))
      );

      console.log('成功提取內建大綱:', processedOutline);
      return processedOutline;
    } catch (error) {
      console.error('提取內建大綱失敗:', error);
      return [];
    }
  };

  // 使用 AI 分析 PDF 內容生成大綱
  const generateOutlineWithAI = async (textContent: string) => {
    try {
      console.log('使用 AI 分析 PDF 內容生成大綱...');
      
      const systemPrompt = `你是一位專業的教育內容分析專家。請根據提供的 PDF 文字內容，分析並生成 3-10 個主要的學習主題大綱。

重要要求：
1. 必須完全基於提供的PDF內容，不可以憑空創造主題
2. 每個主題應該對應文件中實際存在的章節或概念
3. 主題名稱要清晰明確，適合作為出題範圍
4. 請按文件中出現的順序或重要性排序
5. 只回傳 JSON 陣列格式，不要有其他說明

回傳格式：
[
  {"title": "基於實際內容的主題1", "level": 1},
  {"title": "基於實際內容的主題2", "level": 1},
  {"title": "基於實際內容的主題3", "level": 1}
]`;

      const userPrompt = `請分析以下 PDF 內容並生成主要學習主題，必須完全基於實際內容：\n\n${textContent}`;

      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          systemPrompt,
          userPrompt,
          model: 'gpt-4o-mini'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const outlineText = response.data?.generatedText;
      if (!outlineText) {
        throw new Error('AI 未返回大綱內容');
      }

      const generatedOutline = JSON.parse(outlineText);
      console.log('AI 生成的大綱:', generatedOutline);
      
      return Array.isArray(generatedOutline) ? generatedOutline : [];
    } catch (error) {
      console.error('AI 生成大綱失敗:', error);
      return [];
    }
  };

  // 提取 PDF 文字內容（前面幾頁）
  const extractPDFText = async (pdf: any): Promise<string> => {
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 5); // 只處理前5頁以獲取更完整的內容
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `第${pageNum}頁內容：\n${pageText}\n\n`;
      } catch (pageError) {
        console.warn(`無法提取第 ${pageNum} 頁文字:`, pageError);
      }
    }
    
    return fullText;
  };

  // 解析 PDF 內容
  const extractPDFContent = async (file: File) => {
    try {
      console.log('開始解析 PDF 文件:', file.name);
      setLoading(true);
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: false,
        isEvalSupported: false
      }).promise;
      
      console.log('PDF 載入成功，頁數:', pdf.numPages);
      
      // 第一階段：嘗試提取內建大綱
      const builtInOutline = await extractBuiltInOutline(pdf);
      
      if (builtInOutline.length > 0) {
        setOutline(builtInOutline);
        setExtractionMethod('built-in');
        toast({
          title: "大綱提取成功",
          description: `已從 PDF 提取 ${builtInOutline.length} 個章節大綱`,
        });
        return;
      }
      
      // 第二階段：使用 AI 分析內容生成大綱
      console.log('內建大綱不存在，開始提取文字內容...');
      const textContent = await extractPDFText(pdf);
      
      if (textContent.trim().length > 200) {
        const aiOutline = await generateOutlineWithAI(textContent);
        
        if (aiOutline.length > 0) {
          setOutline(aiOutline);
          setExtractionMethod('ai-generated');
          toast({
            title: "AI 大綱生成成功",
            description: `AI 已根據 PDF 內容生成 ${aiOutline.length} 個學習主題`,
          });
        } else {
          throw new Error('AI 無法從 PDF 內容生成有效大綱');
        }
      } else {
        throw new Error('PDF 文字內容過少，無法生成有意義的大綱');
      }
      
    } catch (error) {
      console.error('PDF 解析錯誤:', error);
      
      setOutline([]);
      setExtractionMethod('failed');
      
      toast({
        title: "PDF 大綱提取失敗",
        description: "無法提取或生成 PDF 大綱，請手動輸入章節名稱進行出題",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
          {extractionMethod === 'built-in' && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">PDF大綱</span>
          )}
          {extractionMethod === 'ai-generated' && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">AI生成</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">
                {extractionMethod === 'built-in' ? 
                  '正在提取 PDF 內建大綱...' : 
                  'AI 正在分析 PDF 內容並生成學習大綱...'
                }
              </p>
            </div>
          </div>
        ) : outline.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              {extractionMethod === 'built-in' 
                ? '已提取 PDF 內建大綱，請選擇要出題的範圍：'
                : 'AI 已根據 PDF 內容生成以下學習主題，請選擇要出題的範圍：'
              }
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
            <p className="text-sm text-gray-600">
              無法提取或生成 PDF 大綱
              <br />
              <span className="text-xs">請手動輸入章節名稱進行出題</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
