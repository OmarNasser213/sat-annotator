@echo off
echo Building SAT Annotator Frontend...
echo.

echo Checking for web directory...
if not exist "web" (
    echo Error: web directory not found!
    pause
    exit /b 1
)

cd web

echo Frontend files are ready!
echo.
echo To run the application:
echo 1. Start the backend: uvicorn app.main:app --reload
echo 2. Visit: http://localhost:8000
echo.
echo The frontend will be served automatically by FastAPI.
echo.

pause
