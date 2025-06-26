
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
  // Debug: 檢查 Supabase 連接
  const testSupabaseConnection = async () => {
    try {
      console.log('🔍 DEBUG: 測試 Supabase 連接...');
      const { data, error } = await supabase.from('question_bank').select('count').limit(1);
      if (error) {
        console.error('❌ DEBUG: Supabase 連接失敗:', error);
      } else {
        console.log('✅ DEBUG: Supabase 連接成功');
      }
    } catch (error) {
      console.error('❌ DEBUG: Supabase 連接測試異常:', error);
    }
  };

  // Debug: 檢查題目資料格式
  const validateQuestionData = (questions: QuestionData[]) => {
    console.log('🔍 DEBUG: 驗證題目資料格式...');
    console.log('題目總數:', questions.length);
    
    questions.forEach((q, index) => {
      console.log(`題目 ${index + 1} 驗證:`);
      console.log('- ID:', q.id ? '✅' : '❌', q.id);
      console.log('- 內容:', q.content ? '✅' : '❌', q.content?.substring(0, 50) + '...');
      console.log('- 選項:', q.options ? '✅' : '❌', Object.keys(q.options || {}).length, '個選項');
      console.log('- 正確答案:', q.correct_answer ? '✅' : '❌', q.correct_answer);
      console.log('- 解析:', q.explanation ? '✅' : '❌', q.explanation?.substring(0, 50) + '...');
      console.log('- 題目類型:', q.question_type ? '✅' : '❌', q.question_type);
      console.log('- 難度:', q.difficulty !== undefined ? '✅' : '❌', q.difficulty);
      console.log('- 難度標籤:', q.difficulty_label ? '✅' : '❌', q.difficulty_label);
      console.log('- 布魯姆層次:', q.bloom_level !== undefined ? '✅' : '❌', q.bloom_level);
      console.log('- 章節:', q.chapter ? '✅' : '❌', q.chapter);
      console.log('---');
    });
  };

  // 修正難度標籤格式
  const normalizeDifficultyLabel = (label: string): string => {
    console.log('🔧 DEBUG: 原始難度標籤:', label);
    
    // 將各種可能的難度標籤統一為資料庫接受的格式
    const normalizedLabel = label?.toLowerCase().includes('易') || label?.toLowerCase().includes('easy') ? '易' :
                           label?.toLowerCase().includes('中') || label?.toLowerCase().includes('medium') ? '中' :
                           label?.toLowerCase().includes('難') || label?.toLowerCase().includes('hard') ? '難' : '中';
    
    console.log('🔧 DEBUG: 正規化後難度標籤:', normalizedLabel);
    return normalizedLabel;
  };

  // 自動保存完整的題目內容到資料庫
  const saveQuestionsToDatabase = async () => {
    console.log('🚀 DEBUG: saveQuestionsToDatabase 開始執行...');
    
    if (generatedQuestions.length === 0) {
      console.log('⚠️ DEBUG: 沒有題目需要保存，函數結束');
      return;
    }

    // 測試 Supabase 連接
    await testSupabaseConnection();
    
    // 驗證題目資料
    validateQuestionData(generatedQuestions);
    
    try {
      const userIP = await getUserIP();
      const userAgent = navigator.userAgent;
      
      console.log('🔍 DEBUG: 使用者資訊');
      console.log('- IP:', userIP);
      console.log('- User Agent:', userAgent);
      console.log('- 目前 Session ID:', sessionId);
      
      // 如果還沒有 session，先創建一個
      if (!sessionId) {
        console.log('⚡ DEBUG: 創建新的生成會話...');
        
        const sessionData = {
          session_name: `題目生成_${new Date().toISOString().split('T')[0]}_${Date.now()}`,
          parameters: parameters || {},
          question_count: generatedQuestions.length,
          user_ip: userIP,
          user_agent: userAgent,
          auto_saved: true
        };
        
        console.log('🔍 DEBUG: 會話資料:', sessionData);
        
        const { data: session, error: sessionError } = await supabase
          .from('generation_sessions')
          .insert(sessionData)
          .select()
          .single();

        if (sessionError) {
          console.error('❌ DEBUG: 創建會話失敗:', sessionError);
          console.error('- 錯誤碼:', sessionError.code);
          console.error('- 錯誤訊息:', sessionError.message);
          console.error('- 錯誤詳情:', sessionError.details);
          throw sessionError;
        }
        
        console.log('✅ DEBUG: 會話創建成功:', session);
        setSessionId(session.id);
        
        // 準備題目資料以插入資料庫
        const questionsToSave = generatedQuestions.map((q, index) => {
          const questionData = {
            content: q.content,
            options: q.options, // 保存為 JSONB 格式
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            question_type: q.question_type === 'choice' ? 'choice' : q.question_type,
            difficulty: q.difficulty,
            difficulty_label: normalizeDifficultyLabel(q.difficulty_label), // 修正難度標籤
            bloom_level: q.bloom_level,
            source_pdf: q.source_pdf || parameters.chapter,
            page_range: q.page_range || parameters.chapter,
            tags: q.tags || [],
            session_id: session.id,
            auto_generated: true,
            user_ip: userIP
          };
          
          console.log(`🔍 DEBUG: 題目 ${index + 1} 準備資料:`, questionData);
          return questionData;
        });

        console.log('💾 DEBUG: 準備插入題目資料到 question_bank 表...');
        console.log('- 題目數量:', questionsToSave.length);
        console.log('- 第一道題目完整資料:', JSON.stringify(questionsToSave[0], null, 2));

        const { data: savedQuestions, error: questionsError } = await supabase
          .from('question_bank')
          .insert(questionsToSave)
          .select();

        if (questionsError) {
          console.error('❌ DEBUG: 插入題目失敗:', questionsError);
          console.error('- 錯誤碼:', questionsError.code);
          console.error('- 錯誤訊息:', questionsError.message);
          console.error('- 錯誤詳情:', questionsError.details);
          console.error('- 嘗試插入的資料樣本:', JSON.stringify(questionsToSave[0], null, 2));
          
          // 特別處理約束錯誤
          if (questionsError.code === '23514') {
            console.error('⚠️ DEBUG: 檢查約束錯誤 - 可能是 difficulty_label 格式問題');
            console.error('- 檢查所有題目的 difficulty_label:');
            questionsToSave.forEach((q, i) => {
              console.error(`  題目 ${i + 1}: "${q.difficulty_label}"`);
            });
          }
          
          throw questionsError;
        }

        console.log('✅ DEBUG: 成功保存題目到資料庫!');
        console.log('- 保存的題目數量:', savedQuestions?.length || questionsToSave.length);
        console.log('- 保存的題目 IDs:', savedQuestions?.map(q => q.id));
        console.log('- 第一道保存的題目:', savedQuestions?.[0]);

      } else {
        console.log('🔄 DEBUG: 使用現有會話更新題目...');
        await updateQuestionsInDatabase(generatedQuestions);
      }

      // 更新使用者會話統計
      console.log('📊 DEBUG: 更新使用者會話統計...');
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({ 
          total_questions: generatedQuestions.length,
          last_activity: new Date().toISOString()
        })
        .eq('user_ip', userIP);

      if (updateError) {
        console.warn('⚠️ DEBUG: 更新使用者會話統計失敗:', updateError);
      } else {
        console.log('✅ DEBUG: 使用者會話統計更新成功');
      }

      console.log('🎉 DEBUG: 題目保存流程完全完成！');
      
      // 驗證保存結果 - 修正這裡的錯誤
      const currentSessionId = sessionId || session?.id;
      if (currentSessionId) {
        await verifyDataInDatabase(currentSessionId);
      }

    } catch (error) {
      console.error('❌ DEBUG: 保存題目到資料庫完全失敗:', error);
      console.error('- 錯誤類型:', typeof error);
      console.error('- 錯誤堆疊:', error.stack);
      throw error;
    }
  };

  // Debug: 驗證資料是否真的保存到資料庫
  const verifyDataInDatabase = async (currentSessionId: string) => {
    try {
      console.log('🔍 DEBUG: 驗證資料庫中的資料...');
      console.log('- 驗證 Session ID:', currentSessionId);
      
      const { data: questions, error } = await supabase
        .from('question_bank')
        .select('*')
        .eq('session_id', currentSessionId);

      if (error) {
        console.error('❌ DEBUG: 查詢驗證失敗:', error);
      } else {
        console.log('✅ DEBUG: 資料庫驗證結果:');
        console.log('- 找到的題目數量:', questions?.length || 0);
        if (questions && questions.length > 0) {
          console.log('- 第一道題目:', questions[0]);
          console.log('- 選項格式:', typeof questions[0].options, questions[0].options);
        }
      }
    } catch (error) {
      console.error('❌ DEBUG: 驗證過程失敗:', error);
    }
  };

  const updateQuestionsInDatabase = async (updatedQuestions: QuestionData[]) => {
    if (!sessionId) {
      console.warn('⚠️ 沒有 session ID，無法更新題目');
      return;
    }
    
    try {
      const userIP = await getUserIP();
      
      console.log('🔄 更新現有題目，會話 ID:', sessionId);
      
      // 先刪除舊的題目
      const { error: deleteError } = await supabase
        .from('question_bank')
        .delete()
        .eq('session_id', sessionId);

      if (deleteError) {
        console.error('❌ 刪除舊題目失敗:', deleteError);
        throw deleteError;
      }

      console.log('🗑️ 已刪除舊題目');

      // 插入更新後的完整題目資料
      const questionsToSave = updatedQuestions.map(q => ({
        content: q.content,
        options: q.options, // 確保選項被完整保存
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        question_type: q.question_type === 'choice' ? 'choice' : q.question_type,
        difficulty: q.difficulty,
        difficulty_label: normalizeDifficultyLabel(q.difficulty_label), // 修正難度標籤
        bloom_level: q.bloom_level,
        source_pdf: q.source_pdf || '',
        page_range: q.page_range || '',
        tags: q.tags || [],
        session_id: sessionId,
        auto_generated: true,
        user_ip: userIP
      }));

      console.log('💾 準備插入更新後的題目:', questionsToSave.length, '道');

      const { data: savedQuestions, error: insertError } = await supabase
        .from('question_bank')
        .insert(questionsToSave)
        .select();

      if (insertError) {
        console.error('❌ 插入更新後的題目失敗:', insertError);
        throw insertError;
      }

      console.log('✅ 成功更新題目:', savedQuestions?.length || questionsToSave.length, '道');
    } catch (error) {
      console.error('❌ 更新題目到資料庫失敗:', error);
      throw error;
    }
  };

  // 當生成完成時自動保存完整題目內容
  useEffect(() => {
    if (generatedQuestions.length > 0) {
      console.log('🎯 DEBUG: 檢測到題目變化，觸發自動保存...');
      console.log('- 題目數量:', generatedQuestions.length);
      console.log('- 第一道題目預覽:', generatedQuestions[0]?.content?.substring(0, 100));
      
      saveQuestionsToDatabase().catch(error => {
        console.error('❌ DEBUG: 自動保存完全失敗:', error);
      });
    } else {
      console.log('⚠️ DEBUG: 沒有題目，跳過自動保存');
    }
  }, [generatedQuestions.length, JSON.stringify(generatedQuestions)]);

  return {
    updateQuestionsInDatabase,
    saveQuestionsToDatabase,
    testSupabaseConnection, // 暴露測試函數供手動呼叫
    verifyDataInDatabase     // 暴露驗證函數供手動呼叫
  };
};
