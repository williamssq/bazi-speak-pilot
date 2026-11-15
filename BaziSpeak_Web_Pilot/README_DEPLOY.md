# Bazi Speak — Browser Pilot (0.4)

A browser-based adaptation of the user's existing Bazi Speak v0.3 prototype, intended for limited voluntary Canvas peer testing. This is a **separate web pilot**, not an already deployed live website. You must deploy it to obtain your own HTTPS link. The original Mac app remains unchanged.

## Key differences from the Mac app

- Web front end with 5 short speaking prompts, microphone recording, Whisper transcription, AI feedback, browser speech-synthesis playback, optional second recording and reflection.
- Four-question + free-text **voluntary** peer evaluation; responses are **copied locally** for participants to paste into Canvas; they are not automatically sent to the course facilitator or saved by the server.
- Web audio recorded as WebM/MP4/OGG/WAV (browser dependent); the backend sends clips to OpenAI. This differs from the original Swift WAV recording path.
- In-memory rate limits and separate pilot access code to reduce accidental public use. These are lightweight pilot protections, not production-grade abuse defenses; they reset on service restart.
- Uses the inherited v0.3 feedback guard. AI may still invent opinions or details for non-introduction tasks. Treat suggestions as provisional, not a score.
- Browser built-in voice playback rather than OpenAI TTS. Voice quality depends on the device/browser.

## Deploy with Render (free tier may be available)

1. Visit https://github.com and make a **private** new repo e.g. `bazi-speak-pilot`.
2. Upload the files **from inside this folder** to the repo root (`server.mjs`, `feedback_guard.mjs`, `package.json`, `public/`, etc.). You can upload a ZIP only after *unpacking* it; GitHub does not deploy the ZIP by itself. Do not upload API keys, `.env`, passwords, or personal recordings.
3. Visit https://dashboard.render.com/ and create **New → Web Service**. Connect your GitHub account and choose the new repo.
4. Runtime: Node. Build Command: `npm install`. Start Command: `npm start`. Choose the Free instance if available.
5. In Render → Environment, add:
   - `OPENAI_API_KEY`: a new API key (secret value, never in GitHub)
   - `PILOT_ACCESS_CODE`: a long, randomly chosen, private code such as 16+ random characters, not the API key
   - `OPENAI_TEXT_MODEL`: `gpt-4o-mini` (optional)
   - `DAILY_REQUEST_LIMIT`: `60` (optional)
   - `PER_IP_REQUEST_LIMIT`: `20` (optional)
6. Deploy. Render will give you your own URL `https://<your-service-name>.onrender.com`. Share the **real URL** through Canvas, and privately provide the pilot access code.
7. Test on your own laptop and phone (mic permission, first audio, feedback, second audio, reflection) BEFORE you invite classmates. Check HTTPS padlock. If the service was asleep, the first load may take about a minute on a free plan.
8. Monitor usage. OpenAI API calls are charged separately from ChatGPT subscriptions. Set strict project budgets/limits in OpenAI and revoke the pilot API key or disable the Render service at the end of the test.

## Local testing (Mac)

In Terminal, inside this folder:

```bash
export OPENAI_API_KEY='YOUR_NEW_KEY_ONLY_IN_LOCAL_TERMINAL'
export PILOT_ACCESS_CODE='A_LONG_TEST_ONLY_SECRET'
npm test
npm start
```

Browse to `http://localhost:3000` and use the access code above. Browser microphone access works on localhost or HTTPS.

## Privacy and participant guidance

- Learners must consent before recording and should **not** say their real name, student number, phone number, private medical/immigration details or other identifying/sensitive information.
- Audio and transcribed text are sent to OpenAI API for processing and are not deliberately saved or logged by **this application server**. The provider's separate data-handling rules still apply.
- The app is for a small class study: treat it as a **prototype**, not a production service or formal proficiency assessment.
- Participant feedback is optional and stays in the browser unless copied into Canvas. Share only anonymous feedback; ask permission before including quotes or screenshots in the report.
- The access code is *not* a guarantee against abuse or unauthorized access. It is a basic guard for a small, limited pilot. Do not share the page widely or publicize the access code.
- Free Render services sleep on inactivity and may restart. In-memory limits reset on restarts. The API key remains private as long as it stays in Render environment variables and is not copied into client files.

## What to include in the Final Report

Separate *Mac native prototype (v0.3) technical tests* from *Web Pilot (v0.4) peer testing*. Report when the site was deployed, participant consent and number, which prompts were tested, how many completed Try Again, what they actually said (anonymised), observed errors, their real written feedback, and what changed afterwards. Do not claim peer participation until actual evidence is received.
