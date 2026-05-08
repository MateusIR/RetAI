import React, { useState } from 'react';

interface Props {
  onLogin: (token: string) => void;
}

export default function TelaAuth({ onLogin }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false); // Novo estado de sucesso

  // States do form
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [crm, setCrm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Formata o CPF: 000.000.000-00
  const formatCpf = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  };

  // Formata o CRM
  const formatCrm = (value: string) => {
    return value
      .toUpperCase()
      .replace(/[^0-9A-Z\-/-]/g, '')
      .slice(0, 15);
  };

  // Força da senha
  const evaluateStrength = (pw: string) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 6) s += 1;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s += 1;
    if (/[^A-Za-z0-9]/.test(pw)) s += 1;
    return s;
  };

  const strength = evaluateStrength(senha);
  const strengthText = strength === 0 ? '' : strength === 1 ? 'Fraca' : strength === 2 ? 'Média' : 'Forte';
  const strengthColor = strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : 'bg-emerald-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validações
    if (!isLogin) {
      if (cpf.length < 14) {
        setError('Por favor, insira um CPF válido e completo.');
        return;
      }
      if (crm.length < 4) {
        setError('Por favor, insira um CRM válido.');
        return;
      }
      if (senha.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', senha);

        const res = await fetch('http://localhost:8000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        
        if (!res.ok) throw new Error('E-mail ou senha incorretos');
        const data = await res.json();
        
        onLogin(data.access_token);
        
      } else {
        const res = await fetch('http://localhost:8000/api/medicos/registrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, cpf, crm, email, senha })
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Erro ao registrar médico (CPF ou E-mail em uso)');
        }
        
        // Removemos o alert e ativamos a tela de sucesso!
        setSenha(''); 
        setRegistrationSuccess(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 p-4">
      <div className="card w-full max-w-md p-8 animate-fade-in shadow-2xl border-surface-4">
        
        {/* Renderiza a tela de SUCESSO se a conta foi criada */}
        {registrationSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-20"></div>
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="font-display text-2xl font-bold text-white mb-2 text-center">
              Conta criada com sucesso!
            </h2>
            
            <p className="text-slate-400 text-sm mb-8 text-center px-4 leading-relaxed">
              Dr(a). <span className="text-slate-200 font-medium">{nome.split(' ')[0]}</span>, seu cadastro foi realizado. Agora você já pode acessar o sistema RetAI.
            </p>
            
            <button 
              onClick={() => {
                setRegistrationSuccess(false);
                setIsLogin(true); // Muda para a aba de login
              }} 
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base font-semibold"
            >
              Fazer Login
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        ) : (
          /* Renderiza o FORMULÁRIO PADRÃO caso não seja sucesso */
          <>
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-accent to-teal-accent flex items-center justify-center shadow-lg shadow-accent/25 mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-white">RetAI</h1>
              <p className="text-sm text-slate-500 mt-1">
                {isLogin ? 'Faça login para acessar o sistema' : 'Crie sua conta médica'}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg mb-6 text-center animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="animate-slide-up space-y-4">
                  <div>
                    <label className="label">Nome Completo</label>
                    <input 
                      required 
                      type="text" 
                      className="input-field" 
                      placeholder="Dr. Nome" 
                      maxLength={100}
                      value={nome} 
                      onChange={e => setNome(e.target.value)} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">CPF</label>
                      <input 
                        required 
                        type="text" 
                        className="input-field font-mono text-sm" 
                        placeholder="000.000.000-00" 
                        maxLength={14}
                        value={cpf} 
                        onChange={e => setCpf(formatCpf(e.target.value))} 
                      />
                    </div>
                    <div>
                      <label className="label">CRM</label>
                      <input 
                        required 
                        type="text" 
                        className="input-field font-mono text-sm" 
                        placeholder="123456-UF" 
                        maxLength={15}
                        value={crm} 
                        onChange={e => setCrm(formatCrm(e.target.value))} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="label">E-mail Profissional</label>
                <input 
                  required 
                  type="email" 
                  className="input-field" 
                  placeholder="dr@clinica.com" 
                  maxLength={255}
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>

              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <input 
                    required 
                    type={showPassword ? "text" : "password"} 
                    className="input-field pr-10" 
                    placeholder="••••••••" 
                    maxLength={72}
                    value={senha} 
                    onChange={e => setSenha(e.target.value)} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                
                {/* Força da senha (apenas visual e no cadastro) */}
                {!isLogin && senha.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 animate-fade-in">
                    <div className="flex-1 flex gap-1 h-1.5">
                      <div className={`flex-1 rounded-full ${strength >= 1 ? strengthColor : 'bg-surface-4'}`}></div>
                      <div className={`flex-1 rounded-full ${strength >= 2 ? strengthColor : 'bg-surface-4'}`}></div>
                      <div className={`flex-1 rounded-full ${strength >= 3 ? strengthColor : 'bg-surface-4'}`}></div>
                    </div>
                    <span className={`text-[10px] uppercase font-bold w-12 text-right ${strengthColor.replace('bg-', 'text-')}`}>
                      {strengthText}
                    </span>
                  </div>
                )}
              </div>

              <button disabled={loading} type="submit" className="btn-primary w-full mt-6 py-3 relative overflow-hidden group">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin text-white/70" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Aguarde...
                  </span>
                ) : (
                  isLogin ? 'Entrar no Sistema' : 'Cadastrar Médico'
                )}
              </button>
            </form>

            <div className="mt-6 text-center border-t border-surface-4 pt-4">
              <p className="text-sm text-slate-500">
                {isLogin ? "Não possui conta?" : "Já possui conta?"}
                <button 
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(''); setSenha(''); }}
                  className="ml-2 text-accent hover:text-accent-glow font-medium transition-colors"
                >
                  {isLogin ? 'Cadastre-se' : 'Faça login'}
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}