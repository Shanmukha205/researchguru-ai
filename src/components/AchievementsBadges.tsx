import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Star, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Achievement {
  id: string;
  achievement_type: string;
  achievement_name: string;
  achievement_description: string;
  earned_at: string;
}

interface ActivityStats {
  projects_created: number;
  agents_run: number;
  reports_generated: number;
  comments_added: number;
}

export function AchievementsBadges() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    projects_created: 0,
    agents_run: 0,
    reports_generated: 0,
    comments_added: 0,
  });
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    loadAchievements();
    loadStats();
  }, [user]);

  const loadAchievements = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false });

    if (error) {
      console.error('Error loading achievements:', error);
      return;
    }

    setAchievements(data);
  };

  const loadStats = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_activity')
      .select('activity_type, activity_count')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading stats:', error);
      return;
    }

    const statsMap = data.reduce((acc, item) => {
      acc[item.activity_type] = (acc[item.activity_type] || 0) + item.activity_count;
      return acc;
    }, {} as Record<string, number>);

    setStats({
      projects_created: statsMap.project_created || 0,
      agents_run: statsMap.agent_run || 0,
      reports_generated: statsMap.report_generated || 0,
      comments_added: statsMap.comment_added || 0,
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'first_project':
        return <Target className="h-5 w-5" />;
      case 'frequent_user':
        return <Star className="h-5 w-5" />;
      case 'multi_agent':
        return <Trophy className="h-5 w-5" />;
      case 'report_master':
        return <Award className="h-5 w-5" />;
      default:
        return <Trophy className="h-5 w-5" />;
    }
  };

  const progressGoals = [
    { name: 'Projects Created', current: stats.projects_created, goal: 10 },
    { name: 'Agents Run', current: stats.agents_run, goal: 50 },
    { name: 'Reports Generated', current: stats.reports_generated, goal: 20 },
    { name: 'Comments Added', current: stats.comments_added, goal: 30 },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Achievements
          </CardTitle>
          <CardDescription>Your earned badges and milestones</CardDescription>
        </CardHeader>
        <CardContent>
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Start using the platform to earn achievements!
            </p>
          ) : (
            <div className="grid gap-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                >
                  <div className="text-primary">{getIcon(achievement.achievement_type)}</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{achievement.achievement_name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {achievement.achievement_description}
                    </p>
                  </div>
                  <Badge variant="secondary">Earned</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress Tracker</CardTitle>
          <CardDescription>Track your journey to the next achievements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {progressGoals.map((goal) => (
            <div key={goal.name} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{goal.name}</span>
                <span className="text-muted-foreground">
                  {goal.current}/{goal.goal}
                </span>
              </div>
              <Progress value={(goal.current / goal.goal) * 100} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
