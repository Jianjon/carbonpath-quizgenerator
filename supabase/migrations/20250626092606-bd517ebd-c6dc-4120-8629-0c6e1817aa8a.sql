
-- 創建生成會話表
CREATE TABLE public.generation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_name TEXT,
  parameters JSONB NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 修改題目表，添加會話關聯
ALTER TABLE public.question_bank 
ADD COLUMN session_id UUID REFERENCES public.generation_sessions(id);

-- 創建索引
CREATE INDEX idx_question_bank_session ON public.question_bank(session_id);
CREATE INDEX idx_generation_sessions_created_at ON public.generation_sessions(created_at DESC);

-- 啟用 RLS
ALTER TABLE public.generation_sessions ENABLE ROW LEVEL SECURITY;

-- 創建訪問政策
CREATE POLICY "Allow all operations on generation_sessions" 
  ON public.generation_sessions 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- 更新 updated_at 觸發器
CREATE TRIGGER handle_generation_sessions_updated_at
  BEFORE UPDATE ON public.generation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
