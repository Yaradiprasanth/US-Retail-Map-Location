import re
import sys

path = sys.argv[1]
data = open(path, "rb").read()
urls = re.findall(rb"https?://[^\s\)\>\]<\"']+", data)
for u in sorted(set(urls)):
    print(u.decode("latin-1", "ignore"))

# Also look for URI annotations
for m in re.finditer(rb"/URI\s*\(([^)]+)\)", data):
    print("URI:", m.group(1).decode("latin-1", "ignore"))
