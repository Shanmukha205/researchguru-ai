import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useActivityTracking = () => {
  const { user } = useAuth();

  const trackActivity = async (activityType: string) => {
    if (!user) return;

    try {
      // Call RPC function to increment activity
      await supabase.rpc('increment_user_activity', {
        p_user_id: user.id,
        p_activity_type: activityType
      });

      // Check for new achievements
      await checkAndAwardAchievements(activityType);
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  };

  const checkAndAwardAchievements = async (activityType: string) => {
    if (!user) return;

    const { data: stats } = await supabase
      .from('user_activity')
      .select('activity_count')
      .eq('user_id', user.id)
      .eq('activity_type', activityType)
      .single();

    if (!stats) return;

    // Award achievements based on milestones
    const achievements: Record<string, { count: number; name: string; description: string }> = {
      'project_created': {
        count: 1,
        name: 'First Steps',
        description: 'Created your first research project'
      },
      'agent_run': {
        count: 10,
        name: 'Agent Explorer',
        description: 'Successfully ran 10 agents'
      },
      'report_generated': {
        count: 5,
        name: 'Report Master',
        description: 'Generated 5 comprehensive reports'
      },
      'comment_added': {
        count: 10,
        name: 'Community Contributor',
        description: 'Added 10 helpful comments'
      },
    };

    const achievement = achievements[activityType];
    if (achievement && stats.activity_count >= achievement.count) {
      // Check if already awarded
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', user.id)
        .eq('achievement_type', activityType)
        .single();

      if (!existing) {
        await supabase.from('user_achievements').insert({
          user_id: user.id,
          achievement_type: activityType,
          achievement_name: achievement.name,
          achievement_description: achievement.description,
        });

        // Create notification
        await supabase.from('user_notifications').insert({
          user_id: user.id,
          notification_type: 'achievement',
          title: '🏆 Achievement Unlocked!',
          message: `You earned: ${achievement.name}`,
        });
      }
    }
  };

  return { trackActivity };
};
