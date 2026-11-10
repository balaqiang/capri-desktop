YOU ARE USING THE SKILL "boost-asio-pro" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Boost.Asio / standalone Asio

## Overview

Write async C++ networking code that compiles on the *user's* Boost, not the newest one. Asio's API changed shape three times (classic `io_service` → `io_context` → C++20 coroutines) and most Asio code on the internet is from the first era, so **pick the style from the toolchain first**, then follow that style's reference file.

**References:** [Boost.Asio](https://www.boost.org/doc/libs/latest/doc/html/boost_asio.html) · [standalone Asio](https://think-async.com/Asio/)

Use this skill whenever async C++ networking code is being written or reviewed — and especially when the target toolchain is old, where coroutine examples simply will not compile. The three worked implementations it references are CI-verified from Boost 1.62 (2016) through 1.90.

## Step 1: pick the style (do this before writing code)

Determine the Boost (or Asio) version and the C++ standard actually in use — `find_package(Boost)` output, `dpkg -l libboost-dev`, `brew info boost`, `CMAKE_CXX_STANDARD`, or ask. Do not assume the newest.

| Boost | C++ std | Style | Read |
|-------|---------|-------|------|

`io_context`, `make_strand`, `bind_executor`, `steady_timer`, `signal_set`, `async_read`/`async_write`/`async_read_until`, buffers and `resolver` are **library** features — identical in the coroutine and callback styles. Only the suspension mechanism differs.

## Step 2: version floors (verified by compiling, not from docs)

Reach for one of these and the build breaks on older distros:

| Feature | Floor |
|---------|-------|
| `experimental/awaitable_operators.hpp` (the `\|\|` / `&&` operators) | **Boost ≥ 1.77** / Asio ≥ 1.20 |
| `as_tuple` completion token | **Boost ≥ 1.79** / Asio ≥ 1.21 |
| `co_composed` (custom composed ops) | **Boost ≥ 1.85** / Asio ≥ 1.30 |
| 3-arg `asio::spawn(ex, fn, token)` | **Boost ≥ 1.80** (older Boost has only `spawn(ex, fn)`) |
| `any_io_executor` (`strand<any_io_executor>`, `tcp::socket`'s default executor) | **Boost ≥ 1.74** — the floor for the callback style; below it, use legacy `io_context::strand` |
| `io_context`, `make_strand`, `expires_after` | **Boost ≥ 1.66** — below it, classic `io_service` |

Distro floors that bite: **Debian bookworm ships Boost 1.74** (no `awaitable_operators.hpp` — `#include` fails outright), Ubuntu 20.04 ships 1.71 (no `any_io_executor`), Debian 9 ships 1.62.

Language, not library: the chrono literals `250ms` / `30s` are **C++14**. For a true C++11 build write `std::chrono::milliseconds(250)`.

## Step 3: the rules that are actually easy to get wrong

**A strand does not serialize writes.** A strand serializes handler *execution*, not whole composed operations. Two `async_write`s in flight on the same strand still **interleave bytes on the wire**. Full-duplex (a read loop plus concurrent pushes/replies) needs a per-connection strand **and** an outbound queue with an in-flight flag, so at most one `async_write` exists at a time. This is the single most common wrong answer about Asio.

**Buffers do not own memory.** `asio::buffer()` is a view. Storage must outlive the operation: coroutine locals are fine across `co_await` in the same frame; in callback style the same data must become a **member**, not a local.

**Connections must outlive their handlers.** `enable_shared_from_this`, and capture `self` in *every* `co_spawn` / handler — read loop, write loop, and each timer.

**Frame with composed reads.** `async_read` (fills the buffer exactly) for a length prefix and then the body; never `async_read_some`, which returns short.

**Wrap `as_tuple`.** Always `as_tuple(use_awaitable)`. Bare `as_tuple` resolves against the operation's default token and compiles in some contexts, fails in others.

**`async_accept(make_strand(...))` changes two things**: it forces an explicit completion token back on the call, and the accepted socket is `basic_stream_socket<tcp, strand<...>>`, not `tcp::socket`. Take it **by value** or with `auto` — binding it to `tcp::socket&` will not compile.

**Re-arming a timer resolves the pending wait with `operation_aborted`.** In an idle-timeout loop that is the signal to keep waiting, not an error.

**GCC needs `-fcoroutines`** for the C++20 style, and header-only Boost needs `BOOST_ERROR_CODE_HEADER_ONLY` defined in exactly one place (CMake).

## Anti-Patterns
