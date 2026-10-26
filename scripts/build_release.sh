#!/usr/bin/env bash
# ==============================================================================
# AI Meets: Multi-OS Release Build & GitHub Dispatch Script
# ==============================================================================
# Usage:
#   ./scripts/build_release.sh                  # Build local bundles for current OS
#   ./scripts/build_release.sh --push           # Tag, push to GitHub & trigger multi-OS CI
#   ./scripts/build_release.sh --gh-release     # Build locally & upload to GitHub Release
#   ./scripts/build_release.sh --help           # Show available options
# ==============================================================================

set -euo pipefail

# ANSI Color Palette (Studio Terminal)
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[36m"
C_GREEN="\033[32m"
C_AMBER="\033[33m"
C_ROSE="\033[31m"
C_DIM="\033[2m"

info()    { echo -e "${C_CYAN}${C_BOLD}ℹ ${C_RESET} $*"; }
success() { echo -e "${C_GREEN}${C_BOLD}✓ ${C_RESET} $*"; }
warn()    { echo -e "${C_AMBER}${C_BOLD}▲ ${C_RESET} $*"; }
error()   { echo -e "${C_ROSE}${C_BOLD}✖ ${C_RESET} $*" >&2; }

# Project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Defaults
DO_BUILD=true
DO_PUSH=false
DO_GH_RELEASE=false
IS_DRAFT=false
TARGET_TAG=""

show_help() {
  echo -e "${C_BOLD}AI Meets Release Builder${C_RESET}

${C_CYAN}SYNOPSIS:${C_RESET}
  ./scripts/build_release.sh [OPTIONS]

${C_CYAN}OPTIONS:${C_RESET}
  --tag <vX.Y.Z>     Specify target release version tag (defaults to package.json version)
  --push             Create git tag and push to GitHub to trigger multi-OS CI matrix
                     (builds macOS DMG/App, Windows MSI/EXE, and Linux DEB/AppImage in parallel)
  --gh-release       Create GitHub Release with local binaries via GitHub CLI (gh)
  --draft            Create the GitHub release as draft (used with --gh-release)
  --skip-build       Skip local Tauri build (useful when only pushing tag to CI)
  -h, --help         Display this help message

${C_CYAN}EXAMPLES:${C_RESET}
  ./scripts/build_release.sh
  ./scripts/build_release.sh --tag v0.2.2 --push
  ./scripts/build_release.sh --tag v0.2.2 --gh-release"
}

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TARGET_TAG="$2"
      shift 2
      ;;
    --push)
      DO_PUSH=true
      shift
      ;;
    --gh-release)
      DO_GH_RELEASE=true
      shift
      ;;
    --draft)
      IS_DRAFT=true
      shift
      ;;
    --skip-build)
      DO_BUILD=false
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Check CLI dependencies
check_tool() {
  if ! command -v "$1" &> /dev/null; then
    error "Required command '$1' is not installed or not in PATH."
    exit 1
  fi
}

check_tool "git"
check_tool "pnpm"
check_tool "cargo"

if [[ "$DO_PUSH" == "true" || "$DO_GH_RELEASE" == "true" ]]; then
  check_tool "gh"
fi

# Detect platform
OS_NAME="$(uname -s)"
ARCH_NAME="$(uname -m)"

info "Detected Host OS: ${C_BOLD}${OS_NAME} (${ARCH_NAME})${C_RESET}"

# Resolve target tag from package.json if not specified
if [[ -z "${TARGET_TAG}" ]]; then
  PKG_VERSION=$(node -p "require('./package.json').version")
  TARGET_TAG="v${PKG_VERSION}"
fi

info "Release Tag: ${C_BOLD}${TARGET_TAG}${C_RESET}"

# Output directory for artifacts
OUT_DIR="${PROJECT_ROOT}/release_artifacts"
mkdir -p "${OUT_DIR}"

