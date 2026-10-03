"""Recupera archivos de PSI que dan 404 extrayéndolos de los .zip hermanos del servidor.

En FLEX/FLEX-2 muchos .txt "legacy" no existen en S3, pero sí vienen dentro del .zip de la
misma prueba (junto con cientos de imágenes .tif). Aquí se leen solo el índice del zip y el
miembro .txt mediante peticiones HTTP Range, sin bajar las imágenes.

Uso: python scripts/recover_psi_from_zips.py   (lee data/psi/_errors.log y los files_manifest.csv)
"""
import csv, io, os, re, sys, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
from psi_common import UA, presigned_url

ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "psi")


class HttpFile(io.RawIOBase):
    """Archivo remoto de solo lectura con seek, vía HTTP Range."""

    def __init__(self, url):
        self.url, self.pos = url, 0
        r = urllib.request.urlopen(urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"}), timeout=120)
        self.size = int(r.headers["Content-Range"].split("/")[1])

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.size + off}[whence]
        return self.pos

    def readinto(self, b):
        n = min(len(b), self.size - self.pos)
        if n <= 0:
            return 0
        req = urllib.request.Request(self.url, headers={**UA, "Range": f"bytes={self.pos}-{self.pos + n - 1}"})
        data = urllib.request.urlopen(req, timeout=300).read()
        b[:len(data)] = data
        self.pos += len(data)
        return len(data)


def failed_by_investigation():
    out = {}
    for line in open(os.path.join(ROOT, "_errors.log"), encoding="utf-8"):
        m = re.match(r"\[ERR\] (PSI-\d+) (.+): HTTP Error 404", line)
        if m:
            out.setdefault(m.group(1), set()).add(m.group(2))
    return out


def plan(acc, failed):
    folder = next(d for d in os.listdir(ROOT) if d.startswith(acc + "_"))
    rows = list(csv.DictReader(open(os.path.join(ROOT, folder, "files_manifest.csv"), encoding="utf-8")))
    strip = lambda name: re.sub(rf"^{re.escape(acc)}_[^_]+_", "", name)  # "PSI-68_Raw Data_A1.txt" -> "A1.txt"
    # El árbol de PSI repite la misma clave S3 en varias carpetas: el zip puede estar en otra categoría.
    zips = {strip(r["file"]).rsplit(".", 1)[0]: r["s3_key"] for r in rows if r["file"].lower().endswith(".zip")}
    jobs = {}  # s3_key del zip -> [(nombre_original, destino)]
    for r in rows:
        if r["s3_key"] not in failed or not r["local_path"]:
            continue
        orig = strip(r["file"])
        stem = orig.rsplit(".", 1)[0]
        cands = [z for z in zips if stem.startswith(z)]
        if cands:
            jobs.setdefault(zips[max(cands, key=len)], []).append((orig, os.path.join(ROOT, folder, r["local_path"])))
    return jobs


def extract(acc, zip_key, wanted):
    zf = zipfile.ZipFile(io.BufferedReader(HttpFile(presigned_url(acc, zip_key)), 1 << 16))
    members = {os.path.basename(n).lower(): n for n in zf.namelist()}
    got = 0
    for orig, dest in wanted:
        m = members.get(orig.lower())
        if m and not os.path.exists(dest):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(zf.read(m))
            got += 1
    return got


def main():
    for acc, failed in failed_by_investigation().items():
        jobs = plan(acc, failed)
        if not jobs:
            continue
        total = sum(len(v) for v in jobs.values())
        ok = err = 0
        with ThreadPoolExecutor(8) as ex:
            futs = {ex.submit(extract, acc, k, v): k for k, v in jobs.items()}
            for fu in as_completed(futs):
                try:
                    ok += fu.result()
                except Exception as e:
                    err += 1
                    print(f"[ERR] {acc} {futs[fu]}: {e}", file=sys.stderr)
        print(f"{acc}: recuperados {ok} de {total} archivos fallidos ({len(jobs)} zips, {err} zips con error)", flush=True)


if __name__ == "__main__":
    main()
