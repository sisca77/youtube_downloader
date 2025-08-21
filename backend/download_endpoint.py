# main.py에 추가할 다운로드 엔드포인트

@app.get("/api/download/{task_id}")
async def download_file(task_id: str):
    """다운로드된 파일 제공"""
    from fastapi.responses import FileResponse
    
    task_status = youtube_service.get_task_status(task_id)
    
    if not task_status or task_status.get("status") != "completed":
        raise HTTPException(status_code=404, detail="File not found or processing not completed")
    
    file_path = task_status.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # 파일명 생성
    metadata = task_status.get("metadata", {})
    title = metadata.get("title", "youtube_video")
    # 특수문자 제거
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
    file_ext = Path(file_path).suffix
    filename = f"{safe_title}{file_ext}"
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )

