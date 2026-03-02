import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function RequireAccess({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) { setChecking(false); return; }

    const check = async () => {
      // 1) access_override on profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('access_override')
        .eq('id', user.id)
        .single();

      if ((prof as any)?.access_override) {
        setHasAccess(true);
        setChecking(false);
        return;
      }

      // 2) active subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('company_id', profile.company_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      setHasAccess(!!sub);
      setChecking(false);
    };

    check();
  }, [user, loading, profile]);

  if (loading || checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!hasAccess) return <Navigate to="/?no_access=1" replace />;

  return <>{children}</>;
}
