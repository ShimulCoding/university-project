# Git Workflow Used In This Project

## Repository Rules
- One single root repository
- `frontend` and `backend` live inside the same repo
- npm workspaces are used
- Only one root `package-lock.json` is kept

## Branching Rule
- `main` stays stable
- Small safe changes can go directly to `main`
- Short-lived branches are recommended for larger, riskier, or multi-commit work

## Author Rule Used During Development
- Shimul-authored commits use:
  `git commit --author="Shimul <shimulc17@gmail.com>" -m "Shimul: Added/Fixed/Removed ..."`
- Nayem-authored commits used:
  `git commit --author="Nayem <nayem692003@gmail.com>" -m "Nayem: Added/Fixed/Removed ..."`

## Commit Message Rule Used During Development
- Shimul:
  `Shimul: what has been done`
- Nayem:
  `Nayem: what has been done`

## Collaboration Note
This project was intentionally developed in an alternating author cycle so both contributors could remain visible in the same repository history while working from the same codebase.
Inspect the latest commit before choosing the next author. Always commit from `E:\4.1\WEB +PROJECT\University-project`, push completed authorized changes to `origin/main` immediately, then verify with `git status -sb`.

## Practical Commands
### Pull latest
```powershell
git pull origin main --rebase
```

### Shimul commit
```powershell
git add .
git commit --author="Shimul <shimulc17@gmail.com>" -m "Shimul: Fixed short clear message"
```

### Nayem commit
```powershell
git add .
git commit --author="Nayem <nayem692003@gmail.com>" -m "Nayem: Added short clear message"
```

### Push
```powershell
git push origin main
git status -sb
```
