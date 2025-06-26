
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QuestionData {
  id: string;
  content: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation: string;
  question_type: string;
  difficulty: number;
  difficulty_label: string;
  bloom_level: number;
  chapter: string;
  source_pdf?: string;
  page_range?: string;
  tags?: string[];
}

interface Parameters {
  chapter: string;
  questionStyle: string;
  questionCount: number;
  questionTypes: string[];
  sampleQuestions: any[];
  keywords?: string;
  weightingConfig: any;
}

export const useAutoSave = (
  generatedQuestions: QuestionData[],
  parameters: Parameters,
  sessionId: string | null,
  setSessionId: (id: string) => void,
  getUserIP: () => Promise<string>
) => {
  // 修改自動保存功能
  const saveQuestionsAutomatically = async () => {
    if (generatedQuestions.length === 0) return;
    
    try {
      const userIP = await getUserIP();
      const userAgent = navigator.userAgent;
      
      // 創建生成會話
      const { data: session, error: sessionError } = await supabase
        .from('generation_sessions')
        .insert({
          session_name: `自動保存_${new Date().toISOString().split('T')[0]}_${userIP}`,
          parameters: parameters || {},
          question_count: generatedQuestions.length,
          user_ip: userIP,
          user_agent: userAgent,
          auto_saved: true
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      setSessionId(session.id);

      // 保存題目
      const questionsToSave = generatedQuestions.map(q => ({
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type,
        difficulty: q.difficulty,
        difficulty_label: q.difficulty_label,
        bloom_level: q.bloom_level,
        chapter: q.chapter,
        source_pdf: q.source_pdf,
        page_range: q.page_range,
        tags: q.tags,
        session_id: session.id,
        auto_generated: true,
        user_ip: userIP
      }));

      const { error: questionsError } = await supabase
        .from('question_bank')
        .insert(questionsToSave);

      if (questionsError) throw questionsError;

      // 更新使用者會話的題目總數
      await supabase
        .from('user_sessions')
        .update({ 
          total_questions: generatedQuestions.length,
          last_activity: new Date().toISOString()
        })
        .eq('user_ip', userIP);

      console.log(`自動保存成功: ${generatedQuestions.length} 道題目已保存`);
    } catch (error) {
      console.error('自動保存失敗:', error);
    }
  };

  const updateQuestionsInDatabase = async (updatedQuestions: QuestionData[]) => {
    try {
      const userIP = await getUserIP();
      
      // 刪除舊的題目
      await supabase
        .from('question_bank')
        .delete()
        .eq('session_id', sessionId);

      // 插入更新後的題目
      const questionsToSave = updatedQuestions.map(q => ({
        content: q.content,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type,
        difficulty: q.difficulty,
        difficulty_label: q.difficulty_label,
        bloom_level: q.bloom_level,
        chapter: q.chapter,
        source_pdf: q.source_pdf,
        page_range: q.page_range,
        tags: q.tags,
        session_id: sessionId,
        auto_generated: true,
        user_ip: userIP
      }));

      await supabase
        .from('question_bank')
        .insert(questionsToSave);

      console.log('題目更新已自動保存到資料庫');
    } catch (error) {
      console.error('更新題目到資料庫失敗:', error);
    }
  };

  // 當生成完成時自動保存
  useEffect(() => {
    if (generatedQuestions.length > 0) {
      saveQuestionsAutomatically();
    }
  }, [generatedQuestions.length]);

  return {
    updateQuestionsInDatabase
  };
};
