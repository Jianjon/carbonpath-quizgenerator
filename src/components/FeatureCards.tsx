
import React from 'react';
import { Upload, BookOpen, Brain, Database } from 'lucide-react';

export const FeatureCards = () => {
  const features = [
    {
      icon: Upload,
      title: 'PDF 上傳',
      description: '支援多種 PDF 格式，智能提取教材內容',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: BookOpen,
      title: '章節設定',
      description: '靈活設定章節範圍與難度等級',
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      icon: Brain,
      title: 'AI 生成',
      description: '運用 OpenAI 技術，生成高品質題目',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: Database,
      title: '雲端儲存',
      description: '安全儲存在 Supabase，隨時存取',
      color: 'from-green-500 to-green-600'
    }
  ];

  return (
    <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      {features.map((feature, index) => (
        <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-gray-100">
          <div className={`bg-gradient-to-r ${feature.color} p-3 rounded-lg w-fit mb-4`}>
            <feature.icon className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
        </div>
      ))}
    </section>
  );
};
