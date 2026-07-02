"""엑셀 업무자동화 API 라우터 — 컬럼 기준 분할 / 다중 파일 병합."""

import io
import re
import zipfile
from urllib.parse import quote

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.db import get_connection

router = APIRouter(prefix="/api/excel", tags=["excel"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_BYTES = 20 * 1024 * 1024  # 20MB


def _read_excel(upload: UploadFile) -> pd.DataFrame:
    """업로드된 엑셀을 DataFrame으로 읽는다(.xlsx 전용)."""
    if not upload.filename or not upload.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=422, detail=f"엑셀 파일(.xlsx)만 지원합니다: {upload.filename}")
    data = upload.file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="파일이 20MB를 초과합니다.")
    try:
        return pd.read_excel(io.BytesIO(data), engine="openpyxl")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"엑셀을 읽을 수 없습니다: {e}") from e


def _content_disposition(filename: str) -> str:
    """한글 등 non-ASCII 파일명을 RFC 5987로 인코딩(헤더는 latin-1만 허용)."""
    ascii_name = filename.encode("ascii", "ignore").decode() or "download.xlsx"
    quoted = quote(filename)
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quoted}"


def _safe_sheet_name(value: str) -> str:
    """엑셀 시트명 제약(31자, 특수문자)에 맞게 정리."""
    name = re.sub(r"[\[\]\*\?/\\:]", "_", str(value)).strip() or "sheet"
    return name[:31]


def _record_job(job_type: str, source_files: str, key_column: str | None, rows: int) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO excel_jobs (job_type, source_files, key_column, row_count) VALUES (?, ?, ?, ?)",
            (job_type, source_files, key_column, rows),
        )
        conn.commit()


@router.post("/preview")
def preview(file: UploadFile = File(...)) -> dict:
    """업로드 파일의 컬럼 목록과 상위 몇 행을 반환한다."""
    df = _read_excel(file)
    return {
        "filename": file.filename,
        "columns": [str(c) for c in df.columns],
        "row_count": int(len(df)),
        "preview": df.head(5).astype(str).to_dict(orient="records"),
    }


@router.post("/split")
def split(
    file: UploadFile = File(...),
    key_column: str = Form(...),
    output: str = Form("sheets"),  # "sheets" (단일파일 다중시트) | "zip" (파일 여러 개)
) -> StreamingResponse:
    """기준 컬럼값별로 데이터를 분리한다."""
    df = _read_excel(file)
    if key_column not in df.columns:
        raise HTTPException(status_code=422, detail=f"컬럼 '{key_column}' 이 없습니다. 사용 가능: {list(df.columns)}")

    groups = list(df.groupby(df[key_column].fillna("(빈값)")))
    if not groups:
        raise HTTPException(status_code=422, detail="분할할 데이터가 없습니다.")

    base = re.sub(r"\.(xlsx|xls)$", "", file.filename or "result", flags=re.I)
    _record_job("split", file.filename or "", key_column, len(df))

    if output == "zip":
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for value, group in groups:
                part = io.BytesIO()
                with pd.ExcelWriter(part, engine="openpyxl") as writer:
                    group.to_excel(writer, index=False, sheet_name=_safe_sheet_name(value))
                zf.writestr(f"{base}_{_safe_sheet_name(value)}.xlsx", part.getvalue())
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": _content_disposition(f"{base}_split.zip")},
        )

    # 단일 파일, 값별 시트
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        used = set()
        for value, group in groups:
            name = _safe_sheet_name(value)
            # 시트명 중복 방지
            original, i = name, 1
            while name in used:
                name = f"{original[:28]}_{i}"
                i += 1
            used.add(name)
            group.to_excel(writer, index=False, sheet_name=name)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": _content_disposition(f"{base}_split.xlsx")},
    )


@router.post("/merge")
def merge(files: list[UploadFile] = File(...)) -> StreamingResponse:
    """여러 엑셀을 행 방향으로 병합한다(헤더 정합성 검사)."""
    if len(files) < 2:
        raise HTTPException(status_code=422, detail="병합하려면 2개 이상의 파일이 필요합니다.")

    frames: list[pd.DataFrame] = []
    header: list[str] | None = None
    names: list[str] = []
    for f in files:
        df = _read_excel(f)
        cols = [str(c) for c in df.columns]
        if header is None:
            header = cols
        elif cols != header:
            raise HTTPException(
                status_code=422,
                detail=f"헤더가 일치하지 않습니다. 기준={header}, '{f.filename}'={cols}",
            )
        frames.append(df)
        names.append(f.filename or "")

    merged = pd.concat(frames, ignore_index=True)
    _record_job("merge", ", ".join(names), None, len(merged))

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        merged.to_excel(writer, index=False, sheet_name="merged")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": _content_disposition("merged.xlsx")},
    )


@router.get("/jobs")
def list_jobs() -> list[dict]:
    """엑셀 처리 이력."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, job_type, source_files, key_column, row_count, created_at "
            "FROM excel_jobs ORDER BY id DESC LIMIT 50"
        ).fetchall()
    return [dict(r) for r in rows]
