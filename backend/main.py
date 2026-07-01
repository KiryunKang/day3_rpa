"""개발 서버 실행 진입점: `uv run main.py` 또는 `uv run dev`."""

import uvicorn


def main() -> None:
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
