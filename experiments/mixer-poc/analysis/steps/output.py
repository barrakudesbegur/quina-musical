"""Writing outputs so that re-runs are idempotent: a file whose content would not change is left alone
(same bytes, same mtime), and every write is atomic (a reader such as the relay never sees half a file)."""
from __future__ import annotations

import copy
import json
import os
from collections.abc import Callable
from pathlib import Path


def write_text_if_changed(path: Path, text: str) -> bool:
    """Write `text` atomically unless the file already holds exactly it. Returns whether it wrote."""
    try:
        if path.read_text() == text:
            return False
    except (OSError, UnicodeDecodeError):
        pass
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp{os.getpid()}")
    tmp.write_text(text)
    os.replace(tmp, path)
    return True


def write_json_stable(path: Path, doc: dict, dumps: Callable[[dict], str], stamp: tuple[str, ...]) -> bool:
    """Write `doc` with `dumps`, unless the file already holds the same document apart from the timestamp
    at key path `stamp` (e.g. ("analysis", "createdAt")): then the old file, and its timestamp, stay.
    Returns whether it wrote."""
    try:
        old_text = path.read_text()
        old = json.loads(old_text)
    except (OSError, ValueError):
        return write_text_if_changed(path, dumps(doc))
    old_stamp = _get(old, stamp)
    if old_stamp is not None and _get(doc, stamp) is not None:
        candidate = copy.deepcopy(doc)
        _set(candidate, stamp, old_stamp)
        if dumps(candidate) == old_text:
            return False
    return write_text_if_changed(path, dumps(doc))


def _get(doc: object, keys: tuple[str, ...]) -> object:
    for key in keys:
        if not isinstance(doc, dict) or key not in doc:
            return None
        doc = doc[key]
    return doc


def _set(doc: dict, keys: tuple[str, ...], value: object) -> None:
    for key in keys[:-1]:
        doc = doc[key]
    doc[keys[-1]] = value
