import { redirect } from 'next/navigation';
import FormularioLogin from '@/components/auth/FormularioLogin';
import { destinoInicial, usuarioAtual } from '@/lib/sessao-web';

export default async function Login() {
  const usuario = await usuarioAtual();
  if (usuario) redirect(destinoInicial(usuario));
  return <main className="auth-shell"><FormularioLogin /></main>;
}
