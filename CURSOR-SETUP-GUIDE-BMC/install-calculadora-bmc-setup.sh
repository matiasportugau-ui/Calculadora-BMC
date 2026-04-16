#!/bin/bash

# ============================================================================
# CALCULADORA-BMC CURSOR DEVELOPMENT ENVIRONMENT SETUP
# Automated Installation Script for macOS Apple Silicon
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

print_header() {
  echo -e "${BLUE}═════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═════════════════════════════════════════════════════════${NC}"
}

print_success() {
  echo -e "${GREEN}✅  $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌  $1${NC}"
}

check_command() {
  if command -v $1 &> /dev/null; then
    print_success "$1 is installed"
    return 0
  else
    print_error "$1 is NOT installed"
    return 1
  fi
}

# ============================================================================
# MAIN SETUP
# ============================================================================

print_header "🚀 CALCULADORA-BMC CURSOR DEVELOPMENT SETUP"

# Check prerequisites
print_header "1️⃣  CHECKING PREREQUISITES"

echo "Checking required tools..."
MISSING_TOOLS=0

check_command "zsh" || MISSING_TOOLS=1
check_command "node" || MISSING_TOOLS=1
check_command "npm" || MISSING_TOOLS=1
check_command "git" || MISSING_TOOLS=1
check_command "vercel" || MISSING_TOOLS=1

if [ $MISSING_TOOLS -eq 1 ]; then
  print_error "Some required tools are missing. Install them first:"
  echo "  1. Install Node.js: brew install node"
  echo "  2. Install Vercel CLI: npm install -g vercel"
  exit 1
fi

print_success "All prerequisites installed"

# Get project path
print_header "2️⃣  CONFIGURE PROJECT PATH"

read -p "Enter your Calculadora-BMC project path (e.g., ~/Projects/Calculadora-BMC): " CALC_PATH

if [ ! -d "$CALC_PATH" ]; then
  print_error "Directory does not exist: $CALC_PATH"
  exit 1
fi

print_success "Project path: $CALC_PATH"

# Install Oh-My-Zsh if needed
print_header "3️⃣  SETTING UP OH-MY-ZSH"

if [ ! -d "$HOME/.oh-my-zsh" ]; then
  print_warning "Oh-My-Zsh not found. Installing..."
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
  print_success "Oh-My-Zsh installed"
else
  print_success "Oh-My-Zsh already installed"
fi

# Install plugins
print_header "4️⃣  INSTALLING ZSH PLUGINS"

# Syntax highlighting
if [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting" ]; then
  print_warning "Installing zsh-syntax-highlighting..."
  git clone https://github.com/zsh-users/zsh-syntax-highlighting.git \
    ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
  print_success "zsh-syntax-highlighting installed"
else
  print_success "zsh-syntax-highlighting already installed"
fi

# Autosuggestions
if [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions" ]; then
  print_warning "Installing zsh-autosuggestions..."
  git clone https://github.com/zsh-users/zsh-autosuggestions \
    ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
  print_success "zsh-autosuggestions installed"
else
  print_success "zsh-autosuggestions already installed"
fi

# Powerlevel10k theme
if [ ! -d "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k" ]; then
  print_warning "Installing Powerlevel10k theme..."
  git clone --depth=1 https://github.com/romkatv/powerlevel10k.git \
    ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k
  print_success "Powerlevel10k installed"
else
  print_success "Powerlevel10k already installed"
fi

# Setup .zshrc
print_header "5️⃣  CONFIGURING .ZSHRC"

# Backup existing .zshrc
if [ -f "$HOME/.zshrc" ]; then
  cp "$HOME/.zshrc" "$HOME/.zshrc.backup.$(date +%s)"
  print_success "Backed up existing .zshrc"
fi

# Copy new .zshrc with project path substitution
if [ -f ".zshrc_calculadora_bmc" ]; then
  sed "s|\$HOME/calculadora-bmc|$CALC_PATH|g" ".zshrc_calculadora_bmc" > "$HOME/.zshrc"
  print_success ".zshrc configured with project path"
else
  print_error ".zshrc_calculadora_bmc not found"
  exit 1
fi

# Setup environment file
print_header "6️⃣  SETTING UP ENVIRONMENT VARIABLES"

if [ ! -f "$CALC_PATH/.env.local" ]; then
  if [ -f ".env.local.example" ]; then
    cp ".env.local.example" "$CALC_PATH/.env.local"
    print_success ".env.local created (from template)"
    print_warning "Please update .env.local with your actual values"
  fi
else
  print_success ".env.local already exists"
fi

# Verify Vercel login
print_header "7️⃣  VERCEL AUTHENTICATION"

if vercel whoami &> /dev/null; then
  print_success "Vercel authenticated as: $(vercel whoami)"
else
  print_warning "Vercel authentication required"
  echo "Running: vercel login"
  vercel login
fi

# Install project dependencies
print_header "8️⃣  INSTALLING PROJECT DEPENDENCIES"

cd "$CALC_PATH"

if [ ! -d "node_modules" ]; then
  print_warning "Installing npm dependencies..."
  npm install
  print_success "Dependencies installed"
else
  print_success "node_modules already exists (skipping npm install)"
fi

# Final checks
print_header "9️⃣  VERIFICATION"

cd "$CALC_PATH"

# Check Node version
NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
print_success "npm version: $NPM_VERSION"

# Check git status
if git status &> /dev/null; then
  print_success "Git repository found"
else
  print_error "Not in a git repository"
fi

# ============================================================================
# FINAL INSTRUCTIONS
# ============================================================================

print_header "🎉 SETUP COMPLETE!"

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "1. Reload your shell:"
echo "   ${BLUE}exec zsh${NC}"
echo ""
echo "2. Verify installation:"
echo "   ${BLUE}calc${NC}  # Should navigate to your project"
echo ""
echo "3. Start development:"
echo "   ${BLUE}calcdev${NC}  # Should start dev server"
echo ""
echo "4. (Optional) Configure Cursor:"
echo "   ${BLUE}Cursor > Settings > Search 'Terminal Default Profile' > Set to 'zsh'${NC}"
echo ""
echo "5. Quick commands reference:"
echo "   ${BLUE}cat QUICK_REFERENCE.md${NC}"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to update .env.local with your actual values!${NC}"
echo ""

print_success "Happy coding! 🚀"
