import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Mail, Trash2, UserPlus, AlertCircle, CheckCircle } from "lucide-react";

interface Collaborator {
  id: string;
  collaborator_email: string;
  role: string;
  status: string;
  invited_at: string;
}

// Email validation regex
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function WorkspaceCollaboration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadCollaborators();
    }
  }, [user]);

  // Validate email on change
  useEffect(() => {
    if (newEmail && !isValidEmail(newEmail)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError(null);
    }
  }, [newEmail]);

  const loadCollaborators = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('workspace_collaborators')
      .select('*')
      .eq('workspace_owner_id', user.id)
      .order('invited_at', { ascending: false });
    
    if (error) {
      console.error('Error loading collaborators:', error);
    } else {
      setCollaborators(data || []);
    }
  };

  const inviteCollaborator = async () => {
    if (!user || !newEmail) return;

    // Validate email format
    if (!isValidEmail(newEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate invitation
    const existingInvite = collaborators.find(
      c => c.collaborator_email.toLowerCase() === newEmail.toLowerCase()
    );
    if (existingInvite) {
      toast({
        title: "Duplicate Invitation",
        description: `An invitation has already been sent to ${newEmail}`,
        variant: "destructive",
      });
      return;
    }

    // Cannot invite yourself
    if (user.email?.toLowerCase() === newEmail.toLowerCase()) {
      toast({
        title: "Invalid Email",
        description: "You cannot invite yourself as a collaborator",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Insert collaborator invitation
      const { error: insertError } = await supabase
        .from('workspace_collaborators')
        .insert({
          workspace_owner_id: user.id,
          collaborator_email: newEmail.toLowerCase().trim(),
          role: newRole,
          status: 'pending',
        });

      if (insertError) throw insertError;

      // Send invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-collaboration-invite', {
        body: {
          email: newEmail.toLowerCase().trim(),
          role: newRole,
          inviterEmail: user.email,
        }
      });

      if (emailError) {
        console.warn('Email sending failed:', emailError);
        // Still show success since invitation was recorded
        toast({
          title: "Invitation Recorded",
          description: `Invitation for ${newEmail} was saved. Email delivery may be delayed.`,
        });
      } else {
        toast({
          title: "Invitation Sent Successfully",
          description: `An invitation email has been sent to ${newEmail}`,
        });
      }

      setNewEmail("");
      loadCollaborators();
    } catch (error: any) {
      console.error('Error inviting collaborator:', error);
      toast({
        title: "Failed to Send Invitation",
        description: error.message || "Unable to send invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeCollaborator = async (id: string) => {
    const { error } = await supabase
      .from('workspace_collaborators')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove collaborator",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Collaborator removed",
      });
      loadCollaborators();
    }
  };

  const resendInvitation = async (collab: Collaborator) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-collaboration-invite', {
        body: {
          email: collab.collaborator_email,
          role: collab.role,
          inviterEmail: user?.email,
        }
      });

      if (error) throw error;

      toast({
        title: "Invitation Resent",
        description: `A new invitation has been sent to ${collab.collaborator_email}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Resend",
        description: error.message || "Unable to resend invitation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <h2 className="text-2xl font-bold">Workspace Collaboration</h2>
      </div>

      <div className="space-y-4">
        <p className="text-muted-foreground">
          Invite team members to collaborate on your research projects
        </p>

        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={emailError ? "border-destructive" : ""}
              />
              {emailError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {emailError}
                </p>
              )}
            </div>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={inviteCollaborator} 
              disabled={loading || !newEmail || !!emailError}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Team Members</h3>
          {collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collaborators yet</p>
          ) : (
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{collab.collaborator_email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited {new Date(collab.invited_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={collab.status === 'accepted' ? 'default' : 'secondary'}
                      className={collab.status === 'accepted' ? 'bg-green-500/20 text-green-600' : ''}
                    >
                      {collab.status === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {collab.status}
                    </Badge>
                    <Badge variant="outline">{collab.role}</Badge>
                    {collab.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resendInvitation(collab)}
                        disabled={loading}
                      >
                        Resend
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCollaborator(collab.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}