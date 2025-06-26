
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
  // 自動保存完整的題目內容到資料庫
  const saveQuestionsToDatabase = async () => {
    if (generatedQuestions.length === 0) return;
    
    try {
      const userIP = await getUserIP();
      const userAgent = navigator.userAgent;
      
      // 如果還沒有 session，先創建一個
      if (!sessionId) {
        const { data: session, error: sessionError } = await supabase
          .from('generation_sessions')
          .insert({
            session_name: `題目生成_${new Date().toISOString().split('T')[0]}_${Date.now()}`,
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
        
        // 將題目完整保存到 question_bank 表
        const questionsToSave = generatedQuestions.map(q => ({
          content: q.content,
          options: q.options, // 保存完整的選項資料
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          question_type: q.question_type,
          difficulty: q.difficulty,
          difficulty_label: q.difficulty_label,
          bloom_level: q.bloom_level,
          source_pdf: q.source_pdf || parameters.chapter,
          page_range: q.page_range || parameters.chapter,
          tags: q.tags || [],
          session_id: session.id,
          auto_generated: true,
          user_ip: userIP
        }));

        const { error: questionsError } = await supabase
          .from('question_bank')
          .insert(questionsToSave);

        if (questionsError) throw questionsError;

        console.log(`✅ 成功保存 ${generatedQuestions.length} 道完整題目到資料庫`);
        console.log('保存的題目資料:', questionsToSave);
      } else {
        // 如果已有 session，更新現有題目
        await updateQuestionsInDatabase(generatedQuestions);
      }

      // 更新使用者會話統計
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({ 
          total_questions: generatedQuestions.length,
          last_activity: new Date().toISOString()
        })
        .eq('user_ip', userIP);

      if (updateError) {
        console.warn('更新使用者會話統計失敗:', updateError);
      }

    } catch (error) {
      console.error('❌ 保存題目到資料庫失敗:', error);
      throw error;
    }
  };

  const updateQuestionsInDatabase = async (updatedQuestions: QuestionData[]) => {
    if (!sessionId) return;
    
    try {
      const userIP = await getUserIP();
      
      // 先刪除舊的題目
      const { error: deleteError } = await supabase
        .from('question_bank')
        .delete()
        .eq('session_id', sessionId);

      if (deleteError) throw deleteError;

      // 插入更新後的完整題目資料
      const questionsToSave = updatedQuestions.map(q => ({
        content: q.content,
        options: q.options, // 確保選項被完整保存
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type,
        difficulty: q.difficulty,
        difficulty_label: q.difficulty_label,
        bloom_level: q.bloom_level,
        source_pdf: q.source_pdf || '',
        page_range: q.page_range || '',
        tags: q.tags || [],
        session_id: sessionId,
        auto_generated: true,
        user_ip: userIP
      }));

      const { error: insertError } = await supabase
        .from('question_bank')
        .insert(questionsToSave);

      if (insertError) throw insertError;

      console.log(`✅ 成功更新 ${updatedQuestions.length} 道題目到資料庫`);
      console.log('更新的題目資料:', questionsToSave);
    } catch (error) {
      console.error('❌ 更新題目到資料庫失敗:', error);
      throw error;
    }
  };

  // 當生成完成時自動保存完整題目內容
  useEffect(() => {
    if (generatedQuestions.length > 0) {
      saveQuestionsToDatabase().catch(error => {
        console.error('自動保存失敗:', error);
      });
    }
  }, [generatedQuestions.length]);

  return {
    updateQuestionsInDatabase,
    saveQuestionsToDatabase
  };
};
