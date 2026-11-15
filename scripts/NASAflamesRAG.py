#!/usr/bin/env python3
"""NASA PSI combustion-science corpus for Ask IGNIS.

Builds a small, citable retrieval corpus from the NASA Physical Sciences
Informatics (PSI) repository and searches it locally with BM25. The corpus is
read by the IGNIS web app (src/lib/rag) to ground research answers.

Usage
  python scripts/NASAflamesRAG.py build  [--out PATH] [--delay SECONDS]
  python scripts/NASAflamesRAG.py check  [--corpus PATH]
  python scripts/NASAflamesRAG.py query  "Which investigations studied cool flames?" [-k 5]
                                         [--extractive] [--embed] [--corpus PATH]

build   Fetches every PSI investigation filed under Research Area "combustion
        science" (search endpoint), then each record's public detail. Writes
        src/data/rag/psi-combustion-corpus.json: record metadata, plain-text
        objective/hypothesis/approach/research impacts, publications, data-file
        counts and pre-split passages ("chunks") of roughly 120-220 words.
        Only public record fields are kept. Contact details (email, phone,
        address, affiliation) are never written; investigator names are limited
        to contacts holding the Principal Investigator role.
check   Validates the corpus schema, privacy rules and size, and prints counts.
query   Ranks passages with BM25 (pure Python, no model download) and prints
        the best passages with accession and record URL. When GROQ_API_KEY is
        set (and --extractive is not given) it also asks the Groq OpenAI-compatible endpoint for an
        answer restricted to those passages; citations outside the retrieved set
        are rejected and the extractive answer is shown instead. --embed re-ranks
        with sentence-transformers when that package happens to be installed;
        BM25 alone is the default and is sufficient.

Requires: Python 3.10+, requests.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

SEARCH_URL = "https://psi.nasa.gov/geode-py/ws/repo/search"
DETAIL_URL = "https://psi.nasa.gov/geode-py/ws/repo/investigations/{id}"
# Public record page; the same pattern as psiUrl() in src/data/research/investigations.ts.
PUBLIC_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{id}"
SEARCH_PARAMS = {
    "source": "psi",
    "type": "investigation",
    "from": 0,
    "size": 100,
    "sort": "Public Release Date",
    "order": "desc",
    "ffield": "Research Area",
    "fvalue": "combustion science",
}
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CORPUS = REPO_ROOT / "src" / "data" / "rag" / "psi-combustion-corpus.json"
SCHEMA_VERSION = 1
MAX_CORPUS_BYTES = 600_000

TEXT_FIELDS = ("objective", "hypothesis", "approach", "researchImpacts")
CHUNK_FIELDS = ("overview",) + TEXT_FIELDS + ("publications",)
CHUNK_MIN_WORDS, CHUNK_MAX_WORDS, CHUNK_HARD_MAX = 120, 220, 260

HEADERS = {"Accept": "application/json", "User-Agent": "IGNIS-corpus-builder/1"}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b")
# Links and bare domains ("ntrs.nasa.gov") are not allowed in generated answers; same rule as URL_LIKE in ignis-chat.ts.
URL_LIKE = re.compile(r"https?://|www\.|\]\(|```|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:gov|com|org|net|edu|mil|int|io|ai|dev|app|info|co|uk|us|eu)\b", re.I)


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

def get_json(session: requests.Session, url: str, params: dict | None = None,
             attempts: int = 4, timeout: float = 30.0) -> Any:
    """GET with a timeout and exponential backoff on network errors, 429 and 5xx."""
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            response = session.get(url, params=params, timeout=timeout)
            if response.status_code == 429 or response.status_code >= 500:
                raise requests.HTTPError(f"HTTP {response.status_code}")
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as error:
            last = error
            if attempt < attempts - 1:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"{url}: {last}")


# --------------------------------------------------------------------------
# Normalization
# --------------------------------------------------------------------------

def clean_text(value: Any) -> str:
    """Plain text from a PSI field: HTML removed, entities decoded, contacts stripped."""
    if value is None:
        return ""
    if isinstance(value, list):
        value = " ".join(str(v) for v in value if v)
    text = str(value)
    text = re.sub(r"(?i)<\s*(br|/p|/li|/div|/h\d)\s*/?>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = EMAIL_RE.sub("", text)
    text = PHONE_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def format_person(person: Any) -> list[str]:
    """Names from the search record's Person field.

    PSI returns it as a dict of strings (one person), a dict of parallel arrays
    (several people), a dict of space-joined parallel strings, or a list of
    dicts. Parallel values are zipped position by position; when the first and
    last name counts disagree the pairing is ambiguous and nothing is returned.
    """
    if not person:
        return []
    if isinstance(person, list):
        return [name for p in person for name in format_person(p)]
    if not isinstance(person, dict):
        return []
    first, middle, last = (person.get(k, "") for k in ("First Name", "Middle Initials", "Last Name"))

    def parts(value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(v).strip() for v in value]
        return str(value or "").split()

    if isinstance(first, list) or isinstance(last, list):
        firsts, lasts = parts(first), parts(last)
        middles = parts(middle) if isinstance(middle, list) else [""] * len(firsts)
    else:
        firsts, lasts, middles = parts(first), parts(last), parts(middle)
    if not firsts or len(firsts) != len(lasts):
        if len(firsts) <= 1 and len(lasts) <= 1:
            name = " ".join(x for x in (str(first).strip(), str(middle).strip(), str(last).strip()) if x)
            return [name] if name else []
        return []
    if len(middles) != len(firsts):
        middles = [""] * len(firsts)
    names = [" ".join(x for x in (f, m, l) if x) for f, m, l in zip(firsts, middles, lasts)]
    return [n for n in names if n]


def principal_investigators(contacts: Iterable[dict]) -> list[str]:
    names = []
    for contact in contacts or []:
        roles = " ".join(str((r or {}).get("annotationValue", "")) for r in contact.get("roles", []) or [])
        if "Principal Investigator" not in roles:
            continue
        name = " ".join(str(contact.get(k, "") or "").strip() for k in ("firstName", "midInitials", "lastName"))
        name = re.sub(r"\s+", " ", name).strip()
        if name and name not in names:
            names.append(name)
    return names


def iso_date(value: Any) -> str:
    """PSI dates arrive as MM-DD-YYYY, DD-Mon-YYYY or epoch seconds."""
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)) or re.fullmatch(r"\d{9,11}(\.\d+)?", str(value)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc).date().isoformat()
    text = str(value).strip()
    for pattern in ("%m-%d-%Y", "%d-%b-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, pattern).date().isoformat()
        except ValueError:
            pass
    return text


def keyword_list(value: Any) -> list[str]:
    if not value:
        return []
    items = value if isinstance(value, list) else re.split(r"\s{2,}|;|\n", str(value))
    seen: list[str] = []
    for item in items:
        word = clean_text(item).strip(" ,")
        if word and word.lower() not in (s.lower() for s in seen):
            seen.append(word)
    return seen[:30]


def accessions(value: Any) -> list[str]:
    return sorted(set(re.findall(r"PSI-\d+", " ".join(value) if isinstance(value, list) else str(value or ""))),
                  key=lambda a: int(a.split("-")[1]))


def file_counts(detail: dict) -> dict[str, int]:
    files: dict[str, dict] = {}
    for item in (detail.get("added") or []) + (detail.get("modified") or []):
        if item.get("visible", True) and not item.get("restricted", False) and item.get("file_name"):
            files[item["file_name"]] = item
    names = [n.lower() for n in files]
    tables = [t for t in detail.get("experimentalTable") or [] if t.get("visible", True) and not t.get("restricted", False)]

    def ext(*suffixes: str) -> int:
        return sum(1 for n in names if n.endswith(suffixes))

    return {
        "total": len(names),
        "csv": ext(".csv") + sum(1 for t in tables if str(t.get("file_name", "")).lower().endswith(".csv")),
        "pdf": ext(".pdf"),
        "spreadsheet": ext(".xls", ".xlsx"),
        "video": ext(".mp4", ".mov", ".avi"),
        "archive": ext(".zip", ".tar", ".gz"),
        "experimentalTables": len(tables),
    }


# --------------------------------------------------------------------------
# Chunking
# --------------------------------------------------------------------------

SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9“\"(])")


def split_words(text: str, size: int) -> list[str]:
    words = text.split()
    return [" ".join(words[i:i + size]) for i in range(0, len(words), size)]


def chunk_text(text: str) -> list[str]:
    """Sentence-aligned passages of about 120-220 words."""
    text = text.strip()
    if not text:
        return []
    sentences: list[str] = []
    for sentence in SENTENCE_RE.split(text):
        sentences.extend(split_words(sentence, CHUNK_MAX_WORDS) if len(sentence.split()) > CHUNK_MAX_WORDS else [sentence])
    chunks: list[list[str]] = [[]]
    count = 0
    for sentence in sentences:
        n = len(sentence.split())
        if chunks[-1] and (count >= CHUNK_MIN_WORDS or count + n > CHUNK_MAX_WORDS):
            chunks.append([])
            count = 0
        chunks[-1].append(sentence)
        count += n
    out = [" ".join(c) for c in chunks if c]
    # A short tail joins the previous passage when that stays under the hard limit.
    if len(out) > 1 and len(out[-1].split()) < CHUNK_MIN_WORDS // 2 \
            and len(out[-2].split()) + len(out[-1].split()) <= CHUNK_HARD_MAX:
        out[-2:] = [f"{out[-2]} {out[-1]}"]
    return out


def overview_text(inv: dict) -> str:
    name = f"{inv['title']} ({inv['acronym']})" if inv["acronym"] else inv["title"]
    parts = [f"{name}, NASA PSI investigation {inv['accession']}."]
    if inv["subResearchArea"]:
        parts.append(f"Research area: {inv['researchArea'] or 'Combustion Science'}; sub-area: {inv['subResearchArea']}.")
    if inv["projectType"]:
        parts.append(f"Project type: {inv['projectType']}.")
    platform = "; ".join(x for x in (inv["flightProgram"], inv["experimentHardware"]) if x)
    if platform:
        parts.append(f"Platform: {platform}.")
    if inv["startDate"] or inv["endDate"]:
        parts.append(f"Investigation period: {inv['startDate'] or 'not stated'} to {inv['endDate'] or 'not stated'}.")
    if inv["keywords"]:
        parts.append(f"Keywords: {', '.join(inv['keywords'])}.")
    if inv["relatedInvestigations"]:
        parts.append(f"Related PSI investigations: {', '.join(inv['relatedInvestigations'])}.")
    files = inv["files"]
    parts.append(f"Public files: {files['total']} ({files['csv']} CSV, {files['pdf']} PDF, {files['spreadsheet']} spreadsheets); "
                 f"{len(inv['publications'])} publications listed.")
    return " ".join(parts)


def publications_text(inv: dict) -> str:
    titles = [p["title"].rstrip(".") for p in inv["publications"] if p["title"]]
    return ("Publications listed on the record: " + ". ".join(titles) + ".") if titles else ""


def build_chunks(inv: dict) -> list[dict]:
    chunks = []
    for field in CHUNK_FIELDS:
        if field == "overview":
            text = overview_text(inv)
        elif field == "publications":
            text = publications_text(inv)
        else:
            text = inv[field]
        for i, passage in enumerate(chunk_text(text)):
            chunks.append({"id": f"{inv['accession']}#{field}-{i}", "field": field, "text": passage})
    return chunks


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------

def normalize(src: dict, detail: dict | None) -> dict:
    d = detail or {}
    accession = str(src.get("Accession") or d.get("accession") or "").strip()
    pis = principal_investigators(d.get("contacts") or []) if detail else format_person(src.get("Person"))
    inv = {
        "accession": accession,
        "title": clean_text(d.get("title") or src.get("Title")),
        "acronym": clean_text(d.get("investigationAcronym") or src.get("Acronym")),
        "url": PUBLIC_URL.format(id=accession),
        "doi": clean_text(d.get("doi")),
        "startDate": iso_date(d.get("investigationStartDate") or src.get("Investigation Start Date")),
        "endDate": iso_date(d.get("investigationEndDate") or src.get("Investigation End Date")),
        "releaseDate": iso_date(d.get("releaseDate") or src.get("Public Release Date")),
        "researchArea": clean_text(d.get("researchArea") or src.get("Research Area")),
        "subResearchArea": clean_text(d.get("subResearchArea") or src.get("SubResearch Area")),
        "projectType": clean_text(d.get("projectType") or src.get("Project Type")),
        "flightProgram": clean_text(d.get("flightProgram") or src.get("Flight Platform")),
        "experimentHardware": clean_text(d.get("experimentHardware") or src.get("Experiment Hardware")),
        "managingCenter": clean_text(d.get("managingNasaCenter") or src.get("Monitoring Center")),
        "license": clean_text(d.get("licenseIdentifier")),
        "principalInvestigators": pis[:8],
        "keywords": keyword_list(src.get("Keywords")),
        "relatedInvestigations": [a for a in accessions(d.get("related_glds") or src.get("Related Investigations")) if a != accession],
        "objective": clean_text(d.get("objective") or src.get("Objectives")),
        "hypothesis": clean_text(d.get("hypothesis") or src.get("Hypothesis")),
        "approach": clean_text(d.get("approach") or src.get("Approach")),
        "researchImpacts": clean_text(d.get("researchImpacts") or src.get("Research Impacts/Earth Benefits")),
        "publications": [
            {"title": clean_text(p.get("title")), "authors": clean_text(p.get("authorList"))[:300], "doi": clean_text(p.get("doi"))}
            for p in (d.get("publications") or []) if clean_text(p.get("title"))
        ],
        "files": file_counts(d),
        "detailRetrieved": detail is not None,
    }
    inv["chunks"] = build_chunks(inv)
    return inv


def cmd_build(args: argparse.Namespace) -> int:
    session = requests.Session()
    session.headers.update(HEADERS)
    print(f"Searching {SEARCH_URL} (Research Area = combustion science)")
    data = get_json(session, SEARCH_URL, SEARCH_PARAMS)
    hits = (data.get("hits") or {}).get("hits") or []
    if not hits:
        print("No investigations returned; the corpus was not written.", file=sys.stderr)
        return 1
    print(f"{len(hits)} investigations listed")
    investigations = []
    for i, hit in enumerate(hits, 1):
        src = hit.get("_source") or {}
        accession = str(src.get("Accession", "")).strip()
        if not re.fullmatch(r"PSI-\d+", accession):
            print(f"  [{i:2}/{len(hits)}] skipped: unexpected accession {accession!r}")
            continue
        detail = None
        try:
            detail = get_json(session, DETAIL_URL.format(id=accession))
            if detail.get("restricted") or detail.get("public") is False:
                print(f"  [{i:2}/{len(hits)}] {accession} is not public; skipped")
                continue
        except RuntimeError as error:
            print(f"  [{i:2}/{len(hits)}] {accession}: detail unavailable ({error}); using search fields")
        inv = normalize(src, detail)
        investigations.append(inv)
        print(f"  [{i:2}/{len(hits)}] {accession:8} {inv['acronym'] or inv['title'][:40]:40} "
              f"{len(inv['chunks']):2} passages, {inv['files']['csv']} CSV, {inv['files']['pdf']} PDF, "
              f"{len(inv['publications'])} publications")
        time.sleep(args.delay)
    investigations.sort(key=lambda inv: int(inv["accession"].split("-")[1]))
    corpus = {
        "schemaVersion": SCHEMA_VERSION,
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {
            "name": "NASA Physical Sciences Informatics (PSI) repository",
            "search": SEARCH_URL,
            "searchFilter": "Research Area = combustion science",
            "detail": DETAIL_URL,
            "publicPage": PUBLIC_URL,
        },
        "chunking": {"minWords": CHUNK_MIN_WORDS, "maxWords": CHUNK_MAX_WORDS, "fields": list(CHUNK_FIELDS)},
        "investigations": investigations,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(corpus, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {out} ({out.stat().st_size:,} bytes, {len(investigations)} investigations, "
          f"{sum(len(i['chunks']) for i in investigations)} passages)")
    return 0


# --------------------------------------------------------------------------
# check
# --------------------------------------------------------------------------

def load_corpus(path: str | Path) -> dict:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def validate(corpus: dict, raw: str) -> list[str]:
    errors: list[str] = []

    def need(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    need(corpus.get("schemaVersion") == SCHEMA_VERSION, f"schemaVersion must be {SCHEMA_VERSION}")
    try:
        datetime.fromisoformat(str(corpus.get("retrievedAt")))
    except ValueError:
        errors.append("retrievedAt is not an ISO timestamp")
    source = corpus.get("source") or {}
    need(source.get("search") == SEARCH_URL and source.get("detail") == DETAIL_URL, "source URLs are missing or changed")
    investigations = corpus.get("investigations")
    need(isinstance(investigations, list) and len(investigations) > 0, "investigations must be a non-empty list")
    seen_accessions: set[str] = set()
    seen_chunks: set[str] = set()
    for inv in investigations or []:
        acc = inv.get("accession", "")
        label = acc or "<missing accession>"
        need(bool(re.fullmatch(r"PSI-\d+", acc)), f"{label}: bad accession")
        need(acc not in seen_accessions, f"{label}: duplicate accession")
        seen_accessions.add(acc)
        need(isinstance(inv.get("title"), str) and inv["title"].strip() != "", f"{label}: missing title")
        need(inv.get("url") == PUBLIC_URL.format(id=acc), f"{label}: url must be the public PSI record")
        for key in ("acronym", "doi", "startDate", "endDate", "releaseDate", "subResearchArea") + TEXT_FIELDS:
            need(isinstance(inv.get(key), str), f"{label}: {key} must be a string")
        for key in ("keywords", "principalInvestigators", "relatedInvestigations"):
            need(isinstance(inv.get(key), list) and all(isinstance(x, str) for x in inv.get(key, [])), f"{label}: {key} must be a list of strings")
        pubs = inv.get("publications")
        need(isinstance(pubs, list) and all(isinstance(p, dict) and {"title", "authors", "doi"} <= set(p) for p in pubs or []),
             f"{label}: publications need title, authors and doi")
        files = inv.get("files") or {}
        need(all(isinstance(files.get(k), int) and files[k] >= 0 for k in ("total", "csv", "pdf")), f"{label}: file counts missing")
        chunks = inv.get("chunks")
        need(isinstance(chunks, list) and len(chunks) > 0, f"{label}: no passages")
        by_field: dict[str, list[dict]] = {}
        for chunk in chunks or []:
            cid = chunk.get("id", "")
            field = chunk.get("field")
            need(field in CHUNK_FIELDS, f"{cid}: unknown field {field!r}")
            need(bool(re.fullmatch(rf"{re.escape(acc)}#{field}-\d+", cid)), f"{cid}: id must look like {acc}#<field>-<n>")
            need(cid not in seen_chunks, f"{cid}: duplicate passage id")
            seen_chunks.add(cid)
            words = len(str(chunk.get("text", "")).split())
            need(words > 0, f"{cid}: empty passage")
            need(words <= CHUNK_HARD_MAX, f"{cid}: {words} words exceeds {CHUNK_HARD_MAX}")
            by_field.setdefault(field, []).append(chunk)
        for field, items in by_field.items():
            for chunk in items[:-1]:
                need(len(chunk["text"].split()) >= CHUNK_MIN_WORDS // 2, f"{chunk['id']}: non-final passage is too short")
    need(not EMAIL_RE.search(raw), "corpus contains an email address")
    need(not PHONE_RE.search(raw), "corpus contains a phone number")
    for banned in ('"email"', '"phone"', '"fax"', '"address"', '"_raw"', '"_detail"'):
        need(banned not in raw, f"corpus contains a {banned} field")
    size = len(raw.encode("utf-8"))
    need(size <= MAX_CORPUS_BYTES, f"corpus is {size:,} bytes; limit {MAX_CORPUS_BYTES:,}")
    return errors


def cmd_check(args: argparse.Namespace) -> int:
    path = Path(args.corpus)
    if not path.exists():
        print(f"{path} not found. Run: python scripts/NASAflamesRAG.py build", file=sys.stderr)
        return 1
    raw = path.read_text(encoding="utf-8")
    corpus = json.loads(raw)
    errors = validate(corpus, raw)
    investigations = corpus.get("investigations") or []
    chunks = [c for inv in investigations for c in inv.get("chunks", [])]
    words = [len(c["text"].split()) for c in chunks]
    fields = Counter(c["field"] for c in chunks)
    print(f"Corpus      {path}")
    print(f"Retrieved   {corpus.get('retrievedAt')}")
    print(f"Size        {len(raw.encode('utf-8')):,} bytes")
    print(f"Records     {len(investigations)} investigations, "
          f"{sum(1 for i in investigations if i.get('detailRetrieved'))} with full detail, "
          f"{sum(1 for i in investigations if i.get('doi'))} with a DOI")
    print(f"Passages    {len(chunks)} (words: min {min(words, default=0)}, median {sorted(words)[len(words) // 2] if words else 0}, max {max(words, default=0)})")
    print(f"By field    {', '.join(f'{k} {fields[k]}' for k in CHUNK_FIELDS if fields[k])}")
    print(f"Data files  {sum(i['files']['csv'] for i in investigations)} CSV, {sum(i['files']['pdf'] for i in investigations)} PDF; "
          f"{sum(len(i['publications']) for i in investigations)} publications")
    if errors:
        print(f"\n{len(errors)} problem(s):", file=sys.stderr)
        for error in errors[:50]:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("OK")
    return 0


# --------------------------------------------------------------------------
# BM25 retrieval (mirrors src/lib/rag/bm25.ts)
# --------------------------------------------------------------------------

STOPWORDS = set("""a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having he her here
hers him his how i if in into is it its itself just me more most my no nor not of off on once only or other our out over
own she should so some such than that the their them then there these they this those through to too under until up
very was we were what when where which while who whom why will with would you your yours tell show list give find please
much many""".split())
# "same" is deliberately absent: it is also the SAME experiment acronym.
TOKEN_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def stem(word: str) -> str:
    """Light suffix stripping, identical to stem() in src/lib/rag/bm25.ts."""
    w = word
    if len(w) > 4 and w.endswith("ies"):
        w = w[:-3] + "y"
    elif len(w) > 4 and w.endswith("ied"):
        w = w[:-3] + "y"
    elif w.endswith("sses"):
        w = w[:-2]
    elif len(w) > 4 and w.endswith(("ses", "xes", "zes", "ches", "shes")):
        w = w[:-2]
    elif len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is")):
        w = w[:-1]
    if len(w) > 5 and w.endswith("ing"):
        w = w[:-3]
    elif len(w) > 4 and w.endswith("ed"):
        w = w[:-2]
    if len(w) > 6 and w.endswith("ion"):
        w = w[:-3]
    elif len(w) > 6 and w.endswith("or"):
        w = w[:-2]
    if len(w) > 4 and w.endswith("e"):
        w = w[:-1]
    if len(w) > 4 and w[-1] == w[-2] and w[-1] not in "aeiouls":
        w = w[:-1]
    return w


def tokenize(text: str, keep_stopwords: bool = False) -> list[str]:
    """Lower-case word tokens with light stemming. Hyphenated names also yield a joined token (flex-2 -> flex2)."""
    out: list[str] = []
    for match in TOKEN_RE.finditer(text.lower().replace("₂", "2")):
        token = match.group(0)
        pieces = token.split("-")
        if len(pieces) > 1:
            out.append(stem("".join(pieces)))
        for piece in pieces:
            if piece and (keep_stopwords or piece not in STOPWORDS):
                out.append(stem(piece))
    return out


class BM25:
    """BM25 with weighted fields (term frequency and length are summed with field weights)."""

    def __init__(self, docs: list[list[tuple[list[str], float]]], k1: float = 1.2, b: float = 0.75):
        self.k1, self.b = k1, b
        self.tf: list[dict[str, float]] = []
        self.length: list[float] = []
        df: Counter[str] = Counter()
        for fields in docs:
            tf: dict[str, float] = {}
            length = 0.0
            for tokens, weight in fields:
                for token in tokens:
                    tf[token] = tf.get(token, 0.0) + weight
                length += weight * len(tokens)
            self.tf.append(tf)
            self.length.append(length)
            df.update(tf.keys())
        self.n = len(docs)
        self.avg = (sum(self.length) / self.n) if self.n else 1.0
        self.idf = {t: math.log(1 + (self.n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def scores(self, query: list[str]) -> list[float]:
        terms = list(dict.fromkeys(query))
        out = []
        for tf, length in zip(self.tf, self.length):
            score = 0.0
            norm = self.k1 * (1 - self.b + self.b * length / self.avg)
            for term in terms:
                f = tf.get(term)
                if f:
                    score += self.idf[term] * f * (self.k1 + 1) / (f + norm)
            out.append(score)
        return out


def passages(corpus: dict) -> list[dict]:
    out = []
    for inv in corpus["investigations"]:
        header = " ".join([inv["title"], inv["acronym"], inv["accession"], " ".join(inv["keywords"])])
        for chunk in inv["chunks"]:
            out.append({**chunk, "accession": inv["accession"], "acronym": inv["acronym"], "title": inv["title"],
                        "url": inv["url"], "header": header})
    return out


def rank(corpus: dict, question: str, k: int, embed: bool = False, per_record: int = 2) -> list[tuple[float, dict]]:
    items = passages(corpus)
    index = BM25([[(tokenize(p["text"]), 1.0), (tokenize(p["header"], keep_stopwords=True), 0.6)] for p in items])
    # Publication-title lists match many words; prefer prose when scores are close (same prior as retrieve.ts).
    scores = [s * (0.85 if p["field"] == "publications" else 1.0) for s, p in zip(index.scores(tokenize(question)), items)]
    if embed:
        scores = embed_rerank(question, items, scores)
    ranked = sorted(zip(scores, items), key=lambda pair: -pair[0])
    out: list[tuple[float, dict]] = []
    per: Counter[str] = Counter()
    for score, item in ranked:
        if score <= 0 or per[item["accession"]] >= per_record:
            continue
        per[item["accession"]] += 1
        out.append((score, item))
        if len(out) >= k:
            break
    return out


def embed_rerank(question: str, items: list[dict], bm25: list[float]) -> list[float]:
    """Optional hybrid score: half normalized BM25, half cosine similarity. BM25 only if the package is absent."""
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ImportError:
        print("sentence-transformers is not installed; using BM25 only.", file=sys.stderr)
        return bm25
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    q = model.encode(["Represent this sentence for searching relevant passages: " + question], normalize_embeddings=True)[0]
    docs = model.encode([f"{p['title']}. {p['text']}" for p in items], normalize_embeddings=True)
    top = max(bm25) or 1.0
    return [0.5 * (s / top) + 0.5 * float(sum(a * b for a, b in zip(q, d))) for s, d in zip(bm25, docs)]


def best_sentences(text: str, question: str, limit: int = 2) -> list[str]:
    terms = set(tokenize(question))
    sentences = [s for s in SENTENCE_RE.split(text) if len(s.split()) >= 5]
    scored = sorted(((len(terms & set(tokenize(s))), i, s) for i, s in enumerate(sentences)), key=lambda x: (-x[0], x[1]))
    picked = sorted((i, s) for hits, i, s in scored[:limit] if hits > 0)
    return [s for _, s in picked]


def generate(question: str, hits: list[tuple[float, dict]]) -> str | None:
    """Groq answer restricted to the retrieved passages, or None when the key is absent or the answer fails validation."""
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    model = os.environ.get("GROQ_MODEL", DEFAULT_GROQ_MODEL)
    ids = [item["id"] for _, item in hits]
    context = [{"id": item["id"], "record": f"{item['accession']} {item['acronym'] or item['title']}", "text": item["text"]} for _, item in hits]
    system = ("You answer questions about NASA combustion-science investigations using ONLY the supplied passages. "
              "Cite every claim with passage ids in square brackets, e.g. [PSI-25#objective-0]. Never invent studies, "
              "numbers or results. If the passages do not answer the question, say exactly what is missing. "
              "No URLs. At most 180 words.")
    body = {
        "model": model, "temperature": 0.1, "max_completion_tokens": 1200,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": json.dumps({"question": question, "passages": context})}],
    }
    if model.startswith("openai/gpt-oss-"):
        body["reasoning_effort"] = "low"
    try:
        response = requests.post(GROQ_URL, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                                 json=body, timeout=30)
        response.raise_for_status()
        choice = response.json()["choices"][0]
        text = str(choice["message"]["content"]).strip()
    except (requests.RequestException, KeyError, IndexError, ValueError):
        print("Generation failed; showing the extractive answer.", file=sys.stderr)
        return None
    cited = set(re.findall(r"\[([^\]]+)\]", text))
    cited = {c.strip() for group in cited for c in group.split(",")}
    if not cited or not cited <= set(ids) or URL_LIKE.search(text):
        print("The generated answer cited passages outside the retrieved set; showing the extractive answer.", file=sys.stderr)
        return None
    return text


def cmd_query(args: argparse.Namespace) -> int:
    path = Path(args.corpus)
    if not path.exists():
        print(f"{path} not found. Run: python scripts/NASAflamesRAG.py build", file=sys.stderr)
        return 1
    corpus = load_corpus(path)
    hits = rank(corpus, args.question, args.k, embed=args.embed)
    print(f"Question: {args.question}\n")
    if not hits:
        print("No passage in the PSI combustion corpus matches this question.")
        return 0
    answer = None if args.extractive else generate(args.question, hits)
    if answer:
        print("Answer (generated from the passages below)\n" + answer + "\n")
    else:
        print("Extractive answer")
        for _, item in hits[:3]:
            for sentence in best_sentences(item["text"], args.question) or [item["text"][:240]]:
                print(f"  - {sentence} [{item['id']}]")
        print()
    print("Passages")
    for i, (score, item) in enumerate(hits, 1):
        label = f"{item['accession']} {item['acronym']}".strip()
        print(f"{i:2}. [{item['id']}] {label}: {item['title']}  (BM25 {score:.2f})")
        print(f"    {item['url']}")
        snippet = item["text"] if len(item["text"]) <= 420 else item["text"][:417].rsplit(" ", 1)[0] + "..."
        print(f"    {snippet}")
    return 0


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="NASA PSI combustion corpus for Ask IGNIS (build, check, query).")
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="fetch PSI combustion investigations and write the corpus JSON")
    build.add_argument("--out", default=str(DEFAULT_CORPUS))
    build.add_argument("--delay", type=float, default=0.4, help="seconds between detail requests")
    check = sub.add_parser("check", help="validate the corpus file and print counts")
    check.add_argument("--corpus", default=str(DEFAULT_CORPUS))
    query = sub.add_parser("query", help="BM25 search over the corpus")
    query.add_argument("question")
    query.add_argument("-k", type=int, default=5)
    query.add_argument("--corpus", default=str(DEFAULT_CORPUS))
    query.add_argument("--extractive", action="store_true", help="never call Groq, even when GROQ_API_KEY is set")
    query.add_argument("--embed", action="store_true", help="hybrid re-rank with sentence-transformers if installed")
    args = parser.parse_args(argv)
    return {"build": cmd_build, "check": cmd_check, "query": cmd_query}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
