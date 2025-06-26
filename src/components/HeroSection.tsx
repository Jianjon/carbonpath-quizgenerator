
import React from 'react';

export const HeroSection = () => {
  return (
    <section className="text-center py-12 mb-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          智能題庫生成
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {" "}輕鬆出題
          </span>
        </h2>
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          上傳 PDF 教材，設定章節難度，讓 AI 為您自動生成專業題庫。<br />
          支援多種題型，格式一致，解析詳盡，提升教學效率。
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">PDF 智能解析</span>
          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">多難度選擇</span>
          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">格式統一</span>
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">雲端儲存</span>
        </div>
      </div>
    </section>
  );
};
