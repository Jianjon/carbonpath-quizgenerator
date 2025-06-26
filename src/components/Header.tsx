import React from 'react';
import { BookOpen, Settings } from 'lucide-react';
export const Header = () => {
  return <header className="bg-white/80 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <img alt="CarbonPath Logo" className="h-8 w-auto object-fill" src="/lovable-uploads/784635e8-9af2-4f52-9eda-11fa4548d49e.png" />
            </div>
            <div>
              
              <p className="text-sm text-gray-600">專為講師設計的智能出題工具</p>
            </div>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">設定</span>
          </button>
        </div>
      </div>
    </header>;
};