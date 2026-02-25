import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const { profile, companyId, user } = useAuth();
  const { toast } = useToast();
  const [profileName, setProfileName] = useState(profile?.name || "");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (companyId) {
      supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single()
        .then(({ data }) => {
          if (data) setCompanyName(data.name);
        });
    }
  }, [companyId]);

  useEffect(() => {
    setProfileName(profile?.name || "");
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ name: profileName }).eq("id", user.id);
    toast({ title: "Perfil atualizado" });
  };

  const saveCompany = async () => {
    if (!companyId) return;
    await supabase.from("companies").update({ name: companyName }).eq("id", companyId);
    toast({ title: "Empresa atualizada" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={profile?.role || ""} disabled className="bg-muted" />
          </div>
          <Button onClick={saveProfile} className="gap-2">
            <Save className="h-4 w-4" /> Salvar Perfil
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da Empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <Button onClick={saveCompany} className="gap-2">
            <Save className="h-4 w-4" /> Salvar Empresa
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
