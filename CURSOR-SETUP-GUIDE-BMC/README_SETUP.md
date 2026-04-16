# 🎯 Calculadora-BMC: Complete Cursor Terminal Setup

**A production-ready development environment for React + Vercel + macOS Apple Silicon**

---

## ✅ Workspace (este repo) — ya integrado en Cursor

Si abrís **esta** carpeta como workspace en Cursor/VS Code:

- **Ajustes del proyecto:** [`.vscode/settings.json`](../.vscode/settings.json) — terminal zsh, variable `CALCULADORA_BMC_ROOT`, nesting y exclusiones alineadas al repo (sin Prettier; ESLint como en AGENTS.md).
- **Extensiones sugeridas:** [`.vscode/extensions.json`](../.vscode/extensions.json).
- **Alias opcionales en zsh:** [`scripts/shell-aliases-calculadora-bmc.zsh`](../scripts/shell-aliases-calculadora-bmc.zsh) — `source` desde tu `~/.zshrc` (ruta absoluta). `calcdev` usa `npm run dev:full` (API `:3001` + Vite `:5173`).

El instalador global de abajo (`install-calculadora-bmc-setup.sh`, Oh My Zsh, etc.) es **opcional** si solo querés el comportamiento dentro de este workspace.

---

## 📦 What's Included

This setup provides you with:

✅ **Optimized zsh configuration** with 30+ custom aliases  
✅ **Vercel deployment shortcuts** with safety checks  
✅ **Git workflow helpers** for feature branches  
✅ **React development tools** (build, lint, test)  
✅ **Environment variable management**  
✅ **Cursor IDE integration** with proper terminal profile  
✅ **Automated installation script** (one-command setup)  
✅ **Quick reference guides** for daily development  

---

## 📂 Generated Files

| File | Purpose | Location |
|------|---------|----------|
| `.zshrc_calculadora_bmc` | Main zsh configuration (30+ aliases) | `~/.zshrc` |
| `.env.local.example` | Environment variables template | `$PROJECT/.env.local` |
| `cursor_settings.json` | Cursor IDE optimal settings | `~/.config/Cursor/settings.json` |
| `CURSOR_SETUP_GUIDE.md` | Complete setup instructions | Read first |
| `QUICK_REFERENCE.md` | Command cheat sheet | Keep handy |
| `install-calculadora-bmc-setup.sh` | Automated installer | One command! |

---

## 🚀 Quick Start (3 Steps)

### Step 1: Run the automated installer
```bash
bash install-calculadora-bmc-setup.sh
```

The script will:
- ✅ Check for required tools (Node.js, npm, git, Vercel)
- ✅ Install Oh-My-Zsh and plugins
- ✅ Configure your zsh with project path
- ✅ Set up environment variables
- ✅ Verify Vercel authentication
- ✅ Install npm dependencies

### Step 2: Reload your shell
```bash
exec zsh
```

### Step 3: Start developing
```bash
calc          # Navigate to project
calcdev       # Start dev server
# Opens http://localhost:5173 🎉
```

---

## 🎯 Key Features

### 🧭 Navigation
```bash
calc          # Jump to Calculadora-BMC
calcls        # List project files
cursoropen    # Open in Cursor IDE
```

### 🔨 Development
```bash
calcdev       # Start dev server
calcbuild     # Production build
calctest      # Run tests
calclint      # Check code style
calcwatch     # Monitor build
```

### 🚀 Deployment
```bash
calcvercel-preview   # Safe preview deploy
calcdeploy          # Production deploy
calcvercel-logs     # View deployment logs
```

### 🌿 Git Workflow
```bash
calcfeature feature/my-feature   # Create feature branch
gitsyncmain                       # Sync with main
gitsquash 3                       # Squash last 3 commits
calcpr                            # View GitHub PRs
```

### 🧹 Maintenance
```bash
calcclean     # Clean npm cache
calcstruct    # Show project structure
calcapi       # Test API endpoints
calcbundlesize # Analyze bundle
```

---

## 🛠 What the Configuration Does

### zsh Configuration
- **30+ aliases** for faster typing
- **Git helpers** for common workflows
- **Vercel shortcuts** for safe deployments
- **Auto-completion** for npm & git commands
- **Syntax highlighting** for better readability

### Environment Setup
- **Local variables** (VERCEL_TOKEN, API URLs)
- **Feature flags** for development
- **API endpoints** configured
- **Node.js optimizations** for Apple Silicon
- **Security headers** configuration

### Cursor IDE Integration
- **Auto-detect zsh** as default terminal
- **Proper file nesting** (JSX + CSS modules)
- **Git integration** with visual diffs
- **ESLint & Prettier** auto-formatting
- **Enhanced debugging** tools
- **Performance optimizations** for React

---

## 📋 Manual Setup (If Preferred)

If you'd rather set up manually instead of running the script:

1. **Copy configuration:**
   ```bash
   cp .zshrc_calculadora_bmc ~/.zshrc
   ```

2. **Edit your project path:**
   ```bash
   # In ~/.zshrc, change line:
   export CALCULADORA_BMC_ROOT="$HOME/path/to/your/Calculadora-BMC"
   ```

