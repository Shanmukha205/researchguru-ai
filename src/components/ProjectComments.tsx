import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  user_id: string;
  profiles?: { full_name: string };
}

interface ProjectCommentsProps {
  projectId: string;
  agentResultId?: string;
}

export function ProjectComments({ projectId, agentResultId }: ProjectCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadComments();
    
    // Subscribe to new comments
    const channel = supabase
      .channel(`project_comments_${projectId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'project_comments',
          filter: `project_id=eq.${projectId}`
        }, 
        () => loadComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, agentResultId]);

  const loadComments = async () => {
    let query = supabase
      .from('project_comments')
      .select('*, profiles:user_id(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (agentResultId) {
      query = query.eq('agent_result_id', agentResultId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    setComments(data as Comment[]);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_comments')
        .insert({
          project_id: projectId,
          agent_result_id: agentResultId,
          user_id: user.id,
          comment_text: newComment.trim(),
        });

      if (error) throw error;

      // Track activity
      await supabase.rpc('increment_user_activity', {
        p_user_id: user.id,
        p_activity_type: 'comment_added'
      });

      setNewComment('');
      toast({ title: 'Comment added' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Discussion
        </CardTitle>
        <CardDescription>
          Collaborate and share insights about this research
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !newComment.trim()}
            size="sm"
          >
            <Send className="h-4 w-4 mr-2" />
            Comment
          </Button>
        </div>

        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm">
                  {comment.profiles?.full_name || 'User'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm">{comment.comment_text}</p>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first to share your thoughts!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
