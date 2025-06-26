
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Key, Save, CheckCircle } from 'lucide-react';

interface APIKeySettingsProps {
  apiKey: string;
  onApiKeyChange: (key: string) => Promise<void>;
}

export const APIKeySettings: React.FC<APIKeySettingsProps> = ({ 
  apiKey, 
  onApiKeyChange 
}) => {
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    setTempKey(apiKey);
  }, [apiKey]);

  const handleSave = async () => {
    if (!tempKey.trim()) {
      alert('請輸入 API 密鑰');
      return;
    }

    setIsSaving(true);
    try {
      await onApiKeyChange(tempKey);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      alert('儲存失敗，請重試');
    } finally {
      setIsSaving(false);
    }
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
            <Button 
              onClick={handleSave} 
              size="sm"
              disabled={isSaving || tempKey === apiKey}
              className={saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {saveSuccess ? (
                <CheckCircle className="h-4 w-4 mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {isSaving ? '儲存中...' : saveSuccess ? '已儲存' : '儲存'}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            從 OpenAI 官網取得您的 API 密鑰，用於 AI 題目生成。密鑰將安全儲存在 Supabase 中。
          </p>
          {apiKey && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              API 密鑰已設定
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
