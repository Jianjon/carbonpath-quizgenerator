
import * as pdfjsLib from 'pdfjs-dist';

// 使用穩定的CDN worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.js';

// 最簡化的PDF內容提取 - 讀取整份PDF
export const extractPDFContent = async (
  file: File,
  setGenerationStep: (step: string) => void,
  setGenerationProgress: (progress: number) => void
): Promise<string> => {
  console.log('📖 開始讀取整份PDF...');
  setGenerationStep('📖 載入PDF檔案...');
  setGenerationProgress(10);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    setGenerationStep('🔧 初始化PDF...');
    setGenerationProgress(25);
    
    // 載入PDF文件
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    console.log('✅ PDF載入成功，總頁數:', pdf.numPages);
    
    let content = '';
    const totalPages = Math.min(pdf.numPages, 10); // 最多處理10頁避免超時
    
    setGenerationStep('📄 提取內容中...');
    
    // 逐頁提取內容
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        
        if (pageText.length > 10) {
          content += `${pageText}\n\n`;
        }
        
        const progress = 25 + (pageNum / totalPages) * 50;
        setGenerationProgress(progress);
        
      } catch (error) {
        console.warn(`跳過第 ${pageNum} 頁:`, error);
      }
    }
    
    if (content.length < 50) {
      throw new Error('PDF內容太少或無法讀取，請確認是文字版PDF');
    }
    
    setGenerationStep('✅ PDF內容提取完成');
    setGenerationProgress(75);
    
    console.log('📄 提取的內容長度:', content.length);
    return content;
    
  } catch (error) {
    console.error('❌ PDF處理失敗:', error);
    throw new Error(`PDF處理失敗: ${error.message}`);
  }
};
