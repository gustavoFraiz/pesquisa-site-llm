"""Verifica barreiras de publicação e reversão sem acessar a VM."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

if os.name == 'posix':
    spec = importlib.util.spec_from_file_location('mrcc_deploy', Path(__file__).parent / 'deploy/mrcc-deploy-entry.py')
    deploy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deploy)


@unittest.skipUnless(os.name == 'posix', 'O publicador roda em Linux.')
class TestDeploy(unittest.TestCase):
    def test_chave_nao_permite_comando_arbitrario(self):
        with patch.dict(os.environ, {'SSH_ORIGINAL_COMMAND': 'echo invasao'}), patch.object(deploy, 'deploy') as publish:
            with self.assertRaises(ValueError):
                deploy.main()
            publish.assert_not_called()

    def test_commit_fora_da_main_nao_publica(self):
        with patch.object(deploy, 'fetch_main', return_value='b' * 40), patch.object(deploy, 'build') as build:
            deploy.deploy('a' * 40)
            build.assert_not_called()

    def test_destino_externo_nao_altera_current(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(ValueError):
                deploy.switch_current(Path(temporary))

    def test_falha_de_saude_restaura_versao_anterior(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            previous, candidate = base / 'previous', base / 'candidate'
            previous.mkdir()
            candidate.mkdir()
            current = base / 'current'
            current.symlink_to(previous, target_is_directory=True)
            maintenance = base / 'maintenance'
            with patch.object(deploy, 'BASE', base), patch.object(deploy, 'CURRENT', current), \
                 patch.object(deploy, 'MAINTENANCE', maintenance), patch.object(deploy, 'fetch_main', return_value='a' * 40), \
                 patch.object(deploy, 'build', return_value=candidate), patch.object(deploy, 'wait_idle'), \
                 patch.object(deploy, 'run'), patch.object(deploy, 'switch_current') as switch, \
                 patch.object(deploy, 'health', side_effect=[RuntimeError('indisponivel'), None]):
                with self.assertRaises(RuntimeError):
                    deploy.deploy('a' * 40)
                self.assertEqual([call.args[0] for call in switch.call_args_list], [candidate, previous])
                self.assertFalse(maintenance.exists())
                self.assertFalse((base / 'last-success.json').exists())


if __name__ == '__main__':
    unittest.main()
