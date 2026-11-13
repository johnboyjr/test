@echo off
cd /d "%~dp0"
py -m pip show dolphin-memory-engine >nul 2>&1 || py -m pip install dolphin-memory-engine
py memwatch.py
pause
