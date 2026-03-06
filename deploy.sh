#!/bin/bash

# Script de deployment automático para Railway
# Asegúrate de tener Railway CLI instalado: npm i -g @railway/cli

echo "🚀 Iniciando deployment en Railway..."

# 1. Verificar que estamos en Railway
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI no está instalado"
    echo "Instala con: npm i -g @railway/cli"
    exit 1
fi

# 2. Verificar que hay cambios commiteados
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Tienes cambios sin commitear"
    read -p "¿Deseas commitear ahora? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Deploy to Railway $(date +%Y-%m-%d)"
    else
        echo "❌ Deployment cancelado"
        exit 1
    fi
fi

# 3. Push a Railway
echo "📤 Desplegando a Railway..."
railway up

echo "✅ Deployment completado"
echo "🔗 Verifica tu deployment en: https://railway.app"