3. **Setup environment:**
   ```bash
   cp .env.local.example $YOUR_PROJECT/.env.local
   nano $YOUR_PROJECT/.env.local  # Update values
   ```

4. **Configure Cursor:**
   - Open Cursor Settings → Search "Terminal Default Profile"
   - Set to `zsh`

5. **Install plugins** (optional, for nice prompts):
   ```bash
   git clone https://github.com/zsh-users/zsh-syntax-highlighting.git \
     ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
   ```

6. **Reload shell:**
   ```bash
   exec zsh
   ```

---

## ✨ Example Workflows

### Daily Development
```bash
calc
calcdev
# Make changes...
# Hot reload happens automatically
# Hit Ctrl+C to stop
```

### Before Pushing Code
```bash
calctest
calclint
calcbuild
git add .
git commit -m "feat: add dimensioning system"
git push
```

### Safe Deployment
```bash
# Test on preview first
calcvercel-preview
# → Check preview URL

# After testing, merge PR on GitHub

# Then deploy to production
gitsyncmain
calldeploy
```

### Feature Branch Workflow
```bash
calcfeature my-new-feature
# → Creates branch + pushes
# Make your changes...
calcstatus              # Check what's changed
calclog                 # View recent commits
gitsquash 3            # Clean up commits
git push --force       # Update PR
```

---

## 🔐 Security Notes

### Keep These Files Secret
- `.env.local` (never commit!)
- VERCEL_TOKEN (unique to your account)
- Database URLs
- API keys

### Before Deploying
- ✅ Check for secrets in code: `git log -p | grep -i secret`
- ✅ Verify .gitignore includes: `.env.local`, `node_modules`, `.next`, `dist`
- ✅ Rotate tokens regularly
- ✅ Use different env vars for dev/staging/prod

---

## 🆘 Troubleshooting

### `calc: command not found`
```bash
# Update CALCULADORA_BMC_ROOT in ~/.zshrc
echo $CALCULADORA_BMC_ROOT
# Should show your project path
```

### Port 5173 already in use
```bash
kill -9 $(lsof -t -i :5173)
# Or use different port:
PORT=5174 npm run dev
```

### npm install fails on Apple Silicon
```bash
calcclean
rm -rf node_modules package-lock.json
npm install --verbose
```

### Vercel deployment stuck
```bash
# Check status
calcvercel-logs

# Or manually deploy
vercel deploy --prod --debug
```

### Terminal history not working
```bash
# Reset zsh history
echo '' > ~/.zsh_history
exec zsh
```

---

## 📚 Documentation Files

| Document | Read When |
|----------|-----------|
| **CURSOR_SETUP_GUIDE.md** | First-time setup |
| **QUICK_REFERENCE.md** | Daily development |
| **cursor_settings.json** | Customizing IDE |
| **.env.local.example** | Configuring secrets |

---

## 🎓 Learning Resources

- **Cursor Docs:** https://cursor.com/docs
- **Vercel Deploy:** https://vercel.com/docs/deployments/overview
- **React:** https://react.dev
- **Vite:** https://vitejs.dev/guide/
- **npm Scripts:** https://docs.npmjs.com/cli/v8/commands/npm-run-script
- **oh-my-zsh Plugins:** https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins

---

## 💡 Pro Tips

1. **Use `calcwatch` during development** to see real-time builds
2. **Commit frequently** with clear messages for easier rebasing
3. **Test on preview** before production deploys
4. **Keep `.env.local` in sync** between local and Vercel
5. **Use feature branches** for all changes (never commit to main)
6. **Run linting locally** before pushing to catch errors early
7. **Monitor bundle size** with `calcbundlesize` to catch bloat
8. **Use Cursor's Cmd+K** to chat about code while editing

---

## 🐛 Reporting Issues

If something doesn't work:

1. **Check prerequisites:**
   ```bash
   node --version    # Should be 18+
   npm --version     # Should be 9+
   git --version
   zsh --version
   ```

2. **Check configuration:**
   ```bash
   echo $CALCULADORA_BMC_ROOT
   env | grep VERCEL
   ```

3. **View logs:**
   ```bash
   calcvercel-logs
   ```

4. **Check GitHub Issues** in the Calculadora-BMC repo

---

## 🎉 You're All Set!

Your development environment is now optimized for **rapid iteration** on Calculadora-BMC.

### Next Steps:
1. ✅ Run `calcsetup` to verify everything
2. ✅ Start with `calcdev` 
3. ✅ Open in Cursor with `cursoropen`
4. ✅ Keep QUICK_REFERENCE.md open for commands
5. ✅ Deploy safely with `calcvercel-preview` first

---

## 📞 Support

Need help?

- **Terminal not working:** Reload with `exec zsh`
- **Commands not found:** Update path in `~/.zshrc`
- **Cursor IDE issues:** Check `cursor_settings.json`
- **Vercel problems:** Run `vercel whoami` to verify auth
- **Git conflicts:** Use `gitsyncmain` to sync with main

---

**Built for Matias @ BMC Uruguay**  
**Optimized for Cursor IDE + React + Vercel on macOS Apple Silicon**

Happy coding! 🚀

---

**Last Updated:** April 16, 2026
