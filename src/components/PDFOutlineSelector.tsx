
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

// 設定 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js';

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

  // 使用 AI 生成 PDF 大綱
  const generateOutlineWithAI = async (textContent: string) => {
    try {
      console.log('使用 AI 生成 PDF 大綱...');
      
      const systemPrompt = `你是一位專業的教育內容分析專家。請根據提供的 PDF 文字內容，生成 3-10 個主要的學習主題大綱。

要求：
1. 每個主題應該涵蓋文件中的重要概念
2. 主題名稱要清晰明確，適合作為出題範圍
3. 請按重要性排序
4. 只回傳 JSON 陣列格式，不要有其他說明

回傳格式：
[
  {"title": "主題1名稱", "level": 1},
  {"title": "主題2名稱", "level": 1},
  {"title": "主題3名稱", "level": 1}
]`;

      const userPrompt = `請分析以下 PDF 內容並生成主要學習主題：\n\n${textContent.substring(0, 3000)}...`;

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

  // 提取 PDF 文字內容
  const extractPDFText = async (pdf: any): Promise<string> => {
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 10); // 只處理前10頁以避免過長
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
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
      
      // 提取文字內容
      const textContent = await extractPDFText(pdf);
      
      if (textContent.trim().length > 100) {
        // 使用 AI 生成大綱
        const aiOutline = await generateOutlineWithAI(textContent);
        
        if (aiOutline.length > 0) {
          setOutline(aiOutline);
          toast({
            title: "大綱生成成功",
            description: `AI 已為您生成 ${aiOutline.length} 個學習主題`,
          });
        } else {
          // AI 生成失敗時的備用大綱
          setOutline([
            { title: "核心概念與基礎理論", level: 1 },
            { title: "實務應用與案例分析", level: 1 },
            { title: "相關法規與標準", level: 1 },
            { title: "發展趨勢與未來展望", level: 1 }
          ]);
          toast({
            title: "使用預設大綱",
            description: "已為您提供通用的學習主題大綱",
          });
        }
      } else {
        throw new Error('PDF 文字內容過少，無法生成有意義的大綱');
      }
      
    } catch (error) {
      console.error('PDF 解析錯誤:', error);
      
      // 提供備用大綱
      setOutline([
        { title: "第一章：基礎概念", level: 1 },
        { title: "第二章：核心理論", level: 1 },
        { title: "第三章：實務應用", level: 1 },
        { title: "第四章：案例研究", level: 1 }
      ]);
      
      toast({
        title: "PDF 解析失敗",
        description: "已為您提供預設的學習主題，您仍可以選擇進行出題",
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">AI 正在分析 PDF 內容並生成學習大綱...</p>
            </div>
          </div>
        ) : outline.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-3">
              AI 已為您分析並生成以下學習主題，請選擇要出題的範圍：
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
              無法生成學習大綱
              <br />
              <span className="text-xs">請手動輸入章節名稱進行出題</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
