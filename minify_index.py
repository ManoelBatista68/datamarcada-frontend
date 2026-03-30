import re

def minify_ts(content):
    # Remove single line comments
    content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
    # Remove multi-line comments
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    # Remove multiple spaces
    content = re.sub(r' +', ' ', content)
    # Remove empty lines
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    return '\n'.join(lines)

with open(r'c:\Users\Administrador\DataMarcada\tmp_index.ts', 'r', encoding='utf-8') as f:
    original = f.read()

minified = minify_ts(original)

with open(r'c:\Users\Administrador\DataMarcada\min_index.ts', 'w', encoding='utf-8') as f:
    f.write(minified)

print(f"Original: {len(original)} bytes")
print(f"Minified: {len(minified)} bytes")
