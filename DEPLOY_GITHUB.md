# Publicação pelo GitHub

Repositório: https://github.com/gustavoFraiz/pesquisa-site-llm

## Fluxo

1. Crie uma branch e envie suas alterações.
2. Abra um PR para `main`.
3. O workflow **Validar projeto** verifica Python, regras de publicação, geração de PDF, TypeScript e build do Next.js.
4. Revise e mescle o PR quando **Verificar projeto** estiver aprovado.
5. Depois da validação do commit na `main`, **Publicar na Oracle** atualiza a VM automaticamente.

A `main` exige PR, o check **Verificar projeto**, atualização com a base e resolução das conversas. As regras incluem o administrador; force push e exclusão estão bloqueados. O PR não exige uma aprovação de outra pessoa, permitindo que o proprietário revise e mescle suas próprias alterações.

Exemplo no PowerShell:

```powershell
git switch main
git pull --ff-only
git switch -c melhoria/minha-alteracao
# Edite os arquivos.
git add .
git commit -m "Descreve a melhoria"
git push -u origin melhoria/minha-alteracao
```

Abra o PR pela página do repositório. Acompanhe as execuções em [Actions](https://github.com/gustavoFraiz/pesquisa-site-llm/actions). O deploy também pode ser repetido manualmente no workflow **Publicar na Oracle**, selecionando `main`.

## Funcionamento na VM

- Código ativo: `/home/ubuntu/mrcc-deploy/current`, um link para a versão publicada.
- Versões: `/home/ubuntu/mrcc-deploy/releases/<SHA>`; cada versão tem dependências e build próprios.
- Banco e arquivos de sessões: `/home/ubuntu/mrcc-pv/web/data`, compartilhados entre versões.
- Instalação original: `/home/ubuntu/mrcc-pv`, preservada como versão inicial e armazenamento das sessões.
- Publicador instalado: `/usr/local/bin/mrcc-deploy-entry`, propriedade de root.

O publicador baixa somente a `main` do repositório fixo e aceita apenas seu SHA atual. Prepara e testa a nova versão antes de trocar o link do código ativo. Durante a troca, novas análises recebem um aviso temporário; gerações em andamento têm até 20 minutos para terminar. O build usa prioridade de CPU reduzida.

Após reiniciar o serviço, o publicador confere site, modelo disponível e SHA em `/api/health`. Se essa verificação falhar, restaura o link anterior e reinicia a versão anterior. Se o build ou a espera falharem, o código ativo é mantido. A reversão é do código; alterações futuras no esquema do banco precisam manter compatibilidade com a versão anterior.

As versões anteriores ficam disponíveis para inspeção e reversão; acompanhe o espaço em disco antes de acumular muitas publicações. Nenhuma atualização substitui ou exporta o banco de sessões.

## Credencial de publicação

O ambiente GitHub **production** permite apenas a branch `main`. Os secrets `ORACLE_SSH_KEY` e `ORACLE_KNOWN_HOSTS` guardam uma chave exclusiva para publicação e a identidade SSH já verificada da VM.

A chave usa uma entrada SSH com comando forçado e restrições de encaminhamento/terminal. Permite apenas `deploy <SHA>` e `status`; a chave de administração original não foi enviada ao GitHub. Chaves, dados de sessões e modelos Ollama ficam fora do Git.

Os scripts e configurações de sistema em `deploy/` documentam a instalação. Alterar esses arquivos no repositório não reinstala automaticamente Nginx, systemd ou o publicador root; mudanças de infraestrutura devem ser aplicadas por SSH administrativo. O deploy automático atualiza a aplicação.

## Manutenção

```bash
readlink -f /home/ubuntu/mrcc-deploy/current
cat /home/ubuntu/mrcc-deploy/last-success.json
sudo systemctl status mrcc-pv --no-pager
sudo journalctl -u mrcc-pv -n 80 --no-pager
df -h /home/ubuntu
```

Em uma interrupção abrupta que deixe o aviso de manutenção ativo, confirme que não há publicador rodando antes de remover `/var/lib/mrcc-pv-deploy/maintenance`. O arquivo não contém respostas da pesquisa.
