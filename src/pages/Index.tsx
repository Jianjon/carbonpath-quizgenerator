
import React from 'react';
import { QuestionBankGenerator } from '@/components/QuestionBankGenerator';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-blue-100">
      {/* 統一的 Header */}
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* 頁面標題 - 調整為與 CarbonPath 一致的風格 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI 題庫生成工作台
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            專為講師設計的智能出題平台，支援 PDF 教材上傳、參數化設定、樣題參考與權重分配
          </p>
        </div>
        
        {/* 主要工作區 */}
        <QuestionBankGenerator />
      </div>
      
      {/* 頁面底部介紹 */}
      <Footer />
    </div>
  );
};

export default Index;
