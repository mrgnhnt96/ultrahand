mod child;
mod fanout;
mod launch;
mod merge;
mod plan;
mod profile;
mod prompt;
mod report;
mod review;
mod slots;
mod stage;
mod stream;
mod watchdog;

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
    /// Run a review as locked-down `claude -p` sessions: one for a brief, one per unit of a plan
    Review(Box<review::ReviewArgs>),
    /// Stops what a review left running if it dies without doing so; started by a review
    #[command(name = watchdog::SUBCOMMAND, hide = true)]
    Watchdog,
}

fn main() -> ExitCode {
    let args = match Cli::parse().command {
        Command::Review(args) => *args,
        Command::Watchdog => {
            watchdog::run();
            return ExitCode::SUCCESS;
        }
    };
    child::watch_signals();
    match review::run(args) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::from(EXIT_CHILD_FAILED),
        Err(message) => {
            eprintln!("ultrahand: {message}");
            ExitCode::from(EXIT_BAD_USAGE)
        }
    }
}
