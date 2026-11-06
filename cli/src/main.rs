mod child;
mod launch;
mod prompt;
mod report;
mod review;
mod stream;

use std::process::ExitCode;

use clap::{Parser, Subcommand};

const EXIT_CHILD_FAILED: u8 = 1;
const EXIT_BAD_USAGE: u8 = 2;

#[derive(Parser)]
#[command(
    name = "ultrahand",
    about = "Run ultrahand UX reviews in lean headless Claude sessions"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Run one review as its own locked-down `claude -p` session
    Review(review::ReviewArgs),
}

fn main() -> ExitCode {
    child::watch_signals();
    let Cli {
        command: Command::Review(args),
    } = Cli::parse();
    match review::run(args) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::from(EXIT_CHILD_FAILED),
        Err(message) => {
            eprintln!("ultrahand: {message}");
            ExitCode::from(EXIT_BAD_USAGE)
        }
    }
}
