
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Key, Save } from 'lucide-react';

interface APIKeySettingsProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export const APIKeySettings: React.FC<APIKeySettingsProps> = ({ 
  apiKey, 
  onApiKeyChange 
}) => {
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  const handleSave = () => {
    onApiKeyChange(tempKey);
    // 儲存到 localStorage
    localStorage.setItem('openai_api_key', tempKey);
    alert('API 密鑰已儲存');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Key className="h-5 w-5 text-blue-600" />
          OpenAI API 設定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="apiKey">API 密鑰</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder="sk-..."
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-1" />
              儲存
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            從 OpenAI 官網取得您的 API 密鑰，用於 AI 題目生成
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
