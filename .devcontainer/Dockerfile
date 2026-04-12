FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# 基本ツール
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    jq \
    ripgrep \
    fd-find \
    fzf \
    tmux \
    tree \
    htop \
    zsh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Claude Code ネイティブインストール
RUN curl -fsSL https://claude.ai/install.sh | bash

# zshをデフォルトシェルに
RUN chsh -s $(which zsh) node

USER node
WORKDIR /workspace
