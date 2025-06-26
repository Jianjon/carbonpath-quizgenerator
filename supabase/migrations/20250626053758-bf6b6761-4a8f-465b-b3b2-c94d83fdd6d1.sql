
-- 建立章節管理表
CREATE TABLE public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  pdf_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 建立學習目標表
CREATE TABLE public.learning_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  chapter_id UUID REFERENCES public.chapters(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 建立完整的題目銀行表
CREATE TABLE public.question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('choice', 'true-false', 'short-answer')),
  difficulty FLOAT CHECK (difficulty >= 0 AND difficulty <= 1),
  difficulty_label TEXT CHECK (difficulty_label IN ('易', '中', '難')),
  bloom_level INTEGER CHECK (bloom_level >= 1 AND bloom_level <= 6),
  chapter_id UUID REFERENCES public.chapters(id),
  learning_goal_ids UUID[],
  source_pdf TEXT,
  page_range TEXT,
  tags TEXT[],
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 建立索引以提高查詢效率
CREATE INDEX idx_question_bank_chapter ON public.question_bank(chapter_id);
CREATE INDEX idx_question_bank_difficulty ON public.question_bank(difficulty);
CREATE INDEX idx_question_bank_bloom_level ON public.question_bank(bloom_level);
CREATE INDEX idx_question_bank_created_by ON public.question_bank(created_by);
CREATE INDEX idx_question_bank_tags ON public.question_bank USING GIN(tags);

-- 啟用 Row Level Security
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- 建立存取政策（暫時允許所有操作，後續可依需求調整）
CREATE POLICY "Allow all operations on chapters" 
  ON public.chapters 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on learning_goals" 
  ON public.learning_goals 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on question_bank" 
  ON public.question_bank 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- 建立自動更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_question_bank_updated_at
  BEFORE UPDATE ON public.question_bank
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
