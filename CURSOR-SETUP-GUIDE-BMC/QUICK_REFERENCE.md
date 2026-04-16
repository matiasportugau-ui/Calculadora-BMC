# 🚀 CALCULADORA-BMC: QUICK COMMAND REFERENCE

## Navigation
```bash
calc                 # Jump to Calculadora-BMC project
calcls               # List project files
```

## Development
```bash
calcsetup            # First-time setup (installs deps)
calcdev              # Start dev server (http://localhost:5173)
calcbuild            # Production build
calctest             # Run tests
calclint             # Check code style
```

## Git Workflow
```bash
calcstatus           # Show git status
calclog              # Last 10 commits
calcbranch           # List all branches
calcfeature <name>   # Create feature branch
gitsyncmain          # Sync with main
gitsquash <n>        # Squash last N commits
calcpr               # List PRs on GitHub
calcpropen           # Open PR in browser
```

## Vercel Deployment
```bash
calcvercel-preview   # Deploy preview (safe test)
calcdeploy           # Deploy to production
calcvercel-logs      # View deployment logs
calcvercel-env       # List env variables
calcdeploystatus     # Check deployment status
```

## Debugging
```bash
calcapi <url>        # Test API endpoint
calcwatch            # Watch build in real-time
calcprofile          # Profile React renders
calcbundlesize       # Analyze bundle size
```

## Maintenance
```bash
calcclean            # Clean npm cache
calcstruct           # Show project structure
calcfiles            # List all code files
cursoropen           # Open in Cursor
cursorsearch <term>  # Search codebase
```

---

## 📊 USEFUL VERCEL URLS

| Purpose | URL |
|---------|-----|
| **Production** | https://calculadora-bmc.vercel.app |
| **Dashboard** | https://vercel.com/[username]/calculadora-bmc |
| **Deployments** | https://vercel.com/[username]/calculadora-bmc/deployments |
| **Settings** | https://vercel.com/[username]/calculadora-bmc/settings |
| **Env Vars** | https://vercel.com/[username]/calculadora-bmc/settings/environment-variables |

---

## 🔄 TYPICAL WORKFLOW

### 1. Start coding
```bash
calc
calcdev
# → Opens http://localhost:5173
```

### 2. Make changes
```bash
# Edit files in Cursor
# Hot-reload happens automatically
```

### 3. Test before pushing
```bash
calctest
calclint
calcbuild
```

### 4. Create branch & commit
```bash
calcfeature my-new-feature
git add .
git commit -m "feat: add new dimensioning logic"
```

### 5. Push & preview
```bash
git push
calcvercel-preview
# → Test at generated URL
```

### 6. Merge to main on GitHub
```bash
# Create PR on GitHub
# Merge after code review
```

### 7. Deploy to production
```bash
gitsyncmain
calldeploy
# → Live at https://calculadora-bmc.vercel.app
```

---

## 🆘 COMMON ISSUES

| Problem | Solution |
|---------|----------|
| **Port 5173 in use** | `kill -9 $(lsof -t -i :5173)` |
| **npm modules broken** | `calcclean && npm install` |
| **Vercel login failed** | `vercel logout && vercel login` |
| **Build fails** | `calcbuild` (then check errors) |
| **API not responding** | `calcapi http://localhost:3000` |

---

## 📝 ENVIRONMENT SETUP

After initial installation:

```bash
# 1. Copy env template
cp .env.local.example .env.local

# 2. Edit with your values
nano .env.local

# 3. Reload shell
exec zsh

# 4. Verify
env | grep VITE_
```

---

## 🎯 FIRST TIME SETUP

```bash
# 1. Clone repo (if needed)
git clone <repo-url>

# 2. Setup
calc && calcsetup

# 3. Start developing
calcdev

# 4. Open in Cursor
cursoropen
```

---

**Saved as:** `~/.zshrc` (auto-loaded in every terminal)
**Update path in:** Line 13 of `.zshrc` → `export CALCULADORA_BMC_ROOT="..."`
