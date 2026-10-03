"""Utilidades para la API pública del NASA PSI (psi.nasa.gov/physci/repo)."""
import json, urllib.parse, urllib.request

WS = "https://psi.nasa.gov/geode-py/ws"
UA = {"User-Agent": "SpaceApps2026-research/1.0"}


def _open(req, timeout=120):
    return urllib.request.urlopen(req, timeout=timeout)


def get_json(url):
    with _open(urllib.request.Request(url, headers=UA)) as r:
        return json.load(r)


def combustion_investigations():
    q = urllib.parse.urlencode({"size": 500, "ffield": "Research Area", "fvalue": "combustion science"})
    hits = get_json(f"{WS}/repo/search?{q}")["hits"]["hits"]
    return [h["_source"] for h in hits if h["_index"] == "investigation"]


def investigation(acc):
    return get_json(f"{WS}/repo/investigations/{acc}")


def file_tree(acc, version):
    body = json.dumps({"folder": "", "fileType": "study", "studyId": acc, "version": version}).encode()
    req = urllib.request.Request(f"{WS}/files/v2", data=body, method="POST",
                                 headers={**UA, "Content-Type": "application/json"})
    with _open(req) as r:
        return json.load(r)


def walk(node, path=()):
    """Genera (ruta_de_categorias, archivo) para cada archivo del árbol."""
    for f in node.get("files", []):
        if f.get("key") and not f.get("directory") and not f.get("displayName"):
            yield path, f
        else:
            yield from walk(f, path + (f.get("displayName") or f.get("key", "").rstrip("/").split("/")[-1],))


def presigned_url(acc, key):
    """URL S3 firmada para un archivo público (no restringido)."""
    fname = key.split("/")[-1]
    q = urllib.parse.urlencode({"file": fname, "redirect": "false"})
    with _open(urllib.request.Request(f"{WS}/studies/{acc}/download?{q}", headers=UA)) as r:
        return r.read().decode().strip().strip('"')
