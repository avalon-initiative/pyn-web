#!/usr/bin/env python3
"""Fail when the public tree references private code or packages, or carries secrets (decision pyn#140)."""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SELF = pathlib.Path(__file__).resolve().relative_to(ROOT).as_posix()

PRIVATE_NAME = re.compile(r"pyn-cloud", re.I)
SECRET_NAME = re.compile(r"(^|/)(\.env(\..*)?|\.netrc|id_(rsa|dsa|ecdsa|ed25519)|.*\.(pem|p12|pfx|key))$")
SECRET_ALLOWED = {".env.example"}
SECRET_CONTENT = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----\s*\n[A-Za-z0-9+/=]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),
    re.compile(r"_authToken\s*=\s*(?!\$\{)\S"),
]
PUBLIC_REGISTRIES = ("https://registry.npmjs.org/", "https://npm.pkg.github.com/")
DEP_SECTIONS = ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies")
NON_REGISTRY_SPEC = re.compile(r"^(git\+|git://|github:|gitlab:|bitbucket:|ssh://|https?://|file:|link:|[\w.-]+/[\w.-]+$)")


def tracked() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return sorted(p for p in out.decode().split("\0") if p and (ROOT / p).is_file())


def check_package(name: str, text: str, problems: list[str]) -> None:
    for section in DEP_SECTIONS:
        for dep, spec in json.loads(text).get(section, {}).items():
            if NON_REGISTRY_SPEC.search(spec):
                problems.append(f"{name}: {dep} comes from {spec}, not a registry")


def check_lock(name: str, text: str, problems: list[str]) -> None:
    for path, pkg in json.loads(text).get("packages", {}).items():
        resolved = pkg.get("resolved", "")
        if resolved and not resolved.startswith(PUBLIC_REGISTRIES):
            problems.append(f"{name}: {path or 'root'} resolves to {resolved}")


problems: list[str] = []
files = tracked()

for name in files:
    if name.rsplit("/", 1)[-1] == ".gitmodules":
        problems.append(f"{name}: submodules are not allowed")
    if SECRET_NAME.search(name) and name not in SECRET_ALLOWED:
        problems.append(f"{name}: looks like a secret file")

for name in files:
    path = ROOT / name
    try:
        text = path.read_text()
    except (UnicodeDecodeError, OSError):
        continue
    if path.name == "package.json":
        check_package(name, text, problems)
    if path.name == "package-lock.json":
        check_lock(name, text, problems)
    if path.name == ".npmrc":
        for m in re.finditer(r"registry\s*=\s*(\S+)", text):
            if not m.group(1).startswith(PUBLIC_REGISTRIES):
                problems.append(f"{name}: registry {m.group(1)} is not public")
    if name != SELF and not name.endswith(".md") and PRIVATE_NAME.search(text):
        problems.append(f"{name}: references private code")
    for pat in SECRET_CONTENT:
        if name != SELF and pat.search(text):
            problems.append(f"{name}: secret-like content ({pat.pattern})")

if problems:
    print("public-boundary check failed (decision pyn#140):")
    for p in sorted(set(problems)):
        print(f"  {p}")
    sys.exit(1)
print(f"public-boundary check ok ({len(files)} files)")
