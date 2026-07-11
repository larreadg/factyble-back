#!/usr/bin/env python3
"""Collect a read-only static evidence baseline for a Factyble/SIFEN migration audit."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".angular",
    "tmp",
    "temp",
}

TEXT_SUFFIXES = {
    ".js",
    ".cjs",
    ".mjs",
    ".ts",
    ".json",
    ".prisma",
    ".md",
    ".yml",
    ".yaml",
    ".env",
    ".example",
    ".sql",
}

REQUIRED_PATHS = [
    "prisma/schema.prisma",
    "src/services/sifen/sifenClientService.js",
    "src/services/sifen/trazabilidadService.js",
    "src/services/sifen/certificadoService.js",
    "src/services/sifen/xmlBuilderService.js",
    "src/services/sifen/firmadorService.js",
    "src/services/sifen/qrService.js",
    "src/services/sifen/loteService.js",
    "src/services/sifen/eventoService.js",
    "src/utils/sifen/cdc.js",
    "src/utils/sifen/codigosRespuesta.js",
    "src/utils/sifen/respuestaSoap.js",
    "src/services/facturaService.js",
    "src/services/notaDeCreditoService.js",
    "src/services/correoService.js",
    "src/services/cronJobs.js",
]

PATTERNS = {
    "legacy_api": r"apiFacturacionElectronica|URL_API_FACT|HOST_API_FACT|factyble-api|data\.php|eventos\.php",
    "legacy_db": r"dbApiFacturacion|conectarDbApiFacturacion|checkFacturaStatus|DB_API_FACT",
    "legacy_fields": r"\bsifen_estado\b|\bxml\b",
    "new_fields": r"\bestado_sifen\b|\bxml_firmado\b",
    "sync_receive": r"\bsetapi\.recibe\s*\(|\brecibe\s*:\s*",
    "cron_jobs": r"armarYEnviarLotes|consultarLotes|consultaIndividualRedDeSeguridad|alertaCertificadosPorVencer|limpiezaTrazabilidad",
    "locking": r"FOR UPDATE|SKIP LOCKED|GET_LOCK|advisory|mutex|lock|locked_at|claim",
    "revoked_cert": r"REVOCADO|revocado",
    "sifen_env": r"SIFEN_ENV",
    "event_retry": r"EventoSifen|intentos_envio|proximo_intento_en",
    "secret_logging": r"console\.(log|warn|error).*?(CERT_ENCRYPTION_KEY|csc|clave|password|passphase)",
}

SCHEMA_TOKENS = [
    "model Certificado",
    "model Lote",
    "model EventoSifen",
    "model SifenTrazabilidad",
    "enum EstadoSifen",
    "enum EstadoCertificado",
    "xml_firmado",
    "estado_sifen",
    "sifen_cod_respuesta",
    "fecha_respuesta_sifen",
]


@dataclass
class Match:
    category: str
    path: str
    line: int
    text: str


def run_command(args: list[str], cwd: Path) -> tuple[int, str]:
    try:
        result = subprocess.run(
            args,
            cwd=str(cwd),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=20,
            check=False,
        )
        return result.returncode, result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 127, f"unavailable: {exc}"


def iter_text_files(root: Path) -> Iterable[Path]:
    scan_roots = [path for path in (root / "src", root / "prisma") if path.exists()]
    if not scan_roots:
        scan_roots = [root]

    yielded: set[Path] = set()
    for scan_root in scan_roots:
        for current, dirs, files in os.walk(scan_root):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            current_path = Path(current)
            for name in files:
                path = current_path / name
                if name == ".env" or name == "MIGRATION_PLAN.md":
                    continue
                if path.suffix.lower() in TEXT_SUFFIXES or name == ".env.example":
                    try:
                        if path.stat().st_size <= 2_000_000 and path not in yielded:
                            yielded.add(path)
                            yield path
                    except OSError:
                        continue

    for name in ("package.json", ".env.example"):
        path = root / name
        if path.exists() and path not in yielded:
            yield path


def load_package(repo: Path) -> dict:
    package_path = repo / "package.json"
    if not package_path.exists():
        return {}
    try:
        return json.loads(package_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def collect_matches(repo: Path, max_per_category: int = 80) -> list[Match]:
    compiled = {name: re.compile(pattern, re.IGNORECASE) for name, pattern in PATTERNS.items()}
    counts = {name: 0 for name in PATTERNS}
    matches: list[Match] = []

    for path in iter_text_files(repo):
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        rel = str(path.relative_to(repo)).replace("\\", "/")
        for line_no, line in enumerate(lines, 1):
            compact = line.strip()
            if not compact:
                continue
            for category, regex in compiled.items():
                if counts[category] >= max_per_category:
                    continue
                if regex.search(line):
                    matches.append(Match(category, rel, line_no, compact[:300]))
                    counts[category] += 1
    return matches


def markdown_escape(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def render_report(repo: Path, plan: Path | None) -> str:
    package = load_package(repo)
    dependencies = {}
    for section in ("dependencies", "devDependencies", "overrides"):
        for key, value in package.get(section, {}).items():
            if key.startswith("facturacionelectronicapy-") or key in {
                "prisma",
                "@prisma/client",
                "node-cron",
                "pg",
                "axios",
                "form-data",
                "xml2js",
                "java",
            }:
                dependencies[f"{section}:{key}"] = value

    git_status = run_command(["git", "status", "--short"], repo)
    git_head = run_command(["git", "rev-parse", "--short", "HEAD"], repo)
    node_version = run_command(["node", "--version"], repo)
    npm_version = run_command(["npm", "--version"], repo)

    matches = collect_matches(repo)
    grouped: dict[str, list[Match]] = {key: [] for key in PATTERNS}
    for match in matches:
        grouped[match.category].append(match)

    schema_path = repo / "prisma/schema.prisma"
    schema = schema_path.read_text(encoding="utf-8", errors="replace") if schema_path.exists() else ""

    lines: list[str] = []
    lines.append("# Baseline de evidencia estática: auditoría Factyble/SIFEN")
    lines.append("")
    lines.append("> Inventario automático de solo lectura. Los matches no son bugs por sí mismos y requieren revisión manual.")
    lines.append("")
    lines.append("## Contexto")
    lines.append("")
    lines.append(f"- Repositorio: `{repo}`")
    lines.append(f"- Plan: `{plan}`" if plan else "- Plan: no proporcionado")
    lines.append(f"- Git HEAD: `{markdown_escape(git_head[1] or 'no disponible')}`")
    lines.append(f"- Node: `{markdown_escape(node_version[1] or 'no disponible')}`")
    lines.append(f"- npm: `{markdown_escape(npm_version[1] or 'no disponible')}`")
    lines.append("")

    lines.append("## Estado de Git")
    lines.append("")
    if git_status[1]:
        lines.append("```text")
        lines.append(git_status[1])
        lines.append("```")
    else:
        lines.append("Árbol limpio o Git no disponible.")
    lines.append("")

    lines.append("## Archivos esperados")
    lines.append("")
    lines.append("| Archivo | Existe |")
    lines.append("|---|---:|")
    for rel in REQUIRED_PATHS:
        lines.append(f"| `{rel}` | {'sí' if (repo / rel).exists() else 'NO'} |")
    lines.append("")

    lines.append("## Dependencias relevantes")
    lines.append("")
    if dependencies:
        lines.append("| Entrada | Versión |")
        lines.append("|---|---|")
        for key, value in sorted(dependencies.items()):
            lines.append(f"| `{markdown_escape(key)}` | `{markdown_escape(str(value))}` |")
    else:
        lines.append("No se pudo leer `package.json` o no se detectaron dependencias relevantes.")
    lines.append("")

    lines.append("## Tokens esperados en Prisma")
    lines.append("")
    lines.append("| Token | Presente |")
    lines.append("|---|---:|")
    for token in SCHEMA_TOKENS:
        lines.append(f"| `{token}` | {'sí' if token in schema else 'NO'} |")
    lines.append("")

    lines.append("## Matches por categoría")
    lines.append("")
    for category in PATTERNS:
        category_matches = grouped[category]
        lines.append(f"### {category} ({len(category_matches)})")
        lines.append("")
        if not category_matches:
            lines.append("Sin matches.")
            lines.append("")
            continue
        lines.append("| Archivo | Línea | Texto |")
        lines.append("|---|---:|---|")
        for match in category_matches:
            lines.append(
                f"| `{markdown_escape(match.path)}` | {match.line} | `{markdown_escape(match.text)}` |"
            )
        lines.append("")

    lines.append("## Próximos análisis estáticos manuales obligatorios")
    lines.append("")
    lines.append("1. Trazar compatibilidad de documentos legacy con `estado_sifen`/`xml_firmado` nulos.")
    lines.append("2. Razonar dos ejecuciones concurrentes de armado/envío de lotes y buscar claim atómico.")
    lines.append("3. Razonar activación concurrente de certificados y tratamiento de `REVOCADO`.")
    lines.append("4. Inspeccionar validación estricta de `SIFEN_ENV` y timeouts.")
    lines.append("5. Trazar idempotencia de cancelación después de timeout incierto.")
    lines.append("6. Inspeccionar parseo SOAP ante namespaces, respuestas múltiples y códigos desconocidos.")

    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path, help="Root of factyble-back")
    parser.add_argument("--plan", type=Path, help="Path to MIGRATION_PLAN.md")
    parser.add_argument("--output", type=Path, help="Write Markdown report to this path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo = args.repo.expanduser().resolve()
    plan = args.plan.expanduser().resolve() if args.plan else None
    if not repo.is_dir():
        raise SystemExit(f"Repository directory does not exist: {repo}")
    if plan and not plan.is_file():
        raise SystemExit(f"Plan file does not exist: {plan}")

    report = render_report(repo, plan)
    if args.output:
        output = args.output.expanduser().resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(report, encoding="utf-8")
        print(output)
    else:
        print(report, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
