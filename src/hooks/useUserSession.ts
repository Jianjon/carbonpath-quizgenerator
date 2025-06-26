
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useUserSession = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    initializeUserSession();
  }, []);

  const initializeUserSession = async () => {
    try {
      const userIP = await getUserIP();
      const userAgent = navigator.userAgent;
      
      // 創建或更新使用者會話
      const { data: existingSession, error: fetchError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_ip', userIP)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingSession) {
        // 更新最後活動時間
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', existingSession.id);
      } else {
        // 創建新會話
        const { data: newSession, error: createError } = await supabase
          .from('user_sessions')
          .insert({
            user_ip: userIP,
            user_agent: userAgent
          })
          .select()
          .single();

        if (createError) throw createError;
      }
    } catch (error) {
      console.error('初始化使用者會話失敗:', error);
    }
  };

  const getUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get IP:', error);
      return 'unknown';
    }
  };

  return {
    sessionId,
    setSessionId,
    getUserIP
  };
};
