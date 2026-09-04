import os

replacements = [
    ("SerialTenant", "SerialOutlet"),
    ("serial_tenant", "serial_outlet"),
    ("serial_business", "serial_outlet") # wait, serial_business should be kept for Business. 
]

for root, dirs, files in os.walk("."):
    if ".git" in root or "scratch" in root:
        continue
    for file in files:
        if file.endswith((".go", ".sql", ".md")):
            filepath = os.path.join(root, file)
            with open(filepath, "r") as f:
                content = f.read()
            
            new_content = content
            for old, new in replacements:
                if old == "serial_business": continue
                new_content = new_content.replace(old, new)
                
            if new_content != content:
                with open(filepath, "w") as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
