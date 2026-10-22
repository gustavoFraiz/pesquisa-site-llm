import Link from 'next/link';

export default function NavAdmin() {
  return (
    <nav className="nav-admin" aria-label="Administração">
      <Link href="/admin">Empresas</Link>
      <Link href="/admin/modelos">Modelos de cargo</Link>
      <Link href="/admin/catalogo">Catálogo</Link>
      <Link href="/admin/metricas">Métricas</Link>
    </nav>
  );
}
