const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs");
const os = require("os");

/**
 * Extract a ZIP file to a temporary directory.
 * @param {string} zipFilePath - Absolute path to the uploaded ZIP file on disk.
 * @returns {string} Absolute path to the directory containing extracted contents.
 */
function extractZip(zipFilePath) {
  const zip = new AdmZip(zipFilePath);
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "bulk-upload-"));
  zip.extractAllTo(destDir, true);
  return destDir;
}

/**
 * Remove a temporary directory and optionally the source ZIP file.
 * Silently ignores errors if paths don't exist.
 * @param {string} dirPath - Directory to remove (rm -rf).
 * @param {string} [zipFilePath] - Optional ZIP file path to also remove.
 */
function cleanupTempFiles(dirPath, zipFilePath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("cleanupTempFiles: failed to remove temp dir", dirPath, err.message);
  }
  try {
    if (zipFilePath && fs.existsSync(zipFilePath)) {
      fs.unlinkSync(zipFilePath);
    }
  } catch (err) {
    console.error("cleanupTempFiles: failed to remove ZIP file", zipFilePath, err.message);
  }
}

/**
 * Find a file inside a directory whose name (without extension) matches the given basename.
 * Searches one level deep only.
 * @param {string} dir - Directory to search in.
 * @param {string} basename - Filename without extension to match (case-insensitive).
 * @returns {string|null} Full path to the matched file, or null if not found.
 */
function findFileByBasename(dir, basename) {
  if (!dir || !basename || !fs.existsSync(dir)) return null;
  const normalizedBasename = String(basename).trim().toLowerCase();
  if (!normalizedBasename) return null;
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const entryBasename = path.parse(entry).name.toLowerCase();
      if (entryBasename === normalizedBasename) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) return fullPath;
      }
    }
  } catch {
    // directory read failure — return null
  }
  return null;
}

/**
 * Find the first .xlsx or .csv file in the extracted directory.
 * Searches root level first; if not found, looks one level deeper
 * (handles the common case where a user zips a wrapper folder).
 * @param {string} dir - Extracted directory root.
 * @returns {string|null} Full path to the spreadsheet, or null.
 */
function findSpreadsheet(dir) {
  if (!dir || !fs.existsSync(dir)) return null;

  function findInDir(searchDir) {
    try {
      const entries = fs.readdirSync(searchDir);
      for (const entry of entries) {
        const ext = path.extname(entry).toLowerCase();
        if (ext === ".xlsx" || ext === ".csv") {
          const fullPath = path.join(searchDir, entry);
          if (fs.statSync(fullPath).isFile()) return fullPath;
        }
      }
    } catch {
      // fallthrough
    }
    return null;
  }

  // Try root level first
  const rootResult = findInDir(dir);
  if (rootResult) return rootResult;

  // Try one level deeper (wrapper folder scenario)
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory() && !entry.startsWith("__MACOSX")) {
        const nested = findInDir(fullPath);
        if (nested) return nested;
      }
    }
  } catch {
    // fallthrough
  }
  return null;
}

/**
 * Resolve the "content root" of an extracted ZIP — the directory containing
 * the xlsx and the document folders. If the ZIP was created by zipping a
 * wrapper folder, the real content is one level deeper.
 * @param {string} extractedDir - The directory adm-zip extracted into.
 * @returns {string} The directory containing the xlsx and document folders.
 */
function resolveContentRoot(extractedDir) {
  // If the spreadsheet is at root level, the content root is the extracted dir itself.
  try {
    const entries = fs.readdirSync(extractedDir);
    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      if (ext === ".xlsx" || ext === ".csv") return extractedDir;
    }
    // No spreadsheet at root — check for a single wrapper directory
    for (const entry of entries) {
      if (entry.startsWith("__MACOSX") || entry.startsWith(".")) continue;
      const fullPath = path.join(extractedDir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        const innerEntries = fs.readdirSync(fullPath);
        const hasSpreadsheet = innerEntries.some((e) => {
          const ext = path.extname(e).toLowerCase();
          return ext === ".xlsx" || ext === ".csv";
        });
        if (hasSpreadsheet) return fullPath;
      }
    }
  } catch {
    // fallthrough
  }
  return extractedDir;
}

module.exports = { extractZip, cleanupTempFiles, findFileByBasename, findSpreadsheet, resolveContentRoot };
