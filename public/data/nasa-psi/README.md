# NASA PSI experimental tables

Original public CSV tables and metadata downloaded from NASA Physical Sciences Informatics on 2026-11-14. Each record declares CC0-1.0. Cite the investigation DOI in `manifest.json` when using its data. File bytes are retained unchanged; SHA-256 checksums and file/record versions are recorded in the manifest. Temporary signed download URLs are not stored.

Included: BASS-II (PSI-25), BASS (PSI-26), FLEX (PSI-69), Saffire I–III (PSI-98, PSI-99, PSI-100), SAME-R (PSI-101), and SAME (PSI-102).

The original PSI-98 Saffire-I telemetry workbook is also included. `saffire-i-sensor-history.json` contains a reproducible extraction of explicitly labeled temperature, pressure, obscuration-voltage and scattering-voltage channels (1,215 points). Original relative timestamps, numeric values and row identifiers are retained. Run `python scripts/prepare-saffire-telemetry.py --check` with `openpyxl` installed to verify the extract. There is no inferred HRR, smoke concentration, ignition alignment, smoothing or interpolation.

These tables contain experiment settings and selected measurements. They are not complete instrument time histories. Source cells may contain ranges, nonnumeric notes, missing values, uncalibrated display settings or apparent inconsistencies. Preserve these distinctions when analyzing them. FLEX concerns liquid droplets; it is not a solid-fuel cabin validation set. No existing material properties or model coefficients were replaced by these files.

Run `scripts/fetch-nasa-psi.ps1` to retrieve missing public files. Existing files are retained. A targeted retrieval preserves other investigations in the manifest. No login or data-use agreement is submitted by the script.
