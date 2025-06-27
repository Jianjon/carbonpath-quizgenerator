
import * as pdfjsLib from 'pdfjs-dist';

// 使用 CDN worker，更穩定
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.js';

// 極簡化的頁數解析
export const parsePageRange = (pageRange: string): number[] => {
  const pages: number[] = [];
  const parts = pageRange.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(p => parseInt(p.trim()));
      if (start && end && start <= end) {
        for (let i = start; i <= Math.min(end, start + 5); i++) { // 限制範圍
          pages.push(i);
        }
      }
    } else {
      const pageNum = parseInt(trimmed);
      if (pageNum > 0) {
        pages.push(pageNum);
      }
    }
  }
  
  return [...new Set(pages)].slice(0, 5); // 最多5頁
};

// 超簡化的 PDF 內容提取
export const extractPDFContent = async (
  file: File, 
  pageRange: string,
  setGenerationStep: (step: string) => void,
  setGenerationProgress: (progress: number) => void
): Promise<string> => {
  console.log('🔍 開始處理 PDF...');
  setGenerationStep('📖 讀取PDF檔案...');
  setGenerationProgress(10);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    setGenerationStep('🔧 載入PDF...');
    setGenerationProgress(20);
    
    // 最簡單的 PDF 載入
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    
    console.log('✅ PDF 載入成功，總頁數:', pdf.numPages);
    
    setGenerationStep('📄 解析頁數...');
    setGenerationProgress(30);
    
    const pages = parsePageRange(pageRange);
    
    if (pages.length === 0) {
      throw new Error('請輸入有效的頁數範圍，例如：1-3 或 1,2,3');
    }
    
    let content = '';
    
    setGenerationStep('📖 提取內容...');
    
    // 只處理前3頁，避免卡死
    const maxPages = Math.min(pages.length, 3);
    
    for (let i = 0; i < maxPages; i++) {
      const pageNum = pages[i];
      
      if (pageNum > pdf.numPages) {
        console.warn(`頁數 ${pageNum} 超出範圍`);
        continue;
      }
      
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        
        if (pageText.length > 10) {
          content += `第 ${pageNum} 頁：${pageText}\n\n`;
        }
      } catch (error) {
        console.warn(`跳過第 ${pageNum} 頁:`, error);
      }
      
      setGenerationProgress(30 + (i / maxPages) * 40);
    }
    
    if (content.length < 20) {
      throw new Error('PDF 內容太少，請確認是文字版 PDF');
    }
    
    setGenerationStep('✅ 內容提取完成');
    setGenerationProgress(70);
    
    return content;
    
  } catch (error) {
    console.error('PDF 處理錯誤:', error);
    throw new Error(`PDF 處理失敗: ${error.message}`);
  }
};
