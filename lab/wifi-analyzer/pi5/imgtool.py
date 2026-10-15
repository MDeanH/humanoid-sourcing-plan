#!/usr/bin/env python3
"""Helpers for make-image.sh: partitions of a Raspberry Pi OS image, and the .deb files a package still needs.

    imgtool.py parts <img>                             -> "<n> <type hex> <start byte> <size bytes>" per partition
    imgtool.py extract <img> <n> <out>                 copy partition n out
    imgtool.py inject <img> <n> <in>                   copy it back (same size)
    imgtool.py needs <dpkg-status> <Packages...> -- <package...>
                                                       -> "<Filename> <SHA256> <base URL index>" per .deb to fetch
    imgtool.py xz <in.xz> <out>                        decompress

Standard library only. The pure parts are tested in test_pi5.py.
"""
import gzip
import hashlib
import lzma
import os
import re
import struct
import sys


# ---- partitions -------------------------------------------------------------------------------------------------

def parse_mbr(sector0):
    """The four MBR entries that are in use: [(number, type, start byte, size bytes)]."""
    if len(sector0) < 512 or sector0[510:512] != b"\x55\xaa":
        raise ValueError("no MBR boot signature")
    out = []
    for i in range(4):
        e = sector0[446 + 16 * i: 462 + 16 * i]
        ptype = e[4]
        start, count = struct.unpack("<II", e[8:16])
        if ptype and count:
            out.append((i + 1, ptype, start * 512, count * 512))
    return out


def copy_range(src, src_off, dst, dst_off, size, chunk=8 << 20):
    with open(src, "rb") as fi, open(dst, "r+b" if os.path.exists(dst) else "wb") as fo:
        fi.seek(src_off)
        fo.seek(dst_off)
        left = size
        while left:
            b = fi.read(min(chunk, left))
            if not b:
                raise IOError("short read")
            fo.write(b)
            left -= len(b)


# ---- packages ---------------------------------------------------------------------------------------------------

def parse_stanzas(text):
    """Debian control-file stanzas (dpkg status, Packages) -> list of dicts. Continuation lines are joined."""
    out, cur, key = [], {}, None
    for line in text.splitlines():
        if not line.strip():
            if cur:
                out.append(cur)
            cur, key = {}, None
        elif line[0] in " \t" and key:
            cur[key] += "\n" + line.strip()
        elif ":" in line:
            key, v = line.split(":", 1)
            cur[key] = v.strip()
    if cur:
        out.append(cur)
    return out


def installed(status_stanzas):
    """Names of packages dpkg reports as installed, plus what they provide."""
    have = set()
    for s in status_stanzas:
        if "install ok installed" in s.get("Status", ""):
            have.add(s["Package"])
            for p in _names(s.get("Provides", "")):
                have.add(p)
    return have


def _names(field):
    """'a (>= 1), b | c, d:any' -> ['a', 'b', 'd'] (first of each alternative, arch qualifier dropped)."""
    out = []
    for part in field.split(","):
        part = part.strip()
        if not part:
            continue
        first = part.split("|")[0].strip()
        name = re.split(r"[\s(\[]", first)[0].split(":")[0]
        if name:
            out.append(name)
    return out


def _alternatives(field):
    """'a, b | c' -> [['a'], ['b', 'c']]"""
    groups = []
    for part in field.split(","):
        alts = [re.split(r"[\s(\[]", a.strip())[0].split(":")[0] for a in part.split("|") if a.strip()]
        if alts:
            groups.append(alts)
    return groups


def resolve(wanted, have, repos):
    """Packages to download so `wanted` installs on a system that has `have`.

    repos: list of (index, stanzas) in priority order; returns [(stanza, index)] in dependency order. Version
    constraints are not checked: the indexes are the same release as the image. Raises KeyError for a dependency
    no repository has.
    """
    by_name, provides = {}, {}
    for idx, stanzas in repos:
        for s in stanzas:
            by_name.setdefault(s["Package"], (s, idx))
            for p in _names(s.get("Provides", "")):
                provides.setdefault(p, s["Package"])
    order, seen = [], set(have)

    def visit(name, chain):
        if name in seen:
            return
        if name not in by_name and name in provides:
            name = provides[name]
            if name in seen:
                return
        if name not in by_name:
            raise KeyError("%s (needed by %s)" % (name, " <- ".join(chain) or "request"))
        seen.add(name)
        s, idx = by_name[name]
        for field in ("Pre-Depends", "Depends"):
            for alts in _alternatives(s.get(field, "")):
                if any(a in have or a in seen for a in alts):
                    continue
                pick = next((a for a in alts if a in by_name or a in provides), alts[0])
                visit(pick, [name] + chain)
        order.append((s, idx))

    for w in wanted:
        visit(w, [])
    return order


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main(argv):
    cmd = argv[0] if argv else ""
    if cmd == "parts":
        with open(argv[1], "rb") as f:
            for n, t, start, size in parse_mbr(f.read(512)):
                print(n, "%02x" % t, start, size)
    elif cmd in ("extract", "inject"):
        img, n, other = argv[1], int(argv[2]), argv[3]
        with open(img, "rb") as f:
            part = {p[0]: p for p in parse_mbr(f.read(512))}[n]
        if cmd == "extract":
            if os.path.exists(other):
                os.remove(other)
            copy_range(img, part[2], other, 0, part[3])
        else:
            if os.path.getsize(other) != part[3]:
                raise SystemExit("size mismatch: %s is not partition %d's size" % (other, n))
            copy_range(other, 0, img, part[2], part[3])
    elif cmd == "needs":
        sep = argv.index("--")
        status, indexes, wanted = argv[1], argv[2:sep], argv[sep + 1:]
        with open(status, encoding="utf-8", errors="replace") as f:
            have = installed(parse_stanzas(f.read()))
        repos = []
        for i, path in enumerate(indexes):
            opener = lzma.open if path.endswith(".xz") else gzip.open if path.endswith(".gz") else open
            with opener(path, "rt", encoding="utf-8", errors="replace") as f:
                repos.append((i, parse_stanzas(f.read())))
        for s, idx in resolve(wanted, have, repos):
            print(s["Filename"], s.get("SHA256", "-"), idx)
    elif cmd == "xz":
        with lzma.open(argv[1], "rb") as fi, open(argv[2], "wb") as fo:
            for b in iter(lambda: fi.read(8 << 20), b""):
                fo.write(b)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
