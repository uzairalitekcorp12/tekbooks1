# Optional Lufga fonts

TekBooks works without custom font files and uses a premium platform fallback in Expo Go.

If you own licensed Lufga font files, place them in this directory with these exact names:

- `Lufga-Regular.ttf`
- `Lufga-Medium.ttf`

Do not rename the family inside the font file.

The dynamic Expo config (`mobile/app.config.js`) detects both files automatically. When both files exist, EAS development/release builds embed them as the `Lufga` font family. If either file is missing, the font plugin is skipped and the app continues with the default fallback.

Important: Expo Go does not apply native config plugins, so TekBooks intentionally keeps the fallback font in Expo Go even when the `.ttf` files are present. The custom font is used in the development APK/AAB created after the font files are added.
