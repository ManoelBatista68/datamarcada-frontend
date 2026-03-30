import re

def super_minify(content):
    # Remove all comments
    content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    # Remove console.log
    content = re.sub(r'console\.log\(.*?\);?', '', content)
    # Remove excessive whitespace
    content = re.sub(r'\s+', ' ', content)
    # Remove spaces around operators
    content = re.sub(r'\s*([=+\-*/%{}()\[\],:;])\s*', r'\1', content)
    return content.strip()

with open(r'c:\Users\Administrador\DataMarcada\tmp_index.ts', 'r', encoding='utf-8') as f:
    original = f.read()

minified = super_minify(original)

with open(r'c:\Users\Administrador\DataMarcada\super_min_index.ts', 'w', encoding='utf-8') as f:
    f.write(minified)

print(f"Original: {len(original)} bytes")
print(f"Super Minified: {len(minified)} bytes")
