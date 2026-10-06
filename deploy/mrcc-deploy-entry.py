#!/usr/bin/python3
"""Entrada SSH restrita: implanta apenas o commit atual da main do projeto."""
import fcntl
import json
import os
import re
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path('/home/ubuntu/mrcc-deploy')
REPOSITORY = BASE / 'repository.git'
RELEASES = BASE / 'releases'
CURRENT = BASE / 'current'
DATA = Path('/home/ubuntu/mrcc-pv/web/data')
MAINTENANCE = Path('/var/lib/mrcc-pv-deploy/maintenance')
REPO_URL = 'https://github.com/gustavoFraiz/pesquisa-site-llm.git'


def run(args, cwd=None, **kwargs):
    print('Executando:', ' '.join(map(str, args)), flush=True)
    return subprocess.run(args, cwd=cwd, check=True, **kwargs)


def git(*args):
    return subprocess.check_output(['git', '--git-dir', str(REPOSITORY), *args], text=True).strip()


def fetch_main():
    run(['git', '--git-dir', str(REPOSITORY), 'fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main'])
    return git('rev-parse', 'refs/remotes/origin/main')


def switch_current(target):
    target = target.resolve(strict=True)
    if target != Path('/home/ubuntu/mrcc-pv') and target.parent != RELEASES.resolve():
        raise ValueError('Destino fora do diretório de versões.')
    temporary = BASE / f'.current-{os.getpid()}'
    temporary.symlink_to(target, target_is_directory=True)
    try:
        temporary.replace(CURRENT)
    finally:
        temporary.unlink(missing_ok=True)


def wait_idle():
    deadline = time.monotonic() + 1200
    time.sleep(2)
    while True:
        active = subprocess.run(['pgrep', '-f', r'[w]eb_bridge.py (analise|llm)'], capture_output=True)
        if active.returncode == 1:
            return
        if active.returncode != 0:
            raise RuntimeError('Não foi possível verificar gerações ativas.')
        if time.monotonic() >= deadline:
            raise RuntimeError('A geração atual não terminou; mantendo a versão anterior.')
        print('Aguardando geração atual antes de reiniciar.', flush=True)
        time.sleep(10)


def health(expected_sha=None):
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=5) as response:
                result = json.load(response)
            if result.get('online') and result.get('modelReady') and (expected_sha is None or result.get('release') == expected_sha):
                return
        except (OSError, ValueError):
            pass
        time.sleep(2)
    raise RuntimeError('A aplicação não passou na verificação de saúde.')


def build(sha):
    release = RELEASES / sha
    if release.exists():
        if (release / '.ready').exists():
            return release
        # Uma tentativa interrompida é preservada para inspeção.
        release.rename(RELEASES / f'{sha}-failed-{time.time_ns()}')
    release.mkdir(mode=0o700)
    with tempfile.TemporaryFile() as archive:
        run(['git', '--git-dir', str(REPOSITORY), 'archive', '--format=tar', sha], stdout=archive)
        archive.seek(0)
        with tarfile.open(fileobj=archive) as package:
            package.extractall(release, filter='data')
    if (release / 'web/data').exists():
        raise RuntimeError('O código versionado não pode conter dados de sessões.')
    (release / 'web/data').symlink_to(DATA, target_is_directory=True)
    run(['/usr/bin/python3', '-m', 'venv', str(release / '.venv')])
    python = str(release / '.venv/bin/python')
    run(['nice', '-n', '10', python, '-m', 'pip', 'install', '-r', 'requirements.txt'], cwd=release)
    run([python, '-m', 'unittest', 'test_recomendar', 'test_web_bridge', 'test_deploy'], cwd=release)
    smoke = '''import tempfile
from pathlib import Path
import web_bridge
from relatorio_pdf import gerar_pdf
with tempfile.TemporaryDirectory() as temporary:
    folder = Path(temporary)
    web_bridge.processar(web_bridge.entrada_da_planilha(web_bridge.TEMPLATE), folder, 'analise')
    assert gerar_pdf(folder).read_bytes().startswith(b'%PDF-')
'''
    run([python, '-c', smoke], cwd=release)
    env = {**os.environ, 'NEXT_TELEMETRY_DISABLED': '1', 'NODE_ENV': 'development', 'CI': 'true'}
    run(['nice', '-n', '10', '/usr/local/bin/npm', 'ci', '--no-audit', '--no-fund'], cwd=release / 'web', env=env)
    run(['nice', '-n', '10', '/usr/local/bin/npm', 'run', 'build'], cwd=release / 'web', env=env)
    (release / '.release.env').write_text(f'MRCC_DEPLOY_SHA={sha}\n')
    (release / '.ready').write_text(sha)
    return release


def deploy(sha):
    if fetch_main() != sha:
        print('Commit substituído por uma main mais recente; publicação ignorada.', flush=True)
        return
    if (CURRENT / '.ready').exists() and (CURRENT / '.ready').read_text().strip() == sha:
        health(sha)
        print('Esta versão já está publicada.', flush=True)
        return
    previous = CURRENT.resolve(strict=True)
    release = build(sha)
    if fetch_main() != sha:
        print('A main avançou durante o build; publicação ignorada.', flush=True)
        return
    switched = False
    MAINTENANCE.write_text(sha)
    try:
        wait_idle()
        switch_current(release)
        switched = True
        run(['sudo', '/usr/bin/systemctl', 'restart', 'mrcc-pv'])
        health(sha)
        (BASE / 'last-success.json').write_text(json.dumps({'sha': sha, 'previous': str(previous), 'published_at': datetime.now(timezone.utc).isoformat()}, indent=2))
        print(f'Publicado e verificado: {sha}', flush=True)
    except Exception:
        if switched:
            print('Restaurando a versão anterior.', flush=True)
            switch_current(previous)
            run(['sudo', '/usr/bin/systemctl', 'restart', 'mrcc-pv'])
            health()
        raise
    finally:
        MAINTENANCE.unlink(missing_ok=True)


def main():
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    if command == 'status':
        print(json.dumps({'current': str(CURRENT.resolve()), 'maintenance': MAINTENANCE.exists()}))
        return
    match = re.fullmatch(r'deploy ([0-9a-f]{40})', command)
    if not match:
        raise ValueError('Comando permitido: deploy SHA completo, ou status.')
    with (BASE / '.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy(match[1])


if __name__ == '__main__':
    def interrupted(signum, frame):
        raise RuntimeError(f'Publicação interrompida por sinal {signum}.')

    for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(signum, interrupted)
    os.umask(0o077)
    try:
        main()
    except Exception as error:
        print(f'Publicação falhou: {error}', file=sys.stderr, flush=True)
        sys.exit(1)
