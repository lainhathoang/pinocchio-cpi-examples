#![no_std]
#![allow(unexpected_cfgs)]
#![allow(unused_imports)]

mod entrypoint;
pub mod error;
pub mod instruction;
pub mod state;

use crate::entrypoint::process_instruction;
#[cfg(not(feature = "std"))]
#[cfg(not(feature = "no-entrypoint"))]
use pinocchio::program_entrypoint;
use pinocchio::{default_panic_handler, no_allocator};

pinocchio_pubkey::declare_id!("4Jseg6sWcn8Lb9ycWHEuZo48B5n8ZwUdL6MfHbPhPdnW");

#[cfg(not(feature = "std"))]
no_allocator!();
#[cfg(not(feature = "std"))]
default_panic_handler!();

#[cfg(not(feature = "no-entrypoint"))]
program_entrypoint!(process_instruction);
