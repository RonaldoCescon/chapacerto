'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Truck, Users, ArrowRight, Loader2, Smartphone, CheckCircle, LogIn } from 'lucide-react';
import Link from 'next/link';

// --- NOVO: IMPORTAR O COMPONENTE DO BANNER ---
import InstallBanner from './components/InstallBanner';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkRedirect = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 4000)
        );

        const sessionPromise = async () => {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (session) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('tipo_usuario')
              .eq('id', session.user.id)
              .single();

            if (profile && isMounted) {
              if (profile.tipo_usuario === 'PRESTADOR') {
                router.replace('/feed');
              } else {
                router.replace('/dashboard');
              }
              return true; 
            }
          }
          return false; 
        };

        await Promise.race([sessionPromise(), timeoutPromise]);

      } catch (error) {
        console.error("Verificação inicial:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkRedirect();

    return () => { isMounted = false; };
  }, [router]);

  // TELA DE LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-green-100 blur-xl rounded-full animate-pulse" />
          <Loader2 className="animate-spin text-green-600 relative z-10" size={50} />
        </div>
        <p className="text-gray-500 text-sm font-medium tracking-wide animate-pulse">
          Carregando ChapaCerto...
        </p>
      </div>
    );
  }

  // --- LANDING PAGE ---
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-[#F8FAFC] text-gray-900 overflow-hidden font-sans">
      
      {/* BACKGROUND GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      {/* DECORAÇÃO DE FUNDO */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-green-100/50 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>

      {/* --- CABEÇALHO SUPERIOR --- */}
      <nav className="absolute top-0 left-0 w-full p-6 flex items-center z-20 animate-in fade-in slide-in-from-top-4 duration-700">
        
        {/* Logo Pequeno */}
        <div className="font-bold text-gray-400 text-xs tracking-widest uppercase hidden md:block">
            Plataforma Oficial
        </div>

        {/* Botão Entrar */}
        <Link 
            href="/login" 
            className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 text-sm font-bold hover:bg-white hover:text-green-600 hover:border-green-200 hover:shadow-md transition-all duration-300"
        >
            <LogIn size={16} />
            Entrar
        </Link>
      </nav>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center mt-10 md:mt-0 text-center">
        
        {/* HEADER PRINCIPAL */}
        <div className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-bold mb-8 shadow-sm">
            <CheckCircle size={14} className="text-green-600"/> Sem Burocracia • <Smartphone size={14} className="text-blue-600 ml-1"/> App Fácil
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight text-gray-900 drop-shadow-sm text-center">
            Chapa<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">Certo</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-500 max-w-xl mx-auto leading-relaxed font-medium text-center">
            Conectando quem precisa de força <br className="hidden md:block"/>
            com quem tem disposição para trabalhar.
          </p>
        </div>

        {/* CARDS DE AÇÃO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl mb-12 text-left">
          
          {/* CARD 1: CONTRATANTE */}
          <Link 
            href="/register?type=contratante" 
            className="group relative flex flex-col p-8 rounded-3xl bg-white border border-gray-100 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.15)] hover:border-blue-200 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="relative z-10">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 group-hover:scale-110 transition-transform duration-300">
                <Truck size={28} className="text-blue-600" />
              </div>
              
              <h2 className="text-2xl font-bold mb-2 text-gray-900 group-hover:text-blue-600 transition-colors">
                Quero Contratar
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6 font-medium">
                Publique sua carga, defina o local e encontre ajudantes avaliados em minutos.
              </p>
              
              <div className="mt-auto flex items-center gap-2 text-sm font-bold text-blue-600 group-hover:gap-3 transition-all">
                Criar conta Empresa/PF <ArrowRight size={16}/>
              </div>
            </div>
          </Link>

          {/* CARD 2: PRESTADOR */}
          <Link 
            href="/register?type=prestador"
            className="group relative flex flex-col p-8 rounded-3xl bg-white border border-gray-100 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(22,163,74,0.15)] hover:border-green-200 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="relative z-10">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 border border-green-100 group-hover:scale-110 transition-transform duration-300">
                <Users size={28} className="text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold mb-2 text-gray-900 group-hover:text-green-600 transition-colors">
                Sou Chapa
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6 font-medium">
                Receba ofertas de serviço no seu celular, negocie e receba na hora.
              </p>
              
              <div className="mt-auto flex items-center gap-2 text-sm font-bold text-green-600 group-hover:gap-3 transition-all">
                Começar a trabalhar <ArrowRight size={16}/>
              </div>
            </div>
          </Link>

        </div>

        {/* RODAPÉ */}
        <div className="text-gray-400 text-xs font-medium pb-8 opacity-60 hover:opacity-100 transition-opacity">
           © 2026 ChapaCerto. Todos os direitos reservados.
        </div>

      </div>

      {/* --- NOVO: BANNER DE INSTALAÇÃO (FLUTUANTE) --- */}
      <InstallBanner />

    </main>
  )
}