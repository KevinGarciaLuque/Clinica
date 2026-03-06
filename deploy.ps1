# Script de deployment automático para Railway (Windows)
# Asegúrate de tener Railway CLI instalado: npm i -g @railway/cli

Write-Host "🚀 Iniciando deployment en Railway..." -ForegroundColor Cyan

# 1. Verificar que Railway CLI está instalado
if (!(Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Railway CLI no está instalado" -ForegroundColor Red
    Write-Host "Instala con: npm i -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

# 2. Verificar que hay cambios commiteados
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  Tienes cambios sin commitear" -ForegroundColor Yellow
    $response = Read-Host "¿Deseas commitear ahora? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        git add .
        $date = Get-Date -Format "yyyy-MM-dd HH:mm"
        git commit -m "Deploy to Railway $date"
    } else {
        Write-Host "❌ Deployment cancelado" -ForegroundColor Red
        exit 1
    }
}

# 3. Push a Railway
Write-Host "📤 Desplegando a Railway..." -ForegroundColor Cyan
railway up

Write-Host "✅ Deployment completado" -ForegroundColor Green
Write-Host "🔗 Verifica tu deployment en: https://railway.app" -ForegroundColor Cyan
