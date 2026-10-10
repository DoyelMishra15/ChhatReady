# Run ChhatReady in GitHub Codespaces

1. Create an empty repository on your own GitHub account, upload the contents of this ZIP to it (drag the unzipped folder into the web page or use "Add file > Upload files"), then choose **Code > Codespaces > Create codespace**.
   *(Or: open any Codespace and drag this unzipped folder into the Explorer.)*
2. Wait for the setup to finish (about 1 minute). It runs `npm install` by itself.
3. In the terminal run: `npm run dev`
4. Open the forwarded port **5173** ("ChhatReady app").
5. Click **Try a sample bill** and follow the steps. No AWS account is needed: this is mock mode.

Check everything works: `npm run check` (typecheck, tests, build).
Full guide, AWS deployment and the demo script: see `README.md` and `demo/script.md`.
