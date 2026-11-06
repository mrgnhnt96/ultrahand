use std::fmt::Write;
use std::fs;
use std::path::{Path, PathBuf};

use image::ImageReader;
use image::imageops::FilterType;
use tempfile::TempDir;

use crate::plan::{Capture, Unit};
use crate::review::one_line;

pub const INDEX_FILE: &str = "captures.txt";

const LONG_EDGE: u32 = 1568;
const NOT_GIVEN: &str = "not given";

/// A unit's own captures in a folder only its child is pointed at. Dropping this removes
/// them.
pub struct Staged {
    _folder: TempDir,
    pub path: PathBuf,
}

pub fn needs_scaling(capture: &Capture) -> bool {
    capture.width.max(capture.height) > LONG_EDGE
}

pub fn stage(unit: &Unit) -> Result<Staged, String> {
    let folder = tempfile::Builder::new()
        .prefix("ultrahand-unit-")
        .tempdir()
        .map_err(|e| format!("can't make a staging folder: {e}"))?;
    let path =
        fs::canonicalize(folder.path()).map_err(|e| format!("can't make a staging folder: {e}"))?;
    let mut index = String::new();
    for capture in &unit.captures {
        let size = stage_capture(capture, &path)
            .map_err(|e| format!("can't stage {}: {e}", capture.file_name))?;
        let _ = writeln!(index, "{}", index_line(capture, &size));
    }
    fs::write(path.join(INDEX_FILE), index).map_err(|e| format!("can't write the index: {e}"))?;
    Ok(Staged {
        _folder: folder,
        path,
    })
}

/// Staged under its own file name, because that's how a report refers to it. Returns the
/// size the child will see.
fn stage_capture(capture: &Capture, folder: &Path) -> Result<String, String> {
    let target = folder.join(&capture.file_name);
    if !needs_scaling(capture) {
        fs::copy(&capture.path, &target).map_err(|e| e.to_string())?;
        return Ok(format!("{}x{}", capture.width, capture.height));
    }
    let reader = ImageReader::open(&capture.path)
        .and_then(ImageReader::with_guessed_format)
        .map_err(|e| e.to_string())?;
    let scaled = reader.decode().map_err(|e| e.to_string())?.resize(
        LONG_EDGE,
        LONG_EDGE,
        FilterType::Lanczos3,
    );
    scaled
        .save_with_format(&target, capture.format)
        .map_err(|e| e.to_string())?;
    Ok(format!("{}x{}", scaled.width(), scaled.height()))
}

fn index_line(capture: &Capture, staged_size: &str) -> String {
    let field = |value: &Option<String>| value.as_deref().map_or(NOT_GIVEN.to_owned(), one_line);
    let size = capture
        .size
        .as_deref()
        .map_or(staged_size.to_owned(), one_line);
    format!(
        "{} | {} | {} | {size}",
        one_line(&capture.file_name),
        field(&capture.state),
        field(&capture.theme),
    )
}
