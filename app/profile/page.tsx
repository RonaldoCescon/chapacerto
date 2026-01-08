'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  ArrowLeft, LogOut, Save, Loader2, Lock, 
  Wallet, Phone, UserCircle, BadgeCheck 
} from 'lucide-react';

// Tipagem para segurança
interface Profile {
  nome_razao: string;
  telefone: string;
  tipo_usuario: 'CONTRATANTE' | 'PRESTADOR' | '';
  chave_pix: string;
}

const ProfilePage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Estado do Perfil Tipado
  const [profile, setProfile] = useState<Profile>({
    nome_razao: '',
    telefone: '',
    tipo_usuario: '', 
    chave_pix: ''
  });

  // Estado Senha
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) { 
            router.replace('/login'); 
            return; 
        }
        setUser(currentUser);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao carregar perfil:', error);
        }

        if (data) {
            setProfile({
                nome_razao: data.nome_razao || '',
                telefone: data.telefone || '',
                tipo_usuario: data.tipo_usuario || '',
                // Garante que só preenche se tiver algo salvo na coluna chave_pix
                chave_pix: data.chave_pix || '' 
            });
        }
      } catch (err) {
        console.error(err);
        toast.error('Erro ao carregar informações.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
        const updates = {
            nome_razao: profile.nome_razao,
            telefone: profile.telefone,
            chave_pix: profile.chave_pix,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;
        toast.success('Perfil atualizado com sucesso!');
        
    } catch (error: any) {
        toast.error('Erro ao atualizar: ' + error.message);
    } finally {
        setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
      if (!newPassword) return toast.warning('Digite uma nova senha.');
      if (newPassword.length < 6) return toast.warning('A senha deve ter no mínimo 6 caracteres.');
      
      setUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) toast.error('Erro: ' + error.message);
      else {
          toast.success('Senha alterada com sucesso!');
          setNewPassword('');
      }
      setUpdatingPassword(false);
  };

  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    router.replace('/login'); 
  };

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
            <Loader2 className="animate-spin text-green-500" size={32}/>
        </div>
    );
  }

  const isChapa = profile.tipo_usuario === 'PRESTADOR';

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 font-sans pb-24 relative overflow-hidden">
      
      {/* Background Premium */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
            <button onClick={() => router.back()} className="p-3 bg-zinc-900/50 border border-white/10 rounded-full hover:bg-zinc-800 transition-colors backdrop-blur-md">
                <ArrowLeft size={20}/>
            </button>
            <h1 className="text-lg font-bold tracking-tight">Configurações</h1>
            <button onClick={handleLogout} className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full hover:bg-red-500/20 transition-colors backdrop-blur-md">
                <LogOut size={20}/>
            </button>
        </div>

        {/* CARTÃO DE IDENTIDADE */}
        <div className={`p-6 rounded-3xl border mb-8 relative overflow-hidden transition-colors duration-500 ${isChapa ? 'bg-green-950/10 border-green-500/20' : 'bg-blue-950/10 border-blue-500/20'}`}>
            <div className="flex items-center gap-5 relative z-10">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg ${isChapa ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                    {profile.nome_razao ? profile.nome_razao.charAt(0).toUpperCase() : <UserCircle size={32}/>}
                </div>
                <div>
                    <h2 className="text-xl font-bold truncate max-w-[200px]">{profile.nome_razao || 'Usuário Sem Nome'}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${isChapa ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {isChapa ? 'Prestador' : 'Contratante'}
                        </span>
                        {profile.nome_razao && <BadgeCheck size={16} className={isChapa ? 'text-green-500' : 'text-blue-500'} />}
                    </div>
                </div>
            </div>
            
            {/* Glow effect no card */}
            <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-[60px] opacity-20 pointer-events-none ${isChapa ? 'bg-green-500' : 'bg-blue-500'}`}></div>
        </div>

        {/* FORMULÁRIO */}
        <div className="space-y-6">
            
            <div className="bg-zinc-900/40 backdrop-blur-sm p-6 rounded-3xl border border-white/5 space-y-5">
                <h3 className="font-bold text-zinc-400 text-xs uppercase flex items-center gap-2 mb-2 tracking-wider">
                    <UserCircle size={14}/> Informações Básicas
                </h3>
                
                <div>
                    <label className="text-xs font-medium text-zinc-500 ml-1">Nome Completo / Razão Social</label>
                    <input 
                        className="w-full bg-zinc-950/50 border border-white/10 rounded-xl p-4 mt-1 focus:border-white/30 outline-none transition-colors text-sm text-white placeholder:text-zinc-700" 
                        value={profile.nome_razao} 
                        onChange={e => setProfile({...profile, nome_razao: e.target.value})} 
                        placeholder="Como prefere ser chamado?"
                    />
                </div>
                
                <div>
                    <label className="text-xs font-medium text-zinc-500 ml-1">Telefone / WhatsApp</label>
                    <div className="relative">
                        <Phone size={18} className="absolute left-4 top-4 text-zinc-500"/>
                        <input 
                            className="w-full bg-zinc-950/50 border border-white/10 rounded-xl p-4 pl-12 mt-1 focus:border-white/30 outline-none transition-colors text-sm text-white" 
                            value={profile.telefone} 
                            onChange={e => setProfile({...profile, telefone: e.target.value})} 
                        />
                    </div>
                </div>
            </div>

            {/* Dados Financeiros (SÓ PARA CHAPA) */}
            {isChapa && (
                <div className="bg-zinc-900/40 backdrop-blur-sm p-6 rounded-3xl border border-white/5 space-y-4">
                    <h3 className="font-bold text-green-400 text-xs uppercase flex items-center gap-2 mb-2 tracking-wider">
                        <Wallet size={14}/> Recebimento
                    </h3>
                    <div>
                        <label className="text-xs font-medium text-zinc-500 ml-1">Sua Chave PIX</label>
                        <input 
                            // Truques para evitar autofill errado
                            autoComplete="off"
                            name="campo_pix_aleatorio"
                            id="campo_pix_unico"
                            
                            placeholder="CPF, Email, Telefone ou Aleatória"
                            className="w-full bg-zinc-950/50 border border-white/10 rounded-xl p-4 mt-1 focus:border-green-500/50 outline-none transition-colors text-sm text-white placeholder:text-zinc-700" 
                            value={profile.chave_pix} 
                            onChange={e => setProfile({...profile, chave_pix: e.target.value})} 
                        />
                        <p className="text-[10px] text-zinc-500 mt-2 ml-1">
                            Necessário para receber pagamentos diretos na plataforma.
                        </p>
                    </div>
                </div>
            )}

            <button 
                onClick={handleSave} 
                disabled={saving} 
                className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
            >
                {saving ? <Loader2 className="animate-spin"/> : <><Save size={18}/> Salvar Alterações</>}
            </button>

            {/* Segurança */}
            <div className="bg-red-500/5 p-6 rounded-3xl border border-red-500/10 mt-8">
                <h3 className="font-bold text-red-400 text-xs uppercase flex items-center gap-2 mb-4 tracking-wider">
                    <Lock size={14}/> Segurança da Conta
                </h3>
                <div className="flex gap-3">
                    <input 
                        type="password" 
                        placeholder="Nova senha" 
                        autoComplete="new-password"
                        className="w-full bg-zinc-950/50 border border-red-500/20 rounded-xl p-3 focus:border-red-500/50 outline-none transition-colors text-sm text-white placeholder:text-zinc-700" 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                    />
                    <button 
                        onClick={handleUpdatePassword} 
                        disabled={updatingPassword}
                        className="bg-red-500/10 text-red-400 font-bold px-5 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs whitespace-nowrap"
                    >
                        {updatingPassword ? <Loader2 className="animate-spin" size={14}/> : 'Trocar'}
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;