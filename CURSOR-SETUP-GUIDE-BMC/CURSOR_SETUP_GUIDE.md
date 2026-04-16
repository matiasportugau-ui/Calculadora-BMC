# 🚀 Calculadora-BMC: Cursor Terminal Setup Guide
**macOS Apple Silicon | zsh Configuration | Vercel Deployment**

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Cursor Integration](#cursor-integration)
4. [Workflow Commands](#workflow-commands)
5. [Deployment Checklist](#deployment-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required:
- macOS (Apple Silicon M1/M2/M3+)
- Cursor IDE installed
- Node.js 18+ (via Homebrew)
- Git configured
- Vercel CLI installed
- GitHub CLI (optional but recommended)

### Check installed versions:
```bash
node --version        # Should be 18.x or higher
npm --version         # Should be 9.x or higher
git --version         # Should be 2.x or higher
zsh --version         # macOS default (5.x+)
vercel --version      # Vercel CLI
```

---

## Installation Steps

### Step 1: Install Oh-My-Zsh (if not already installed)

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### Step 2: Install Recommended Plugins

```bash
# Syntax highlighting
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

# Autosuggestions
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions

# Powerlevel10k theme (optional but beautiful)
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
```

### Step 3: Apply the Calculadora-BMC Configuration

```bash
# Copy the configuration file to your home directory
cp .zshrc_calculadora_bmc ~/.zshrc

# OR if you already have a .zshrc, append it:
cat .zshrc_calculadora_bmc >> ~/.zshrc

# Reload zsh
exec zsh
```

### Step 4: Configure Vercel Token

```bash
# Login to Vercel (one-time setup)
vercel login

# The token will be stored automatically
# Verify it's set:
echo $VERCEL_TOKEN
```

### Step 5: Set Project Path (IMPORTANT!)

Edit `~/.zshrc` and update:
```bash
export CALCULADORA_BMC_ROOT="$HOME/path/to/your/Calculadora-BMC"
```

Example if your repo is at `~/Projects/Calculadora-BMC`:
```bash
export CALCULADORA_BMC_ROOT="$HOME/Projects/Calculadora-BMC"
```

### Step 6: Verify Setup

```bash
# Test the configuration
calc                  # Should navigate to your project
calcsetup            # Should install dependencies
calcdev              # Should start dev server on http://localhost:5173
```

---

## Cursor Integration

### Configure Cursor to Use zsh

1. **Open Cursor Settings** → `Cursor > Settings` (macOS: `Cmd + ,`)
2. **Search for "Terminal Default Profile"**
3. **Set to:** `zsh`

### Keyboard Shortcuts in Cursor

Add these to `~/.config/Cursor/keybindings.json` (or equivalent):

```json
[
  {
    "key": "cmd+shift+r",
    "command": "workbench.action.terminal.new",
    "when": "terminalFocus"
  },
  {
    "key": "cmd+shift+y",
    "command": "workbench.action.toggleTerminal"
  }
]
```

### Integrated Terminal in Cursor

- **Open Terminal:** `Ctrl + ` `` (backtick)
- **New Terminal Tab:** `Cmd + Shift + [`
- **Run Quick Commands:** Use Cursor's command palette + terminal aliases

---

## Workflow Commands

### 🎯 Quick Start

```bash
# First time setup
calcsetup

# Start development
calcdev

# Build for production
calcbuild

# Check status
calcstatus
```

### 🌿 Feature Branch Workflow

```bash
# Create and push a feature branch
calcfeature feature/new-dimensioning-feature

# Check branch status
calcbranch

# Sync with main
gitsyncmain

# Squash commits before merge
gitsquash 3  # Squash last 3 commits
```

### 🚀 Deployment

```bash
# Preview deployment (generates a URL)
calcvercel-preview

# Deploy to production
calcdeploy

# Check deployment status
calcdeploystatus

# View deployment logs
calcvercel-logs

# Monitor environment variables
calcenvshow
```

### 🧹 Maintenance

```bash
# Clean npm cache and node_modules
calcclean

# File structure inspection
calcstruct

# List JSX/JS files in project
calcfiles
```

### 🔍 Debugging

```bash
# Test API endpoint
calcapi http://localhost:3000

# Monitor build in real-time
calcwatch

# Profile React renders
calcprofile

# Analyze bundle size
calcbundlesize
```

### 🔐 Git Helpers

```bash
# View recent commits
calclog

# Check uncommitted changes
calcstatus

# Open GitHub PR list in browser
calcpr

# View current PR
calcpropen
```

---

## Deployment Checklist

Before running `calcdeploy`:

- [ ] All tests passing: `calctest`
- [ ] Linting clean: `calclint`
- [ ] No console warnings/errors in dev
- [ ] All commits pushed to branch
- [ ] Environment variables set on Vercel
- [ ] Feature branch merged to main (or manual deploy via `calcvercel-preview`)
- [ ] Tested on preview deployment first

### Safe Deployment Flow

```bash
# 1. Verify local state
calcstatus

# 2. Build locally
calcbuild

# 3. Deploy to preview
calcvercel-preview
# → Test at generated preview URL

# 4. If preview looks good, merge to main on GitHub

# 5. Production deploy
calcdeploy
```

---

## Troubleshooting

### ❌ "calc: command not found"

**Cause:** `CALCULADORA_BMC_ROOT` not set or incorrect.

**Fix:**
```bash
# Check if path is set
echo $CALCULADORA_BMC_ROOT

# Update ~/.zshrc with correct path
nano ~/.zshrc
# Find: export CALCULADORA_BMC_ROOT="..."
# Update to your actual project path

# Reload
exec zsh
```

### ❌ "calcdev not working / port already in use"

**Cause:** Another dev server is running.

**Fix:**
```bash
# Find process on port 5173
lsof -i :5173

# Kill it (get PID from above)
kill -9 <PID>

# Or just use a different port
PORT=5174 npm run dev
```

### ❌ "Vercel login failed"

**Cause:** Token expired or missing.

**Fix:**
```bash
# Re-authenticate
vercel logout
vercel login

# Verify token
echo $VERCEL_TOKEN
```

### ❌ "npm install hangs or fails"

**Cause:** npm cache corruption (common on Apple Silicon).

**Fix:**
```bash
# Clean everything
calcclean

# Force reinstall
rm -rf node_modules package-lock.json
npm install --verbose

# Or use yarn
yarn install
```

### ❌ "Build size too large"

**Check:**
```bash
calcbundlesize

# Look for:
# - Unused dependencies
# - Large images not optimized
# - Duplicate code
```

---

## 📚 Useful Resources

- **Cursor IDE Docs:** https://cursor.com/docs
- **Vercel Deployment:** https://vercel.com/docs
- **React Performance:** https://react.dev/learn/render-and-commit
- **oh-my-zsh:** https://ohmyzsh.sh
- **Node.js on Apple Silicon:** https://support.apple.com/en-us/HT211238

---

## 🎯 Next Steps

1. **Copy `.zshrc_calculadora_bmc` to your home directory**
2. **Update `CALCULADORA_BMC_ROOT` path**
3. **Run `calcsetup` to verify everything works**
4. **Start developing with `calcdev`**
5. **Use `calcvercel-preview` for safe testing**

---

## 💡 Pro Tips

- **Use `calcwatch` during development** to see hot-reload in action
- **Commit frequently with clear messages** for better rebase workflow
- **Test on preview deployment before going to production**
- **Keep environment variables synced** between local and Vercel
- **Use Cursor's AI features** to analyze errors in the integrated terminal

---

**Happy coding! 🚀**
