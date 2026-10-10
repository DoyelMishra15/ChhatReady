import { Font } from '@react-pdf/renderer';

let done = false;

/** `base` is a URL prefix in the browser ("/fonts") or a folder on disk in tests. */
export function registerPdfFonts(base: string) {
  if (done) return;
  Font.register({
    family: 'Jakarta',
    fonts: [
      { src: `${base}/PlusJakartaSans_400Regular.ttf`, fontWeight: 400 },
      { src: `${base}/PlusJakartaSans_600SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}/PlusJakartaSans_700Bold.ttf`, fontWeight: 700 }
    ]
  });
  Font.register({ family: 'Fraunces', src: `${base}/Fraunces_600SemiBold.ttf`, fontWeight: 600 });
  Font.registerHyphenationCallback((w) => [w]);
  done = true;
}
