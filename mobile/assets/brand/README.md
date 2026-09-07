# Auth logo artwork

The sign-in screen uses the large, centered `APP_ASSETS.logoBig` image from
`mobile/config/app.ts`. Until final artwork is supplied, that key safely points
to `tekbooks-logo.png` so Metro and APK builds continue to work.

To install the approved wide logo:

1. Save it as `mobile/assets/brand/logo-big.png`.
2. In `mobile/config/app.ts`, point both login-logo keys at the same artwork so
   light and dark mode cannot show different brands:

   ```ts
   logoBig: require('../assets/brand/logo-big.png'),
   logoBigDark: require('../assets/brand/logo-big.png'),
   ```

Alternatively, add `logo-big-dark.png` and point `logoBigDark` to that file.
PNG artwork with a transparent background and generous horizontal resolution is
recommended. The UI uses `contain`, so wide, square, and tall owner logos are not
cropped or placed in a small box.
