@echo off
python scripts\check_parse.py > scripts\check_parse_output.txt 2>&1
exit /b %errorlevel%
