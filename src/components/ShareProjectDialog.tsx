import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Share2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ShareProjectDialogProps {
  projectId: string;
  projectName: string;
}

interface Share {
  id: string;
  shared_with_user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  profiles?: { full_name: string };
}

export function ShareProjectDialog({ projectId, projectName }: ShareProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadShares = async () => {
    const { data, error } = await supabase
      .from('project_shares')
      .select('id, shared_with_user_id, role, profiles:shared_with_user_id(full_name)')
      .eq('project_id', projectId);

    if (error) {
      console.error('Error loading shares:', error);
      return;
    }
    setShares(data as Share[]);
  };

  const handleShare = async () => {
    if (!email || !user) return;
    
    setLoading(true);
    try {
      // Find user by email (using profiles table)
      const { data: profiles, error: profileError } = await supabase
        .rpc('get_user_id_by_email', { user_email: email });

      if (profileError) {
        toast({
          title: 'User not found',
          description: 'No user found with that email address',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('project_shares')
        .insert({
          project_id: projectId,
          shared_with_user_id: profiles,
          role,
          shared_by_user_id: user.id,
        });

      if (error) throw error;

      // Create notification
      await supabase.from('user_notifications').insert({
        user_id: profiles,
        notification_type: 'share',
        title: 'Project Shared',
        message: `${user.email} shared "${projectName}" with you as ${role}`,
        link: `/research?project=${projectId}`,
      });

      toast({
        title: 'Project shared',
        description: `Successfully shared with ${email}`,
      });

      setEmail('');
      loadShares();
    } catch (error: any) {
      toast({
        title: 'Error sharing project',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    const { error } = await supabase
      .from('project_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove share',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Share removed' });
    loadShares();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) loadShares();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription>
            Invite others to collaborate on {projectName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer - Can view only</SelectItem>
                <SelectItem value="editor">Editor - Can edit and comment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleShare} disabled={loading || !email} className="w-full">
            Share Project
          </Button>

          {shares.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <Label>Current Shares</Label>
              {shares.map((share) => (
                <div key={share.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="text-sm font-medium">{share.profiles?.full_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{share.role}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveShare(share.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
