"""Descarga las fichas públicas de NASA Task Book (Combustion Science) a JSON + CSV.

La lista de TASKIDs (data/taskbook/taskids_combustion_science.txt) se obtuvo buscando
en taskbook.nasaprs.com con el filtro Physical Sciences > COMBUSTION SCIENCE (138 proyectos).
"""
import csv, html, json, os, re, time, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "taskbook")
URL = "https://taskbook.nasaprs.com/tbp/index.cfm?action=public_query_taskbook_content&TASKID={}"
FIELDS = ["Project Title", "Fiscal Year", "Division", "Research Discipline/Element", "Start Date", "End Date",
          "Principal Investigator/Affiliation", "Responsible Center", "Flight Program", "Grant/Contract No.",
          "Task Description", "Research Impact/Earth Benefits", "Task Progress", "Bibliography"]


def text_of(page):
    page = re.sub(r"(?s)<(script|style).*?</\1>", "", page)
    page = re.sub(r"(?i)<br\s*/?>|</p>|</tr>|</li>", "\n", page)
    t = html.unescape(re.sub(r"<[^>]+>", " ", page))
    return re.sub(r"[ \t\r\f\v]+", " ", t)


def parse(t):
    pos = sorted((m.start(), f) for f in FIELDS for m in [re.search(re.escape(f) + r":", t)] if m)
    out = {}
    for i, (p, f) in enumerate(pos):
        end = pos[i + 1][0] if i + 1 < len(pos) else len(t)
        out[f] = re.sub(r"\s*\n\s*", "\n", t[p + len(f) + 1:end]).strip()
    if "Project Title" in out:
        out["Project Title"] = re.sub(r"\s*Reduce$", "", out["Project Title"])
    return out


def main():
    ids = open(os.path.join(ROOT, "taskids_combustion_science.txt")).read().split()
    rows = []
    for i, tid in enumerate(ids, 1):
        req = urllib.request.Request(URL.format(tid), headers={"User-Agent": "SpaceApps2026-research/1.0"})
        page = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        rec = {"taskid": tid, "url": URL.format(tid), **parse(text_of(page))}
        rows.append(rec)
        print(f"{i:3}/{len(ids)} {rec.get('Project Title', '?')[:80]}", flush=True)
        time.sleep(0.3)
    with open(os.path.join(ROOT, "taskbook_combustion.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    short = ["taskid", "Project Title", "Principal Investigator/Affiliation", "Start Date", "End Date",
             "Research Discipline/Element", "Flight Program", "Responsible Center", "url"]
    with open(os.path.join(ROOT, "taskbook_combustion.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=short, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    main()
