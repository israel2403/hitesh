#!/usr/bin/env python3
import sys, re, pathlib

# Settings
INDENT = "  "
COLLAPSE_WHITESPACE = True
TRIM_TEXT = True

VOID = {
    "area","base","br","col","embed","hr","img","input",
    "link","meta","param","source","track","wbr"
}
EXCLUDED = {"script","style","pre","textarea","template","svg","math","noscript","code"}

# Pattern:
#  - Matches <tag ...> TEXT </tag> where TEXT contains no '<'
#  - Case-insensitive, dotall, multiline
pattern = re.compile(r"<([A-Za-z][\w:-]*)\b([^>]*)>\s*([^<][^<]*?)\s*</\1>", re.S | re.M)

def transform(html: str) -> str:
    def repl(m):
        tag = m.group(1).lower()
        attrs = m.group(2) or ""
        inner = m.group(3)

        if tag in VOID or tag in EXCLUDED:
            return m.group(0)

        text = inner
        if COLLAPSE_WHITESPACE:
            text = re.sub(r"\s+", " ", text)
        if TRIM_TEXT:
            text = text.strip()
        if not text:
            return m.group(0)

        open_tag = f"<{tag}{attrs}>"
        close_tag = f"</{tag}>"
        return f"{open_tag}\n{INDENT}{text}\n{close_tag}"

    return pattern.sub(repl, html)

def process_file(p: pathlib.Path):
    html = p.read_text(encoding="utf-8", errors="replace")
    new_html = transform(html)
    if new_html != html:
        p.write_text(new_html, encoding="utf-8")

def main():
    if len(sys.argv) < 2:
        print("Usage: format_html.py <file-or-glob> [more files...]", file=sys.stderr)
        sys.exit(1)

    for arg in sys.argv[1:]:
        for p in sorted(pathlib.Path().glob(arg)):
            if p.is_file() and p.suffix.lower() == ".html":
                process_file(p)

if __name__ == "__main__":
    main()
