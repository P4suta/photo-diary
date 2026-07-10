# photo-diary の開発コンテナ。
# 方針: このリポジトリは chezmoi + mise 運用。ツールの版は mise.toml が固定するので、
# ここでは「mise が動く土台」と「Tauri v2 の Linux ビルドに必要なシステム依存」だけ用意する。
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# --- Tauri v2 の Linux ビルド依存 + 一般ビルドツール ---
# (WebKitGTK / GTK3 / rsvg / appindicator / xdo。frontend+コアだけなら不要だが、
#  コンテナ内で cargo build / tauri build まで通せるように入れておく。)
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        build-essential curl wget file pkg-config libssl-dev \
        libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
        libayatana-appindicator3-dev libxdo-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# --- mise（node/pnpm/rust/biome/just/lefthook/typos/committed/taplo を供給）---
USER vscode
RUN curl -fsSL https://mise.run | sh \
    && echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc \
    && echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc
ENV PATH="/home/vscode/.local/bin:${PATH}"
