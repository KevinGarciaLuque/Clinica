# ============================================================
# Script PowerShell para Desplegar Migración 010 a Railway
# ============================================================

Write-Host "🚂 Desplegando Módulo de Consulta a Railway..." -ForegroundColor Cyan
Write-Host ""

# Verificar si Railway CLI está instalado
$railwayInstalled = Get-Command railway -ErrorAction SilentlyContinue

if (-not $railwayInstalled) {
    Write-Host "⚠️  Railway CLI no está instalado." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para instalar Railway CLI, ejecuta:" -ForegroundColor White
    Write-Host "npm install -g @railway/cli" -ForegroundColor Green
    Write-Host ""
    Write-Host "Después ejecuta este script nuevamente." -ForegroundColor White
    exit 1
}

Write-Host "✅ Railway CLI detectado" -ForegroundColor Green
Write-Host ""

# Verificar conexión a Railway
Write-Host "🔍 Verificando conexión a Railway..." -ForegroundColor Cyan
railway whoami

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  No estás autenticado en Railway." -ForegroundColor Yellow
    Write-Host "Ejecuta: railway login" -ForegroundColor Green
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "📋 Ejecutando migración 010..." -ForegroundColor Cyan
Write-Host ""

# Ejecutar la migración
railway run node backend/migrations/run-010.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ ¡Migración ejecutada exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 El módulo de Consulta ya debería estar disponible en:" -ForegroundColor Cyan
    Write-Host "   https://clinica-nine-xi.vercel.app" -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 Recarga la página (Ctrl+F5) para ver los cambios" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Error al ejecutar la migración" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternativa: Ejecuta el SQL manualmente en Railway:" -ForegroundColor Yellow
    Write-Host "1. Ve a https://railway.app/" -ForegroundColor White
    Write-Host "2. Abre tu proyecto" -ForegroundColor White
    Write-Host "3. Click en el servicio de MySQL" -ForegroundColor White
    Write-Host "4. Click en 'Query'" -ForegroundColor White
    Write-Host "5. Copia y pega el contenido de:" -ForegroundColor White
    Write-Host "   backend/migrations/RAILWAY_010_CONSULTA.sql" -ForegroundColor Green
}
