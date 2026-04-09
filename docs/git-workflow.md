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
- Shimul committed normally using the configured local git identity
- Nayem-authored commits used:
  `git commit --author="Nayem <nayem692003@gmail.com>" -m "Nayem: ..."`

## Commit Message Rule Used During Development
- Shimul:
  `Shimul: what has been done`
- Nayem:
  `Nayem: what has been done`

## Collaboration Note
This project was intentionally developed in an alternating author cycle so both contributors could remain visible in the same repository history while working from the same codebase.

## Practical Commands
### Pull latest
```powershell
git pull origin main --rebase
```

### Shimul commit
```powershell
git add .
git commit -m "Shimul: short clear message"
```

### Nayem commit
```powershell
git add .
git commit --author="Nayem <nayem692003@gmail.com>" -m "Nayem: short clear message"
```

### Push
```powershell
git push origin main
```
