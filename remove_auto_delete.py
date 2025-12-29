import re
import os

# Directory containing slash commands
slash_dir = r'c:\github\UltimateMusic-Bot\commands\slash'

# Pattern to match .then(() => setTimeout(() => interaction.deleteReply().catch(() => {}), XXXX))
pattern = r'\.then\(\(\) => setTimeout\(\(\) => interaction\.deleteReply\(\)\.catch\(\(\) => \{\}\), \d+\)\)'

# Counter for replacements
total_replacements = 0
files_modified = []

# Process each .js file in the slash commands directory
for filename in os.listdir(slash_dir):
    if filename.endswith('.js'):
        filepath = os.path.join(slash_dir, filename)
        
        # Read file content
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Count matches
        matches = re.findall(pattern, content)
        if matches:
            # Replace all matches with empty string
            new_content = re.sub(pattern, '', content)
            
            # Write back to file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            total_replacements += len(matches)
            files_modified.append(f"{filename}: {len(matches)} replacements")
            print(f"✅ {filename}: Removed {len(matches)} auto-delete patterns")

print(f"\n📊 Summary:")
print(f"Total files modified: {len(files_modified)}")
print(f"Total replacements: {total_replacements}")
print("\nModified files:")
for file_info in files_modified:
    print(f"  - {file_info}")
