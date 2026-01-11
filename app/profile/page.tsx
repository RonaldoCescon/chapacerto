'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  ArrowLeft, LogOut, Save, Loader2, Lock, 
  Wallet, Phone, UserCircle, BadgeCheck, ShieldCheck,
  Truck, Armchair, Hammer, Briefcase, CheckCircle2, FileText, Wrench
} from 'lucide-react';

// --- LISTA DE PROFISSÕES ---
const PROFESSIONS = [
  { id: 'carga', label: 'Carga e Descarga', icon: <Truck size={20}/> },
  { id: 'mudanca', label: 'Mudança', icon: <Armchair size={20}/> },
  { id: 'ajudante', label: 'Ajudante Geral', icon: <UserCircle size={20}/> },
  { id: 'marido', label: 'Marido de Aluguel', icon: <Hammer size={20}/> },
  { id: 'freelance', label: 'Free Lance', icon: <Briefcase size={20}/> },
];

// Tipagem atualizada
interface Profile {
  nome_razao: string;
  telefone: string;
  tipo_usuario: 'CONTRATANTE' | 'PRESTADOR' | '';
  chave_pix: string;
  bio: string;
  skills: string[];
}

const ProfilePage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Estado do Perfil
  const [profile, setProfile] = useState<Profile>({
    nome_razao: '',
    telefone: '',
    tipo_usuario: '', 
    chave_pix: '',
    bio: '',
    skills: []
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
        
        if (data) {
            setProfile({
                nome_razao: data.nome_razao || '',
                telefone: data.telefone || '',
                tipo_usuario: data.tipo_usuario || '',
                chave_pix: data.chave_pix || '',
                bio: data.bio || '',
                skills: data.skills || []
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

  // Função para marcar/desmarcar habilidade
  const toggleSkill = (skillId: string) => {
    setProfile(prev => {
      const exists = prev.skills.includes(skillId);
      if (exists) {
        return { ...prev, skills: prev.skills.filter(s => s !== skillId) };
      } else {
        return { ...prev, skills: [...prev.skills, skillId] };
      }
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    
    // Validação básica para prestador
    if (profile.tipo_usuario === 'PRESTADOR' && profile.skills.length > 0 && profile.bio.length < 5) {
        toast.error("Escreva um breve resumo da sua experiência.");
        setSaving(false);
        return;
    }
    
    try {
        const updates = {
            nome_razao: profile.nome_razao,
            telefone: profile.telefone,
            chave_pix: profile.chave_pix,
            bio: profile.bio,
            skills: profile.skills,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

        if (error) throw error;
        toast.success('Perfil salvo com sucesso!');
        
    } catch (error: any) {
        toast.error('Erro ao atualizar: ' + error.message);
    } finally {
        setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
      if (!newPassword || newPassword.length < 6) return toast.warning('Senha muito curta.');
      setUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) toast.error('Erro: ' + error.message);
      else {
          toast.success('Senha alterada!');
          setNewPassword('');
      }
      setUpdatingPassword(false);
  };

  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    router.replace('/login'); 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;

  const isChapa = profile.tipo_usuario === 'PRESTADOR';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-24 relative overflow-hidden">
      
      {/* Background Sutil */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <div className="max-w-xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8 pt-4">
            <button onClick={() => router.back()} className="p-3 bg-white border border-gray-200 rounded-full hover:bg-gray-100 transition-colors shadow-sm text-gray-600"><ArrowLeft size={20}/></button>
            <h1 className="text-lg font-bold tracking-tight text-gray-900">Meu Perfil</h1>
            <button onClick={handleLogout} className="p-3 bg-red-50 border border-red-100 text-red-500 rounded-full hover:bg-red-100 transition-colors shadow-sm"><LogOut size={20}/></button>
        </div>

        {/* CARTÃO DE IDENTIDADE */}
        <div className={`p-6 rounded-3xl border mb-8 relative overflow-hidden transition-all shadow-lg ${isChapa ? 'bg-gradient-to-br from-green-600 to-green-700 text-white border-green-500' : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-500'}`}>
            <div className="flex items-center gap-5 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold shadow-inner border border-white/10 text-white">
                    {profile.nome_razao ? profile.nome_razao.charAt(0).toUpperCase() : <UserCircle size={32}/>}
                </div>
                <div>
                    <h2 className="text-xl font-bold truncate max-w-[200px] text-white leading-tight">{profile.nome_razao || 'Usuário'}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-black/20 text-white/90 border border-white/10">{isChapa ? 'Prestador' : 'Contratante'}</span>
                        {profile.nome_razao && <BadgeCheck size={18} className="text-white drop-shadow-sm" />}
                    </div>
                </div>
            </div>
            <div className="absolute -right-6 -bottom-10 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
        </div>

        {/* FORMULÁRIO */}
        <div className="space-y-6">
            
            {/* Bloco 1: Informações Pessoais */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                <h3 className="font-bold text-gray-400 text-xs uppercase flex items-center gap-2 mb-2 tracking-wider border-b border-gray-50 pb-2"><UserCircle size={14}/> Dados Pessoais</h3>
                <div>
                    <label className="text-xs font-bold text-gray-500 ml-1 uppercase">Nome Completo</label>
                    <input className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mt-1 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-medium text-gray-900" value={profile.nome_razao} onChange={e => setProfile({...profile, nome_razao: e.target.value})} placeholder="Seu nome"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 ml-1 uppercase">Telefone / WhatsApp</label>
                    <div className="relative">
                        <Phone size={18} className="absolute left-4 top-4 text-gray-400"/>
                        <input className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 mt-1 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-medium text-gray-900" value={profile.telefone} onChange={e => setProfile({...profile, telefone: e.target.value})}/>
                    </div>
                </div>
            </div>

            {/* Bloco 2: Habilidades & Serviços (SÓ PRESTADOR) - AQUI ESTÁ O QUE FALTOU! */}
            {isChapa && (
                <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-md space-y-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -z-0"></div>
                    <h3 className="font-bold text-blue-600 text-xs uppercase flex items-center gap-2 mb-2 tracking-wider border-b border-blue-100 pb-2 relative z-10"><Wrench size={14}/> Serviços Oferecidos</h3>
                    
                    <p className="text-xs text-gray-500 font-medium relative z-10">O que você faz? (Selecione todos que aplicar)</p>
                    
                    <div className="grid grid-cols-2 gap-3 relative z-10">
                        {PROFESSIONS.map((prof) => {
                            const isSelected = profile.skills.includes(prof.id);
                            return (
                                <button
                                    key={prof.id}
                                    type="button"
                                    onClick={() => toggleSkill(prof.id)}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-lg scale-[1.02]' : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-white hover:border-blue-200'}`}
                                >
                                    <div className={isSelected ? 'text-white' : 'text-gray-400'}>{prof.icon}</div>
                                    <span className="text-[10px] font-black text-center uppercase tracking-wide">{prof.label}</span>
                                    {isSelected && <div className="absolute top-2 right-2"><CheckCircle2 size={14} className="text-white"/></div>}
                                </button>
                            )
                        })}
                    </div>

                    <div className="relative z-10">
                        <label className="text-[10px] font-bold text-gray-400 ml-1 uppercase flex items-center gap-1"><FileText size={12}/> Resumo Profissional</label>
                        <textarea 
                            value={profile.bio} 
                            onChange={e => setProfile({...profile, bio: e.target.value})} 
                            className="w-full p-4 mt-2 bg-gray-50 rounded-xl border border-gray-200 font-medium text-gray-900 outline-none focus:border-blue-500 focus:bg-white min-h-[100px] text-sm resize-none" 
                            placeholder="Ex: Tenho 5 anos de experiência com mudanças e faço pequenos reparos elétricos."
                        />
                    </div>
                </div>
            )}

            {/* Bloco 3: Financeiro (SÓ PRESTADOR) */}
            {isChapa && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-green-600 text-xs uppercase flex items-center gap-2 mb-2 tracking-wider border-b border-gray-50 pb-2"><Wallet size={14}/> Recebimento</h3>
                    <div>
                        <label className="text-xs font-bold text-gray-500 ml-1 uppercase">Sua Chave PIX</label>
                        <input autoComplete="off" placeholder="CPF, Email, Telefone ou Aleatória" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 mt-1 focus:border-green-500 focus:bg-white outline-none transition-all text-sm font-medium text-gray-900" value={profile.chave_pix} onChange={e => setProfile({...profile, chave_pix: e.target.value})}/>
                    </div>
                </div>
            )}

            {/* Botão Salvar Principal */}
            <div className="sticky bottom-4 z-20">
                <button onClick={handleSave} disabled={saving} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl active:scale-[0.98]">
                    {saving ? <Loader2 className="animate-spin"/> : <><Save size={18}/> Salvar Perfil</>}
                </button>
            </div>

            {/* Bloco 4: Segurança */}
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100 mt-8 mb-8">
                <h3 className="font-bold text-red-500 text-xs uppercase flex items-center gap-2 mb-4 tracking-wider"><ShieldCheck size={14}/> Segurança</h3>
                <div className="flex gap-3">
                    <input type="password" placeholder="Nova senha" className="w-full bg-white border border-red-200 rounded-xl p-3 focus:border-red-400 outline-none transition-colors text-sm text-gray-900" value={newPassword} onChange={e => setNewPassword(e.target.value)}/>
                    <button onClick={handleUpdatePassword} disabled={updatingPassword} className="bg-red-100 text-red-600 font-bold px-5 rounded-xl border border-red-200 hover:bg-red-200 transition-colors text-xs whitespace-nowrap shadow-sm">
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