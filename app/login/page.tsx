'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, ArrowRight, ArrowLeft, KeyRound, Handshake, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot'>('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Autenticação Base
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !user) {
        throw new Error('E-mail ou senha incorretos.');
      }

      // 2. Busca perfil para roteamento inteligente
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tipo_usuario')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error(profileError);
      }

      toast.success('Login realizado com sucesso!');

      // Pequeno delay para a animação do toast
      setTimeout(() => {
        if (profile) {
          if (profile.tipo_usuario === 'PRESTADOR') {
            router.replace('/feed');
          } else {
            router.replace('/dashboard');
          }
        } else {
          // Se tem login mas não tem perfil, manda completar cadastro
          toast.info('Complete seu cadastro para continuar.');
          router.replace('/register');
        }
      }, 500);

    } catch (err: any) {
      toast.error(err.message || 'Erro ao tentar entrar.');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.warning('Digite seu e-mail para recuperar a senha.');
    
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`, 
    });

    if (error) {
      toast.error('Não foi possível enviar o email. Tente novamente.');
    } else {
      toast.success('Link de recuperação enviado para seu e-mail!');
      setView('login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gray-50 relative overflow-hidden">
      
      {/* Background Decorativo Suave (Light Mode) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-green-100/50 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Botão Voltar */}
        <Link href="/" className="inline-flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors text-sm font-bold">
          <ChevronLeft size={16} /> Voltar para Home
        </Link>

        <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xl transition-all duration-500 relative overflow-hidden">
          
          {/* CABEÇALHO */}
          <div className="text-center mb-8 relative z-10">
            <div className={`inline-flex p-3 rounded-2xl mb-4 shadow-sm border transition-colors duration-500 ${view === 'login' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
              {view === 'login' ? <Handshake size={32} className="text-green-600"/> : <KeyRound size={32} className="text-blue-600"/>}
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
              {view === 'login' ? 'Bem-vindo de volta' : 'Recuperar Senha'}
            </h1>
            <p className="text-gray-500 text-sm font-medium">
              {view === 'login' ? 'Acesse sua conta para continuar' : 'Enviaremos um link seguro para você'}
            </p>
          </div>

          {/* FORMULÁRIO LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300 relative z-10">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-green-600 transition-colors">
                  <Mail size={20} />
                </div>
                <input 
                  type="email" 
                  placeholder="Seu email" 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-green-500 focus:bg-white focus:ring-2 ring-green-100 transition-all placeholder:text-gray-400 font-medium"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-green-600 transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type="password"
                  placeholder="Sua senha" 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-green-500 focus:bg-white focus:ring-2 ring-green-100 transition-all placeholder:text-gray-400 font-medium"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => setView('forgot')} className="text-xs text-gray-500 hover:text-green-600 transition-colors font-bold">
                  Esqueceu a senha?
                </button>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-green-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" /> : <>Entrar <ArrowRight size={20}/></>}
              </button>
            </form>
          )}

          {/* FORMULÁRIO RECUPERAÇÃO */}
          {view === 'forgot' && (
            <form onSubmit={handleResetPassword} className="space-y-5 animate-in fade-in slide-in-from-left-8 duration-300 relative z-10">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <Mail size={20} />
                </div>
                <input 
                  type="email" 
                  autoFocus
                  placeholder="Digite seu email cadastrado" 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 ring-blue-100 transition-all placeholder:text-gray-400 font-medium"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Enviar Link de Recuperação'}
              </button>

              <button type="button" onClick={() => setView('login')} className="w-full text-gray-500 font-bold py-2 hover:text-gray-800 transition-colors flex items-center justify-center gap-2 text-sm">
                <ArrowLeft size={16}/> Voltar para o Login
              </button>
            </form>
          )}

          {/* RODAPÉ */}
          {view === 'login' && (
            <div className="mt-8 text-center pt-6 border-t border-gray-100 relative z-10">
              <p className="text-gray-500 text-sm font-medium">
                Ainda não tem conta? <Link href="/register" className="text-green-600 font-bold hover:underline">Criar conta gratuita</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}