
import * as pdfjsLib from 'pdfjs-dist';

// 使用本地 worker 文件
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export interface PDFProcessResult {
  content: string;
  pageCount: number;
  extractedPages: number;
  wordCount: number;
  isSuccess: boolean;
  error?: string;
}

// 增強的 PDF 內容提取
export const extractPDFContent = async (
  file: File,
  setGenerationStep: (step: string) => void,
  setGenerationProgress: (progress: number) => void
): Promise<PDFProcessResult> => {
  console.log('📖 開始解析 PDF 文件:', file.name);
  setGenerationStep('📖 載入 PDF 檔案...');
  setGenerationProgress(5);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    setGenerationStep('🔧 初始化 PDF 處理器...');
    setGenerationProgress(15);
    
    // 載入 PDF 文件
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: false,
      isEvalSupported: false,
      verbosity: 0 // 減少日誌輸出
    });
    
    const pdf = await loadingTask.promise;
    console.log('✅ PDF 載入成功，總頁數:', pdf.numPages);
    
    setGenerationStep('📄 提取文字內容...');
    setGenerationProgress(25);
    
    let content = '';
    const maxPages = Math.min(pdf.numPages, 10); // 限制最多處理 10 頁
    let successfulPages = 0;
    
    // 逐頁提取內容
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        console.log(`處理第 ${pageNum} 頁...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => {
            if (typeof item.str === 'string' && item.str.trim()) {
              return item.str;
            }
            return '';
          })
          .filter(text => text.length > 0)
          .join(' ')
          .trim();
        
        if (pageText.length > 20) { // 至少要有 20 個字符
          content += `第${pageNum}頁內容：\n${pageText}\n\n`;
          successfulPages++;
          console.log(`✅ 第 ${pageNum} 頁提取成功，字數: ${pageText.length}`);
        } else {
          console.warn(`⚠️ 第 ${pageNum} 頁內容過少或為空`);
        }
        
        const progress = 25 + (pageNum / maxPages) * 50;
        setGenerationProgress(progress);
        setGenerationStep(`📄 已處理 ${pageNum}/${maxPages} 頁`);
        
      } catch (pageError) {
        console.warn(`❌ 跳過第 ${pageNum} 頁，錯誤:`, pageError);
        continue;
      }
    }
    
    // 驗證提取結果
    const wordCount = content.replace(/\s+/g, ' ').split(' ').length;
    
    if (content.length < 100) {
      throw new Error('PDF 內容提取失敗：可能是加密文件、圖片型 PDF 或內容過少');
    }
    
    if (successfulPages === 0) {
      throw new Error('無法從任何頁面提取到有效內容');
    }
    
    setGenerationStep(`✅ 內容提取完成 (${successfulPages} 頁)`);
    setGenerationProgress(75);
    
    console.log('📊 提取統計:');
    console.log('- 總頁數:', pdf.numPages);
    console.log('- 處理頁數:', maxPages);
    console.log('- 成功頁數:', successfulPages);
    console.log('- 內容長度:', content.length);
    console.log('- 字數估計:', wordCount);
    
    return {
      content,
      pageCount: pdf.numPages,
      extractedPages: successfulPages,
      wordCount,
      isSuccess: true
    };
    
  } catch (error) {
    console.error('❌ PDF 處理失敗:', error);
    
    const result: PDFProcessResult = {
      content: '',
      pageCount: 0,
      extractedPages: 0,
      wordCount: 0,
      isSuccess: false,
      error: error.message
    };
    
    setGenerationStep('❌ PDF 處理失敗');
    setGenerationProgress(0);
    
    return result;
  }
};

// 提取 PDF 內容預覽（前 200 字）
export const extractPDFPreview = async (file: File): Promise<string> => {
  try {
    const result = await extractPDFContent(
      file, 
      () => {}, // 空的進度回調
      () => {}  // 空的步驟回調
    );
    
    if (result.isSuccess && result.content.length > 0) {
      return result.content.substring(0, 200) + '...';
    }
    
    return '無法預覽 PDF 內容';
  } catch (error) {
    return `預覽失敗: ${error.message}`;
  }
};
