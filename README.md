# 🪆 Pinocchio CPI Examples

> **High-performance Cross-Program Invocations for Solana using the Pinocchio Framework**

[![Solana](https://img.shields.io/badge/Solana-1.18+-blueviolet?logo=solana)](https://solana.com)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange?logo=rust)](https://www.rust-lang.org)
[![Pinocchio](https://img.shields.io/badge/Pinocchio-0.6+-green)](https://github.com/anza-xyz/pinocchio)

A comprehensive collection of **zero-dependency Solana programs** demonstrating how to perform Cross-Program Invocations (CPIs) to popular Solana protocols using the lightweight [Pinocchio](https://github.com/anza-xyz/pinocchio) framework.

---

## 🚀 Why Pinocchio?

| Feature           | Pinocchio | Traditional `solana-program` |
| ----------------- | --------- | ---------------------------- |
| **Binary Size**   | ~3KB      | ~30KB+                       |
| **Compute Units** | Optimized | Standard                     |
| **Dependencies**  | Zero      | Many                         |
| **Build Time**    | Fast      | Slower                       |

Pinocchio is a **no_std**, zero-dependency library that provides significant performance improvements over the traditional `solana-program` crate, making it ideal for production-grade Solana programs.

---

## 📦 What's Inside

### 🏦 DEX Integrations

Perform swaps and trades on popular decentralized exchanges:

| Protocol         | Instruction        | Status      |
| ---------------- | ------------------ | ----------- |
| **Pump.fun**     | `buy_exact_sol_in` | ✅ Complete |
| **Pump.fun**     | `sell`             | ✅ Complete |
| **Raydium CPMM** | `swap_base_input`  | ✅ Complete |
| **Raydium CPMM** | `swap_base_output` | ✅ Complete |
| **Meteora**      | Coming soon        | 📋 Planned  |
| **Orca**         | Coming soon        | 📋 Planned  |

---

## 🛠️ Project Structure

```
pinocchio-cpi-examples/
├── advances/
│   └── dexs/                    # DEX CPI implementations
│       ├── src/
│       │   ├── instruction/
│       │   │   ├── pump_fun/    # Pump.fun CPIs
│       │   │   │   ├── buy_exact_sol_in.rs
│       │   │   │   └── sell.rs
│       │   │   └── raydium_cpmm/# Raydium CPMM CPIs (New)
│       │   │       ├── swap_base_input.rs
│       │   │       └── swap_base_output.rs
│       │   └── entrypoint.rs
├── clients/                     # Generated clients (Simulated)
│   └── dexs/
│       ├── js/                  # TypeScript client
│       └── rust/                # Rust client
├── tests/                       # TypeScript Integration Tests
│   └── dexs/
│       ├── buy_exact_sol_in.ts
│       ├── sell.ts
│       ├── raydium_cpmm_swap_base_input.ts
│       ├── raydium_cpmm_swap_base_output.ts
│       ├── pump_fun_utils.ts
│       └── raydium_cpmm_utils.ts
└── idls/                        # Generated IDLs (Shank)
```

---

## 🏃‍♂️ Quick Start

### Prerequisites

- Solana CLI 1.18+
- Bun (for running TypeScript tests) (or Node.js + ts-node)
- Surfpool or Local Validator

### Build Programs

```bash
# Clone the repository
git clone https://github.com/lainhathoang/pinocchio-cpi-examples.git
cd pinocchio-cpi-examples

# Build all programs using SBF (Solana BPF)
# This command ensures dependencies are built correctly
cargo build-sbf
```

### Run Integration Tests

Tests are written in TypeScript and run against a local validator (localnet).

1. **Start Local Validator**

### Run Integration Tests

Tests are written in TypeScript and run against a local validator (localnet).

1. **Start Local Validator**

   Use `surfpool` to start a local validator with cloned accounts from mainnet.

   ```bash
   surfpool start
   ```

2. **Deploy Program**

   Deploy the built program to localnet to the specific Program ID used in tests (`soGjzMzHhQ4pCR8bydyU7DHMJ4AxddLxsGbhUotGMP7`).

   ```bash
   solana program deploy target/sbf/deploy/dexs.so --program-id soGjzMzHhQ4pCR8bydyU7DHMJ4AxddLxsGbhUotGMP7 --use-rpc
   ```

3. **Run Tests with Bun**

   We use `bun` for fast execution of TypeScript tests.

   ```bash
   # Install dependencies
   pnpm install

   # Run Pump.fun tests
   bun tests/dexs/buy_exact_sol_in.ts
   bun tests/dexs/sell.ts

   # Run Raydium CPMM tests
   bun tests/dexs/raydium_cpmm_swap_base_input.ts
   bun tests/dexs/raydium_cpmm_swap_base_output.ts
   ```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Add new CPI implementations** - Pick a protocol from the roadmap
2. **Improve documentation** - Help others understand the code
3. **Report bugs** - Open an issue if you find something broken
4. **Suggest protocols** - What CPIs would you like to see?

---

## 📚 Resources

- [Pinocchio Documentation](https://docs.rs/pinocchio)
- [Pinocchio GitHub](https://github.com/anza-xyz/pinocchio)
- [Solana CPI Guide](https://solana.com/docs/core/cpi)

---

<div align="center">
  <p>
    <strong>Built with ❤️ for the Solana ecosystem</strong>
  </p>
  <p>
    <a href="https://github.com/lainhathoang/pinocchio-cpi-examples/stargazers">⭐ Star this repo</a> if you find it useful!
  </p>
</div>
