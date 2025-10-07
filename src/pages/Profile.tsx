import { AppLayout } from '@/components/AppLayout';
import { AchievementsBadges } from '@/components/AchievementsBadges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { User } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Manage your profile and view your achievements</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium">Email:</span>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium">User ID:</span>
                <p className="text-sm text-muted-foreground font-mono">{user.id}</p>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <AchievementsBadges />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
