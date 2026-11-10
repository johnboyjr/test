@echo off
cd /d "%~dp0"
title DDR II PC (close this window to quit)
python server.py
if errorlevel 9009 py server.py
if errorlevel 1 pause
