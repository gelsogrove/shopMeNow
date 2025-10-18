# 🆘 EMERGENCY RECOVERY GUIDE

## Se i file data sono vuoti o danneggiati:

### Opzione 1: Usa il backup automatico

```bash
cd backend/prisma
cp -r data-backup-YYYYMMDD/* data/
```

### Opzione 2: Recupera da git

```bash
# Lista i commit con le modifiche ai data files
git log --oneline -- backend/prisma/data/

# Recupera da un commit specifico
git checkout <commit-hash> -- backend/prisma/data/
```

### Opzione 3: Backup manuale più recente

Cerca la cartella più recente:

```bash
ls -la backend/prisma/ | grep data-backup
```

## ⚠️ PRIMA DI FARE EXPORT

Il comando `npm run db:export` **SOVRASCRIVE** i file data!

**SEMPRE** verifica che il database contenga i dati corretti prima di esportare.

## 🛡️ Protezioni Implementate

1. ✅ Export crea backup automatico in `data-backup-YYYY-MM-DD/`
2. ✅ Seed verifica che i dati non siano vuoti prima di eseguire
3. ✅ Backup manuale in `data-backup-YYYYMMDD/`

## 📞 In caso di emergenza

Se tutto fallisce, contatta Andrea con questo messaggio:
"Dati seed persi! Ho bisogno del backup database o dei file data originali"