if [[ "$DO_BUILD" == "true" ]]; then
  info "Running frontend tests and build..."
  pnpm build

  info "Running Rust unit tests..."
  cargo test --manifest-path src-tauri/Cargo.toml

  info "Building release bundle for ${OS_NAME}..."
  case "${OS_NAME}" in
    Darwin)
      # macOS
      pnpm tauri build --bundles app,dmg
      
      BUNDLE_PATH="src-tauri/target/release/bundle"
      if [[ -d "${BUNDLE_PATH}/dmg" ]]; then
        cp -f ${BUNDLE_PATH}/dmg/*.dmg "${OUT_DIR}/" 2>/dev/null || true
      fi
      if [[ -d "${BUNDLE_PATH}/macos" ]]; then
        (cd "${BUNDLE_PATH}/macos" && tar -czf "${OUT_DIR}/AI-Meets-${TARGET_TAG}-macos-${ARCH_NAME}.app.tar.gz" "AI Meets.app")
      fi
      ;;
    Linux)
      # Linux
      pnpm tauri build --bundles deb,appimage
      BUNDLE_PATH="src-tauri/target/release/bundle"
      if [[ -d "${BUNDLE_PATH}/deb" ]]; then
        cp -f ${BUNDLE_PATH}/deb/*.deb "${OUT_DIR}/" 2>/dev/null || true
      fi
      if [[ -d "${BUNDLE_PATH}/appimage" ]]; then
        cp -f ${BUNDLE_PATH}/appimage/*.AppImage "${OUT_DIR}/" 2>/dev/null || true
      fi
      ;;
    MINGW*|CYGWIN*|MSYS*)
      # Windows
      pnpm tauri build --bundles msi,nsis
      BUNDLE_PATH="src-tauri/target/release/bundle"
      if [[ -d "${BUNDLE_PATH}/msi" ]]; then
        cp -f ${BUNDLE_PATH}/msi/*.msi "${OUT_DIR}/" 2>/dev/null || true
      fi
      if [[ -d "${BUNDLE_PATH}/nsis" ]]; then
        cp -f ${BUNDLE_PATH}/nsis/*.exe "${OUT_DIR}/" 2>/dev/null || true
      fi
      ;;
    *)
      warn "Unknown OS '${OS_NAME}', falling back to default tauri build"
      pnpm tauri build
      ;;
  esac

  info "Generating SHA256 checksums..."
  (cd "${OUT_DIR}" && shasum -a 256 * > SHA256SUMS.txt 2>/dev/null || sha256sum * > SHA256SUMS.txt 2>/dev/null || true)

  success "Local release bundles created in: ${OUT_DIR}"
  ls -lh "${OUT_DIR}"
fi

# Push tag to GitHub to trigger multi-OS CI workflow
if [[ "$DO_PUSH" == "true" ]]; then
  info "Checking git status..."
  if ! git diff-index --quiet HEAD --; then
    warn "Uncommitted changes detected. Stashing or commit before tagging is recommended."
  fi

  info "Tagging commit with ${TARGET_TAG}..."
  if git rev-parse "${TARGET_TAG}" >/dev/null 2>&1; then
    warn "Tag ${TARGET_TAG} already exists locally. Recreating..."
    git tag -d "${TARGET_TAG}"
  fi

  git tag -a "${TARGET_TAG}" -m "Release ${TARGET_TAG}: AI Meets Real-Time Translator & Copilot"

  info "Pushing tag ${TARGET_TAG} to origin..."
  git push origin "${TARGET_TAG}" --force

  success "Tag ${TARGET_TAG} pushed to GitHub!"
  info "GitHub Actions Multi-OS Release Matrix workflow will now build for:"
  echo "  - macOS (Universal / aarch64 & x86_64 DMG & App)"
  echo "  - Windows (x64 MSI installer & NSIS Setup EXE)"
  echo "  - Linux (Ubuntu/Debian DEB & AppImage)"
  info "Watch progress at: https://github.com/hscale/ai-meets/actions"
fi

# Create GitHub Release with local files
if [[ "$DO_GH_RELEASE" == "true" ]]; then
  info "Publishing release via GitHub CLI..."

  RELEASE_FILES=()
  for file in "${OUT_DIR}"/*; do
    if [[ -f "$file" ]]; then
      RELEASE_FILES+=("$file")
    fi
  done

  DRAFT_FLAG=""
  if [[ "$IS_DRAFT" == "true" ]]; then
    DRAFT_FLAG="--draft"
  fi

  gh release create "${TARGET_TAG}" "${RELEASE_FILES[@]}" \
    --title "AI Meets ${TARGET_TAG}" \
    --notes "### AI Meets ${TARGET_TAG}

- Real-Time Meeting Translation & Dialogue Stream
- AI Answer Suggestion Copilot with Knowledge Profiles
- Multi-Window Floating HUDs (Split & Docked)
- Auto-Detect Meeting Language & Hybrid AI Model Support

See [CHANGELOG.md](https://github.com/hscale/ai-meets/blob/main/CHANGELOG.md) for full release details." \
    $DRAFT_FLAG

  success "GitHub release created: https://github.com/hscale/ai-meets/releases/tag/${TARGET_TAG}"
fi

success "Release procedure completed successfully!"
