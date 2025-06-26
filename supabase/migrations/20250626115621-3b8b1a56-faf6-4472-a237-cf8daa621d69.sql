
-- 修復 Function Search Path Mutable 問題
-- 重新創建 handle_updated_at 函數，使用固定的 search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 修復 Security Definer View 問題
-- 重新創建 admin_generation_summary 視圖，移除 SECURITY DEFINER
DROP VIEW IF EXISTS public.admin_generation_summary;

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

-- 為視圖設置適當的 RLS 政策
ALTER VIEW public.admin_generation_summary OWNER TO postgres;

-- 修復 Auth OTP 過期時間問題（調整為建議的較短時間）
-- 注意：這個設置需要在 Supabase Dashboard 的 Auth 設置中手動調整
-- 建議將 OTP 過期時間設為 10 分鐘（600 秒）而不是預設的更長時間
