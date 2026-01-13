# 🪆 Pinocchio CPI Examples

> **High-performance Cross-Program Invocations for Solana using the Pinocchio Framework**

[![Solana](https://img.shields.io/badge/Solana-1.18+-blueviolet?logo=solana)](https://solana.com)
[![Rust](https://img.shields.io/badge/Rust-1.79+-orange?logo=rust)](https://www.rust-lang.org)
[![Pinocchio](https://img.shields.io/badge/Pinocchio-0.10+-green)](https://github.com/anza-xyz/pinocchio)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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

| Protocol         | Instruction        | Status         |
| ---------------- | ------------------ | -------------- |
| **Pump.fun**     | `buy_exact_sol_in` | ✅ Complete    |
| **Pump.fun**     | `sell`             | ✅ Complete    |
| **Raydium CPMM** | `swap_base_in`     | 🚧 In Progress |
| **Meteora**      | Coming soon        | 📋 Planned     |
| **Orca**         | Coming soon        | 📋 Planned     |

### 🎨 Token & NFT Programs

Interact with token standards:

| Protocol       | Description               | Status     |
| -------------- | ------------------------- | ---------- |
| **SPL Token**  | Standard token operations | 📋 Planned |
| **Token-2022** | Extended token features   | 📋 Planned |
| **Metaplex**   | NFT minting & metadata    | 📋 Planned |

### 🔮 Oracle Integrations

Fetch price data from decentralized oracles:

| Protocol | Description | Status     |
| -------- | ----------- | ---------- |
| **Pyth** | Price feeds | 📋 Planned |

<!--|      | **Switchboard** | Oracle network | 📋 Planned | -->

---

## 🛠️ Project Structure

```
pinocchio-cpi-examples/
├── advances/
│   ├── dexs/                    # DEX CPI implementations
│   │   ├── src/
│   │   │   └── instruction/
│   │   │       └── pump_fun/    # Pump.fun CPIs
│   │   │           ├── buy_exact_sol_in.rs
│   │   │           └── sell.rs
│   │   └── tests/               # Integration tests
│   │       └── pump_fun.rs
│   ├── metaplex-cpis/           # Metaplex integrations
│   └── oracle-cpis/             # Oracle integrations
├── pinocchio-helper/            # Shared utilities
└── Cargo.toml                   # Workspace config
```

---

## 🏃‍♂️ Quick Start

### Prerequisites

<!-- - Rust 1.79+ -->

- Solana CLI 3.1.5
- Surfpool (Local validator for testing)

### Build

```bash
# Clone the repository
git clone https://github.com/lainhathoang/pinocchio-cpi-examples.git
cd pinocchio-cpi-examples

# Build all programs
cargo build-sbf

# Run tests
# cargo test -p dexs --test pump_fun -- --nocapture
```

### Run Integration Tests (Localnet)

```bash
# Start local validator with cloned Pump.fun program
surfpool start
```

---

## 🧪 Testing

Each CPI implementation includes comprehensive tests:

- **Unit Tests**: Verify instruction serialization and PDA derivation
- **Integration Tests**: Execute real transactions on localnet
- **Token-2022 Support**: Full compatibility with the new token standard

```bash
# Run all tests
cargo test --workspace

# Run specific test with output
cargo test -p dexs test_pda_derivation -- --nocapture
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

<!-- ## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. -->

---

<div align="center">
  <p>
    <strong>Built with ❤️ for the Solana ecosystem</strong>
  </p>
  <p>
    <a href="https://github.com/lainhathoang/pinocchio-cpi-examples/stargazers">⭐ Star this repo</a> if you find it useful!
  </p>
</div>
