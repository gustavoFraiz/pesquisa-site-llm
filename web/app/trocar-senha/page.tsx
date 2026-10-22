import FormularioSenha from '@/components/auth/FormularioSenha';
import { exigirPagina } from '@/lib/sessao-web';

export default async function TrocarSenha() {
  const usuario = await exigirPagina({ permitirTrocaPendente: true });
  return <main className="auth-shell"><FormularioSenha primeiroAcesso={usuario.trocarSenha} /></main>;
}
