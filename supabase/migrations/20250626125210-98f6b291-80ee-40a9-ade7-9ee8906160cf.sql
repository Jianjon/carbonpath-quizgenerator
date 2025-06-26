
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

-- 為視圖設置適當的擁有者
ALTER VIEW public.admin_generation_summary OWNER TO postgres;
