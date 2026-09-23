#!/usr/bin/env python3
"""
parse_user_table.py

Parse a Word document (.docx, or legacy .doc via LibreOffice conversion)
that contains a table shaped like:

    #  | Full name        | Username    | OU hint                 | ...
    ---+-------------------+-------------+-------------------------+----
    1  | Ivan Petrenko     | ipetrenko   | Kyiv office / Sales dept
    2  | Anna Kovalenko-   | akovalenko  | Lviv office / IT dept
       | Shevchenko (*)    |             |

    (*) full_name may contain a hyphen and may wrap onto a second line
        inside the SAME cell - both are normalized into one clean string.

Only the first 3 data columns (after the numeric column) are used:
    1. full_name
    2. username
    3. ou_hint
Any additional columns in the table are ignored.

A row is never dropped just because some data is missing: a missing
full_name/username/ou_hint is recorded as "" and logged in "errors", and
parsing always carries on to the remaining rows - a problem on row 6 out
of 10 never stops rows 7-10 from being parsed.

Usage:
    python3 parse_user_table.py path/to/file.docx
    python3 parse_user_table.py path/to/file.docx --json out.json
    python3 parse_user_table.py path/to/file.doc          # auto-converted

Output (printed to stdout, and optionally saved with --json):
    {
      "users":  [ {"full_name": ..., "username": ..., "ou_hint": ...}, ... ],
      "errors": [ {"row": 4, "message": "Missing username in row 4"}, ... ]
    }
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from fastapi import HTTPException

try:
    import docx
except ImportError:
    sys.exit("python-docx is required: pip install python-docx --break-system-packages")


# Row-number cell may be a bare digit ("1"), or a digit prefixed with a
# common "number" marker: "№1", "№ 1", "#1", "No. 1" (case-insensitive).
NUMERIC_PREFIX_RE = re.compile(r"^\s*(?:№|#|no\.?)?\s*(\d+)", re.IGNORECASE)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


async def check_file(file):
    ALLOWED_EXTENSIONS = {".doc", ".docx"}
    ALLOWED_CONTENT_TYPES = {
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

    if not file.filename:
        raise HTTPException(400, "Filename is required")

    filename = file.filename.lower()

    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(400, "Only .doc and .docx files are allowed")

    extension = ".docx" if filename.endswith(".docx") else ".doc"

    if file.content_type != ALLOWED_CONTENT_TYPES[extension]:
        raise HTTPException(400, "Invalid file content type")

    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "File is too large")


def cell_text(cell) -> str:
    """Return a cell's text as one clean single-line string.

    python-docx joins a cell's paragraphs with '\\n', which is exactly how
    a name that wraps onto a second line *inside the same cell* shows up.
    We collapse all whitespace (newlines, tabs, non-breaking spaces, double
    spaces) down to single spaces and strip the ends.
    """
    raw = cell.text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", raw).strip()


def convert_doc_to_docx(src: Path) -> Path:
    """Best-effort conversion of a legacy binary .doc file to .docx using
    LibreOffice headless mode (python-docx cannot read .doc directly)."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        raise RuntimeError(
            f"'{src.name}' is a legacy .doc file and LibreOffice (soffice) "
            "is not installed in this environment, so it can't be "
            "auto-converted. Please re-save/export it as .docx and re-run."
        )
    tmpdir = Path(tempfile.mkdtemp(prefix="doc2docx_"))
    cmd = [
        soffice,
        "--headless",
        "--convert-to",
        "docx",
        "--outdir",
        str(tmpdir),
        str(src),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    converted = tmpdir / (src.stem + ".docx")
    if result.returncode != 0 or not converted.exists():
        raise RuntimeError(
            f"LibreOffice failed to convert '{src.name}' to .docx.\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return converted


def load_document(path: Path):
    suffix = path.suffix.lower()
    if suffix == ".doc":
        path = convert_doc_to_docx(path)
    elif suffix != ".docx":
        raise ValueError(
            f"Unsupported file extension '{path.suffix}'. Expected .doc or .docx."
        )
    return docx.Document(str(path))


def score_table(table) -> int:
    """How many rows in this table look like data rows (first cell starts
    with a number)? Used to pick the right table when a document has more
    than one (e.g. a metadata table plus the real user table)."""
    score = 0
    for row in table.rows:
        if row.cells and NUMERIC_PREFIX_RE.match(cell_text(row.cells[0])):
            score += 1
    return score


def pick_data_table(doc):
    """Return the table most likely to be the user table, or None."""
    tables = doc.tables
    if not tables:
        return None
    best = max(tables, key=score_table)
    return best if score_table(best) > 0 else tables[0]


# --------------------------------------------------------------------------
# Core parsing
# --------------------------------------------------------------------------


def parse_table(table):
    users = []
    errors = []
    seen_usernames = {}  # lowercased username -> row label where first seen

    rows = table.rows

    # Find where the data actually starts: the first row whose first cell
    # begins with a number. Everything above that - the header row, and
    # any title/banner row(s) above it (e.g. a merged "User List" cell
    # spanning the whole table) - is skipped unconditionally. This is more
    # robust than hardcoding "row 1 is the header", which breaks as soon
    # as there's a merged title bar above the real header.
    first_data_idx = None
    for idx, row in enumerate(rows, start=1):
        if row.cells and NUMERIC_PREFIX_RE.match(cell_text(row.cells[0])):
            first_data_idx = idx
            break

    if first_data_idx is None:
        # Not a single numbered row in this table - nothing to parse.
        return users, errors

    for physical_idx, row in enumerate(rows, start=1):
        if physical_idx < first_data_idx:
            continue  # header / title / banner rows - always skipped

        cells = row.cells

        def get(i: int) -> str:
            # Missing/short rows never abort parsing - a column that isn't
            # there is just treated as an empty cell.
            return cell_text(cells[i]) if i < len(cells) else ""

        if len(cells) < 4:
            errors.append(
                {
                    "row": physical_idx,
                    "message": (
                        f"Row {physical_idx} has only {len(cells)} column(s), "
                        "expected at least 4 - missing columns recorded as empty"
                    ),
                }
            )

        col0 = get(0)
        full_name = get(1)
        username = get(2)
        ou_hint = get(3)

        # Completely empty row (spacer row) - skip quietly.
        if not col0 and not full_name and not username and not ou_hint:
            continue

        # A horizontally-merged "banner"/divider row (e.g. a note spanning
        # the full table width) shows up as the SAME text repeated in
        # every grid cell python-docx reports for that row. That is not a
        # real data row, so flag it and skip rather than fabricating a
        # user whose full_name, username and ou_hint are all identical.
        if full_name and full_name == username == ou_hint:
            errors.append(
                {
                    "row": physical_idx,
                    "message": (
                        f"Row {physical_idx} looks like a merged banner/divider row "
                        f"(all columns contain the same text: '{full_name}') - skipped"
                    ),
                }
            )
            continue

        match = NUMERIC_PREFIX_RE.match(col0)
        if match:
            row_label = int(match.group(1))
        else:
            # No usable row number. If the row otherwise has no data either,
            # it's just a header/title row - skip quietly. If it DOES have
            # data, it's a genuine numbering problem - flag it and still
            # try to use the row (physical row index as fallback label).
            if not full_name and not username and not ou_hint:
                continue
            row_label = physical_idx
            errors.append(
                {
                    "row": row_label,
                    "message": f"Row {physical_idx}: first column is not a valid row number (got '{col0}')",
                }
            )

        if not full_name:
            errors.append(
                {"row": row_label, "message": f"Missing full_name in row {row_label}"}
            )
        if not username:
            errors.append(
                {"row": row_label, "message": f"Missing username in row {row_label}"}
            )
        if not ou_hint:
            errors.append(
                {"row": row_label, "message": f"Missing ou_hint in row {row_label}"}
            )

        if username:
            dup_key = username.lower()
            if dup_key in seen_usernames:
                errors.append(
                    {
                        "row": row_label,
                        "message": f"Duplicate username '{username}' in row {row_label} "
                        f"(first seen row {seen_usernames[dup_key]})",
                    }
                )
            else:
                seen_usernames[dup_key] = row_label

            if re.search(r"\s", username):
                errors.append(
                    {
                        "row": row_label,
                        "message": f"Username '{username}' in row {row_label} contains whitespace",
                    }
                )

        # Never exclude a row for missing data: whatever field(s) are
        # missing stay as "" and are already logged above in errors.
        # Parsing always continues on to the next row regardless.
        users.append(
            {
                "full_name": full_name,
                "username": username,
                "ou_hint": ou_hint,
            }
        )

    return users, errors


def parse_document(file) -> dict:
    try:
        # UploadFile.file is a file-like object
        doc = docx.Document(file)
    except Exception as exc:
        return {"users": [], "errors": [{"row": None, "message": str(exc)}]}

    table = pick_data_table(doc)
    if table is None:
        return {
            "users": [],
            "errors": [{"row": None, "message": "No table found in document"}],
        }

    users, errors = parse_table(table)
    return {"users": users, "errors": errors}
