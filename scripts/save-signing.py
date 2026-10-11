#!/usr/bin/env python3
"""Save the team and bundle ID chosen in Xcode to iOS/Local.xcconfig, which git ignores, then regenerate the
project so it matches the repository again and updates pull cleanly.

Reads iOS/Harbor.xcodeproj/project.pbxproj, or with '-' a project file or diff on stdin:
    git stash show -p | python3 scripts/save-signing.py -
"""
import re, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
text=sys.stdin.read() if sys.argv[1:]==['-'] else (root/'iOS/Harbor.xcodeproj/project.pbxproj').read_text()
lines=[line for line in text.splitlines() if not line.startswith('-')] # in a diff, removed lines hold old values
def values(key):return [m.group(1) for line in lines for m in [re.search(rf'\b{key}"? = "?([^";]+)"?;',line)] if m]
team=next((v for v in values('DEVELOPMENT_TEAM') if re.fullmatch(r'[A-Z0-9]{10}',v)),None)
app=next((v for v in values('PRODUCT_BUNDLE_IDENTIFIER') if '$(' not in v and not v.endswith('.Extension') and v!='com.example.Harbor'),None)
if not team or not app:
 sys.exit('Choose your team and a bundle identifier of your own, such as com.yourname.Harbor, for the Harbor target under Signing & Capabilities in Xcode. Quit Xcode, then run this again.')
local=root/'iOS/Local.xcconfig'
local.write_text(f'// Written by scripts/save-signing.py. Git ignores this file.\nDEVELOPMENT_TEAM = {team}\nHARBOR_BUNDLE_ID = {app}\n')
subprocess.run([sys.executable,str(root/'scripts/generate-project.py')],check=True,stdout=subprocess.DEVNULL)
print(f'Saved team {team} and bundle ID {app} (extension {app}.Extension) to iOS/Local.xcconfig.')
