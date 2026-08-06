@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ============================================================================
rem  Sube lo que haya en local y lo despliega en el VPS, de una tacada.
rem
rem  Se ejecuta con doble clic desde el Explorador, o escribiendo
rem  scripts\desplegar.bat en una terminal.
rem
rem  No hace nada que no pudieras hacer a mano: `git push` y luego el
rem  desplegar.sh del servidor por SSH. Existe porque son siempre los mismos dos
rem  pasos y el segundo es facil de olvidar, y olvidarlo no da ningun error:
rem  simplemente el servidor se queda con la version anterior y parece que tu
rem  cambio "no ha hecho nada".
rem
rem  El servidor se identifica por el dominio y no por la IP: es el mismo que ya
rem  resuelve a esa maquina, asi que no hay nada que configurar aqui ni ninguna
rem  IP que actualizar si algun dia cambia.
rem ============================================================================

set "VPS=kivuk@n8n.agenciakivuk.com"
set "REMOTO=bash ~/agencia-kivuk/scripts/desplegar.sh"

rem La ruta del .bat menos la carpeta scripts: la raiz del repositorio. Asi
rem funciona desde donde sea que lo llames.
cd /d "%~dp0.." || exit /b 1

echo.
echo === Desplegar Agencia Kivuk ===
echo.

where ssh >nul 2>&1
if errorlevel 1 (
  echo No encuentro el comando "ssh".
  echo.
  echo Windows 10 lo trae de serie, pero puede estar desactivado:
  echo   Ajustes ^> Aplicaciones ^> Caracteristicas opcionales ^> Cliente OpenSSH
  goto :fin
)

rem --- Nada a medias -----------------------------------------------------
rem Un archivo sin commitear no viaja en el push, asi que el servidor
rem desplegaria una version incompleta. Es mejor parar aqui que descubrirlo
rem media hora despues mirando por que no se aplica el cambio.
set "SUCIO="
for /f "delims=" %%i in ('git status --porcelain') do set "SUCIO=1"

if defined SUCIO (
  echo Tienes cambios sin guardar en git:
  echo.
  git status --short
  echo.
  echo Haz commit antes de desplegar:
  echo   git add -A
  echo   git commit -m "lo que has hecho"
  echo.
  echo Se despliega lo que esta en GitHub, no lo que tienes en el disco.
  goto :fin
)

rem --- Subir -----------------------------------------------------------------
echo [1/2] Subiendo a GitHub...
git push
if errorlevel 1 (
  echo.
  echo El push ha fallado. Mira el mensaje de arriba.
  goto :fin
)

rem --- Desplegar -------------------------------------------------------------
echo.
echo [2/2] Desplegando en el VPS...
echo       (si pide contrasena, es la del servidor)
echo.

ssh %VPS% "%REMOTO%"
if errorlevel 1 (
  echo.
  echo El despliegue ha fallado o la conexion se ha cortado.
  echo Puedes entrar a mirar con:  ssh %VPS%
  goto :fin
)

echo.
echo Listo.

:fin
echo.
pause
endlocal
