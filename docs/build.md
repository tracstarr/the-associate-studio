# Build Setup

## Toolchain

| Tool | Version | Location |
|------|---------|----------|
| Rust | 1.83.1 | `~/.cargo/bin/` via rustup |
| Rust target | `stable-x86_64-pc-windows-gnu` | GNU toolchain (not MSVC) |
| GCC (MinGW) | mingw-w64-x86_64-gcc | `C:/msys64/mingw64/bin/` |
| MSYS2 | latest | `C:/msys64/` |
| Node.js | 20.x | system |
| npm | 10.x | system |

## Required PATH (must set before any Rust build)

```bash
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
export PKG_CONFIG_PATH="/c/msys64/mingw64/lib/pkgconfig"
```

This is required because `git2` (libgit2) and `libz-sys` need `pkg-config` and a C compiler visible on PATH.

## Cargo config

`src-tauri/.cargo/config.toml` sets the linker:

```toml
[target.x86_64-pc-windows-gnu]
linker = "x86_64-w64-mingw32-gcc"
```

## Build commands

```bash
# Frontend dev server only (browser preview at http://localhost:1420)
cd /c/dev/ide && npm run dev

# Full Tauri dev (native .exe + hot reload)
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
cd /c/dev/ide && npm run tauri dev

# Cargo only (check Rust compiles without running)
cargo build --manifest-path /c/dev/ide/src-tauri/Cargo.toml --target x86_64-pc-windows-gnu

# Release build (.exe + installer)
export PATH="/c/msys64/mingw64/bin:$HOME/.cargo/bin:$PATH"
cd /c/dev/ide && npm run tauri build
```

## Hot reload behaviour

| Change | Reload mechanism |
|--------|-----------------|
| `.tsx` / `.ts` file | Vite HMR — instant, no rebuild |
| `.css` | Vite HMR — instant |
| `.rs` file | `tauri dev` watcher → cargo rebuild → restart exe (15-60s) |
| `Cargo.toml` (new dep) | cargo rebuild + download (slower) |

## Known issues and fixes

### "export ordinal too large" linker error
**Cause**: `cdylib` in `crate-type` causes Windows DLL to exceed 65,535 export ordinals.
**Fix**: Remove `cdylib` from `Cargo.toml`. Keep only `["staticlib", "rlib"]`.

### MinGW GCC not found
**Cause**: `C:/msys64/mingw64/bin` not on PATH.
**Fix**: Run `export PATH="/c/msys64/mingw64/bin:..."` before building.

### pkg-config not found (libgit2 / libz-sys build fails)
**Cause**: `PKG_CONFIG_PATH` not set.
**Fix**: `export PKG_CONFIG_PATH="/c/msys64/mingw64/lib/pkgconfig"`.

### Port 1420 already in use
**Cause**: Previous `npm run tauri dev` or `npm run dev` still running.
**Fix**: `netstat -ano | grep ":1420"` → `taskkill //F //PID {pid}`.

### MSYS2 install (first time)
```bash
winget install MSYS2.MSYS2
# Then in MSYS2 shell:
pacman -S mingw-w64-x86_64-gcc
```

## crate-type explanation

`Cargo.toml` for the Tauri lib:
```toml
[lib]
crate-type = ["staticlib", "rlib"]
```

- `staticlib` — required by Tauri's build system for linking
- `rlib` — required for unit tests and `cargo check`
- `cdylib` — **removed** (causes ordinal overflow on Windows)

## Dependency compile times (cold)

On first build, these crates are slow:
- `libgit2-sys` — compiles libgit2 from C source (~2 min)
- `portable-pty` — ConPTY bindings (~30s)
- `reqwest` — HTTP stack (~1 min)
- `tauri-runtime-wry` — WebView2 bindings (~2 min)

Total cold build: ~4-6 min. Incremental (Rust file change only): ~15-30s.
