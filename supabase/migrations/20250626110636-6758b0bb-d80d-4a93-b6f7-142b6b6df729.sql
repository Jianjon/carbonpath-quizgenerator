
-- 創建使用者會話表來追蹤每個使用者的生成記錄
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_ip TEXT NOT NULL,
  user_agent TEXT,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_questions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 修改 generation_sessions 表，添加使用者資訊
ALTER TABLE public.generation_sessions 
ADD COLUMN user_ip TEXT,
ADD COLUMN user_agent TEXT,
ADD COLUMN auto_saved BOOLEAN DEFAULT true;

-- 修改 question_bank 表，確保每個問題都與生成會話關聯
ALTER TABLE public.question_bank 
ADD COLUMN auto_generated BOOLEAN DEFAULT true,
ADD COLUMN user_ip TEXT;

-- 創建索引以提高查詢效能
CREATE INDEX idx_user_sessions_ip ON public.user_sessions(user_ip);
CREATE INDEX idx_generation_sessions_user_ip ON public.generation_sessions(user_ip);
CREATE INDEX idx_question_bank_user_ip ON public.question_bank(user_ip);
CREATE INDEX idx_generation_sessions_auto_saved ON public.generation_sessions(auto_saved);

-- 啟用 RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 創建訪問政策（允許所有操作，因為這是管理功能）
CREATE POLICY "Allow all operations on user_sessions" 
  ON public.user_sessions 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- 更新 updated_at 觸發器
CREATE TRIGGER handle_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 創建後台管理視圖
CREATE VIEW public.admin_generation_summary AS
SELECT 
  gs.id,
  gs.session_name,
  gs.user_ip,
  gs.user_agent,
  gs.question_count,
  gs.parameters,
  gs.created_at,
  COUNT(qb.id) as actual_questions_saved,
  gs.auto_saved
FROM public.generation_sessions gs
LEFT JOIN public.question_bank qb ON gs.id = qb.session_id
GROUP BY gs.id, gs.session_name, gs.user_ip, gs.user_agent, gs.question_count, gs.parameters, gs.created_at, gs.auto_saved
ORDER BY gs.created_at DESC;
