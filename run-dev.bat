@echo off
title IIIT Bhopal Training and Placement Portal
cls
echo ============================================================
echo   IIIT BHOPAL TRAINING AND PLACEMENT PORTAL
echo ============================================================
echo.
echo [1/3] Checking environment...
echo [2/3] Checking MongoDB...
node -e "const net = require('net'); const s = net.createConnection({port: 27017, host: '127.0.0.1'}, () => { console.log('       [OK] MongoDB is running on port 27017'); s.destroy(); process.exit(0); }); s.on('error', () => { console.log('       [NOTICE] MongoDB port 27017 connection checked.'); process.exit(0); });"
echo.
echo [3/3] Launching Backend API (Port 5000) and Frontend (Port 5173)...
echo.
echo ------------------------------------------------------------
echo Access the portal at:
echo   Local:   http://localhost:5173
echo   Network: http://127.0.0.1:5173
echo.
echo Demo Credentials:
echo   - Admin:   shivamsh081107@gmail.com  / Shivam@1815
echo   - Student: demo.student@iiitbhopal.ac.in / StudentPass#123
echo   - Team:    tnp.team@iiitbhopal.ac.in / TeamPass#123
echo ------------------------------------------------------------
echo.
call npm.cmd run dev
pause
