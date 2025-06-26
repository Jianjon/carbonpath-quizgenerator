
-- 建立 API 密鑰儲存表格
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 建立索引以提高查詢效率
CREATE INDEX idx_api_keys_user_service ON public.api_keys(user_id, service_name);

-- 啟用 Row Level Security
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 建立存取政策（暫時允許所有操作，後續可依需求調整）
CREATE POLICY "Allow all operations on api_keys" 
  ON public.api_keys 
  FOR ALL 
  USING (true)
  WITH CHECK (true);
