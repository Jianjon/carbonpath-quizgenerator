
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, AlertTriangle, Mail, User } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="mt-16 bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            關於本站與聯絡方式
          </h2>
          <p className="text-center text-gray-600 mb-8">
            本站旨在提供一個學習永續發展的模擬平台，所有數據與分析僅供教學參考。
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* 網站初衷 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="h-5 w-5 text-blue-600" />
                  網站初衷
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  建立這個網站的初衷，是希望提供一個簡單易用的平台，幫助企業與個人更好地理解與實踐永續發展及減碳策略。透過互動式工具與模擬，讓複雜的永續概念變得平易近人。
                </p>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>使用提示：</strong>若教材上傳的內容不變，可以調整參數繼續生成題目，直到用戶上傳新的教材。
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 重要聲明 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  重要聲明
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  請注意：本網站所有數據與分析結果均為模擬情境，僅供學習與理解原理之用，不構成任何實際的投資或決策建議。
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 聯絡資訊 */}
          <div className="mt-8 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">聯絡我</h3>
            <div className="flex justify-center items-center space-x-8">
              <div className="text-center">
                <div className="bg-white p-3 rounded-lg shadow-sm inline-block mb-2">
                  <img 
                    src="/lovable-uploads/18d2edfe-19ec-4ac0-95e1-d7af98bf3416.png" 
                    alt="聯絡方式 QR Code" 
                    className="w-24 h-24 object-contain"
                  />
                </div>
              </div>
              <div className="text-left space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="h-4 w-4" />
                  <span>Jon Chang</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="h-4 w-4" />
                  <span>jonchang1980@gmail.com</span>
                </div>
                <p className="text-xs text-gray-500">
                  （掃描QR Code或發送Email聯絡我們）
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
