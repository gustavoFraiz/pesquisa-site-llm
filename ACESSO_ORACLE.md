# Acesso SSH à instância Oracle

Conexão verificada: usuário `ubuntu`, IP `147.15.89.156`, Ubuntu 22.04.5 LTS, arquitetura `aarch64`, dois núcleos e aproximadamente 11,65 GiB de RAM.

No PowerShell:

```powershell
Set-Location 'E:\llm-projeto'
ssh -F .\.ssh\config oracle-mrcc
```

Para executar um comando sem abrir sessão interativa:

```powershell
ssh -F .\.ssh\config oracle-mrcc uname -m
```

O agente pode usar a mesma configuração para executar comandos remotos. `sudo` sem senha foi verificado. A aplicação já está instalada; consulte [SITE_WEB.md](SITE_WEB.md) para acesso e manutenção.

A chave privada permanece em `sshkey`; suas permissões foram restringidas ao usuário atual do Windows. O SDDL anterior foi guardado em `.ssh/sshkey-acl-original.txt`. A identidade do servidor foi registrada em `.ssh/known_hosts` na primeira conexão e as conexões seguintes exigem correspondência com essa identidade. A chave e a pasta `.ssh` estão no `.gitignore`.

No diagnóstico inicial, o Minecraft ocupava aproximadamente 8,23 GiB de memória residente. Ele foi parado com salvamento dos mundos, conforme autorizado. Node.js, Ollama, Nginx e o site Next.js foram instalados depois desse diagnóstico.
